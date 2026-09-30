import { getSupabaseAdmin } from '../supabaseAdmin.js'
import { isJoinCode, isAvatarId, validateNickname, newPlayerToken, hashToken, createRateLimiter, clientIp, MAX_PLAYERS } from '../quiz.js'

// Anyone with a join code can join with a nickname. No account. The player gets a secret token that
// proves who they are on later calls, and only its hash is stored.
export function createQuizJoinHandler(getClient, { allow = createRateLimiter({ max: 15, windowMs: 60_000 }) } = {}) {
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
      .select('id, state')
      .eq('join_code', code)
      .neq('state', 'finished')
      .maybeSingle()
    if (!session) {
      res.status(404).json({ error: 'No game found with that code' })
      return
    }

    const { count } = await supabaseAdmin
      .from('quiz_players')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', session.id)
    if ((count ?? 0) >= MAX_PLAYERS) {
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

    res.status(200).json({ token, playerId: player.id, sessionId: session.id, nickname: checked.value, avatarId })
  }
}

export default createQuizJoinHandler(getSupabaseAdmin)
