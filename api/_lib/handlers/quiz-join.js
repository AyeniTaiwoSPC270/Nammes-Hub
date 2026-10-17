import { getSupabaseAdmin } from '../supabaseAdmin.js'
import { isJoinCode, isAvatarId, validateNickname, newPlayerToken, hashToken, safeEqual, createRateLimiter, clientIp, MAX_PLAYERS } from '../quiz.js'
import { pickAutoTeam } from '../quizTeams.js'

// A player who reloads sends the same nickname again, and `quiz_players_nickname` refuses it -- "That nickname is
// taken. Pick another." is a true statement and a useless one, because the person asking is the person who took it.
// So a join that arrives with a token gets to be a resume instead, and this is that check.
//
// Deliberately not gated on the session being locked or under its player limit: neither of those stops the person who
// already holds a seat from getting back into the room, and "This game is full" is the worst possible answer to the
// student it is actually about. The token is the secret, so the seat is only ever returned to its owner.
//
// The response is shaped like a fresh join on purpose -- the phone runs one code path after joining and does not need
// to know whether this was its first visit or its fiftieth. Score and streak come back too so a phone can show a
// returning player their standing before the next poll lands.
async function tryResume(supabaseAdmin, session, nickname, token) {
  if (typeof token !== 'string' || token.length === 0) return null
  const { data: player } = await supabaseAdmin
    .from('quiz_players')
    .select('id, nickname, avatar_id, total_score, streak, team_id')
    .eq('session_id', session.id)
    .ilike('nickname', nickname)
    .maybeSingle()
  if (!player) return null

  const { data: stored } = await supabaseAdmin
    .from('quiz_player_tokens')
    .select('token_hash')
    .eq('player_id', player.id)
    .maybeSingle()
  // A mismatched token is not an error to report here: it is an ordinary new player who happens to share a name with
  // somebody, and the caller turns it into the same "pick another" answer the unique index would have given.
  if (!stored || !safeEqual(hashToken(token), stored.token_hash)) return null

  let team = null
  if (player.team_id) {
    const { data: t } = await supabaseAdmin.from('quiz_teams').select('id, name, color').eq('id', player.team_id).maybeSingle()
    team = t ?? null
  }
  return {
    token,
    playerId: player.id,
    sessionId: session.id,
    nickname: player.nickname,
    avatarId: player.avatar_id,
    score: player.total_score ?? 0,
    streak: player.streak ?? 0,
    resumed: true,
    ...(team ? { team: { id: team.id, name: team.name, color: team.color } } : {}),
  }
}

