import { getSupabaseAdmin } from '../supabaseAdmin.js'
import { isJoinCode, isAvatarId, validateNickname, newPlayerToken, hashToken, createRateLimiter, clientIp, MAX_PLAYERS } from '../quiz.js'

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
    const { code, nickname, avatarId = 0 } = req.body ?? {}
    if (!isJoinCode(code)) {
      res.status(400).json({ error: 'Enter the 6-digit game code' })
      return
    }
    if (!isAvatarId(avatarId)) {
      res.status(400).json({ error: 'Pick one of the characters' })
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
      .select('id, state, max_players')
      .eq('join_code', code)
      .neq('state', 'finished')
      .maybeSingle()
    if (!session) {
      res.status(404).json({ error: 'No game found with that code' })
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

    const { data: player, error } = await supabaseAdmin
      .from('quiz_players')
      .insert({ session_id: session.id, nickname: checked.value, avatar_id: avatarId })
      .select('id')
      .single()
    if (error) {
      if (error.code === '23505') {
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

    // The join that fills the lobby starts the 10-second countdown (only the first to get here sets it).
    if ((firstN ?? []).length >= limit) {
      const { error: fullError } = await supabaseAdmin
        .from('quiz_sessions')
        .update({ full_at: now().toISOString() })
        .eq('id', session.id)
        .is('full_at', null)
      if (fullError) console.error('quiz-join: could not mark the lobby full', fullError)
    }

    res.status(200).json({ token, playerId: player.id, sessionId: session.id, nickname: checked.value, avatarId })
  }
}

export default createQuizJoinHandler(getSupabaseAdmin)