// Anyone with a join code can join with a nickname. No account. The player gets a secret token that
// proves who they are on later calls, and only its hash is stored.
export function createQuizJoinHandler(getClient, { allow = createRateLimiter({ max: 15, windowMs: 60_000 }), now = () => new Date() } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    if (!allow(clientIp(req))) {
      res.status(429).json({ error: 'Too many tries. Wait a moment and try again.' })
      return
    }
    const { code, nickname, avatarId = 0, teamId, token: playerToken } = req.body ?? {}
    if (!isJoinCode(code)) {
      res.status(400).json({ error: 'Enter the 6-digit game code' })
      return
    }
    const checked = validateNickname(nickname)
    if (!checked.ok) {
      res.status(400).json({ error: checked.error })
      return
    }

    const supabaseAdmin = getClient()
    const { data: session } = await supabaseAdmin
      .from('quiz_sessions')
      .select('id, state, max_players, locked, blocked_nicknames, team_mode, characters')
      .eq('join_code', code)
      .neq('state', 'finished')
      .maybeSingle()
    if (!session) {
      res.status(404).json({ error: 'No game found with that code' })
      return
    }

    if (!isAvatarId(avatarId, session.characters)) {
      res.status(400).json({ error: 'Pick one of the characters' })
      return
    }

    // A nickname the host removed stays blocked for this game (compared without case). Checked before the resume,
    // because it is the one veto a token cannot argue with: the host looked at this name in a room full of people and
    // removed it, so holding the seat that name came in with does not entitle anybody back to it.
    if ((session.blocked_nicknames ?? []).includes(checked.value.toLowerCase())) {
      res.status(403).json({ error: 'Please pick a different nickname' })
      return
    }

    const resumed = await tryResume(supabaseAdmin, session, checked.value, playerToken)
    if (resumed) {
      res.status(200).json(resumed)
      return
    }

    // Deliberately after the resume rather than before it. A locked lobby is a door closed against new names, not an
    // ejection: refusing it here would turn every reconnect into a dead end for a student who is still on the roster.
    if (session.locked) {
      res.status(403).json({ error: 'This game is locked. Ask the host.' })
      return
    }

    const limit = session.max_players ?? MAX_PLAYERS
    const { count } = await supabaseAdmin
      .from('quiz_players')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', session.id)
    if ((count ?? 0) >= limit) {
      res.status(403).json({ error: 'This game is full' })
      return
    }

    // In team mode every player is on a team. A phone that has not picked one is sent the list to choose from.
    let team = null
    if (session.team_mode) {
      const [{ data: teams }, { data: members }] = await Promise.all([
        supabaseAdmin.from('quiz_teams').select('id, name, color, avatar_id, position').eq('session_id', session.id).order('position', { ascending: true }),
        supabaseAdmin.from('quiz_players').select('id, team_id').eq('session_id', session.id),
      ])
      const list = teams ?? []
      if (teamId === undefined || teamId === null) {
        const sizes = new Map(list.map((t) => [t.id, 0]))
        for (const m of members ?? []) if (sizes.has(m.team_id)) sizes.set(m.team_id, sizes.get(m.team_id) + 1)
        res.status(409).json({
          error: 'Pick a team',
          needsTeam: true,
          teams: list.map((t) => ({ id: t.id, name: t.name, color: t.color, avatarId: t.avatar_id, members: sizes.get(t.id) })),
        })
        return
      }
      // "Put me anywhere" is settled by the database after the player is added (see below), so phones that join in the
      // same instant cannot all be sent to the same team. Until then a placeholder stands in.
      team = teamId === 'auto' ? pickAutoTeam(list, members ?? []) : list.find((t) => t.id === teamId) ?? null
      if (!team) {
        res.status(400).json({ error: 'Pick one of the teams' })
        return
      }
    }

    const { data: player, error } = await supabaseAdmin
      .from('quiz_players')
      .insert({ session_id: session.id, nickname: checked.value, avatar_id: avatarId, ...(team && teamId !== 'auto' ? { team_id: team.id } : {}) })
      .select('id')
      .single()
    if (error) {
      if (error.code === '23505') {
        // The early resume missed, so another join with this name landed in between. Ask again before telling the
        // student to pick a different one; the race is the whole reason this second attempt exists.
        const late = await tryResume(supabaseAdmin, session, checked.value, playerToken)
        if (late) {
          res.status(200).json(late)
          return
        }
        res.status(409).json({ error: 'That nickname is taken. Pick another.' })
        return
      }
      console.error('quiz-join: player insert failed', error)
      res.status(500).json({ error: 'Could not join the game' })
      return
    }

    // Two people can join in the same instant and both pass the check above, so confirm this player really is
    // inside the first `limit` (by join time); if not, step back out. This keeps the limit exact.
    const { data: firstN } = await supabaseAdmin
      .from('quiz_players')
      .select('id')
      .eq('session_id', session.id)
      .order('joined_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(limit)
    if (!(firstN ?? []).some((row) => row.id === player.id)) {
      await supabaseAdmin.from('quiz_players').delete().eq('id', player.id)
      res.status(403).json({ error: 'This game is full' })
      return
    }

    const token = newPlayerToken()
    const { error: tokenError } = await supabaseAdmin
      .from('quiz_player_tokens')
      .insert({ player_id: player.id, token_hash: hashToken(token) })
    if (tokenError) {
      console.error('quiz-join: token insert failed', tokenError)
      await supabaseAdmin.from('quiz_players').delete().eq('id', player.id)
      res.status(500).json({ error: 'Could not join the game' })
      return
    }

    if (team && teamId === 'auto') {
      const { data: assigned, error: assignError } = await supabaseAdmin.rpc('quiz_assign_auto_team', { p_session: session.id, p_player: player.id })
      if (assignError || !assigned) {
        console.error('quiz-join: auto team failed', assignError)
        await supabaseAdmin.from('quiz_players').delete().eq('id', player.id)
        res.status(500).json({ error: 'Could not join the game' })
        return
      }
      team = (await supabaseAdmin.from('quiz_teams').select('id, name, color').eq('id', assigned).maybeSingle()).data ?? team
    }

    // The join that fills the lobby starts the 10-second countdown (only the first to get here sets it).
    if ((firstN ?? []).length >= limit) {
      const { error: fullError } = await supabaseAdmin
        .from('quiz_sessions')
        .update({ full_at: now().toISOString() })
        .eq('id', session.id)
        .is('full_at', null)
      if (fullError) console.error('quiz-join: could not mark the lobby full', fullError)
    }

    res.status(200).json({
      token,
      playerId: player.id,
      sessionId: session.id,
      nickname: checked.value,
      avatarId,
      ...(team ? { team: { id: team.id, name: team.name, color: team.color } } : {}),
    })
  }
}

export default createQuizJoinHandler(getSupabaseAdmin)
