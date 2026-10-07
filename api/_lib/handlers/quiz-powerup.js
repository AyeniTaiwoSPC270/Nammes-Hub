import { getSupabaseAdmin } from '../supabaseAdmin.js'
import { hashToken, createRateLimiter, sanitizeGameOptions, fiftyFiftyHidden, POWERUPS } from '../quiz.js'
import { currentQuestion } from '../quizSessionQuestions.js'

// A player spends a power-up on the question that is open. Each can be used once per game, one per question.
//   double: a right answer earns double (not on a double-points question, not on polls)
//   fifty:  two wrong options are hidden for this player (only on questions with four options)
// Spending is final even if the player then does not answer, and tapping twice does nothing the second time.
export function createQuizPowerupHandler(getClient, { allow = createRateLimiter({ max: 20, windowMs: 60_000 }) } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    const { token, kind } = req.body ?? {}
    if (typeof token !== 'string' || !token || !POWERUPS.includes(kind)) {
      res.status(400).json({ error: 'token and a valid kind are required' })
      return
    }
    const tokenHash = hashToken(token)
    if (!allow(tokenHash)) {
      res.status(429).json({ error: 'Slow down' })
      return
    }

    const supabaseAdmin = getClient()
    const { data: tokenRow } = await supabaseAdmin.from('quiz_player_tokens').select('player_id').eq('token_hash', tokenHash).maybeSingle()
    if (!tokenRow) {
      res.status(401).json({ error: 'Unknown player. Rejoin the game.' })
      return
    }
    const { data: player } = await supabaseAdmin
      .from('quiz_players')
      .select('id, session_id, powerups_used')
      .eq('id', tokenRow.player_id)
      .maybeSingle()
    const { data: session } = player
      ? await supabaseAdmin.from('quiz_sessions').select('*').eq('id', player.session_id).maybeSingle()
      : { data: null }
    if (!session) {
      res.status(404).json({ error: 'Game not found' })
      return
    }
    if (!sanitizeGameOptions(session.game_options).powerups) {
      res.status(403).json({ error: 'Power-ups are off in this game' })
      return
    }
    if (session.state !== 'question' || session.paused_at) {
      res.status(409).json({ error: 'There is no question open right now' })
      return
    }

    const question = await currentQuestion(supabaseAdmin, session)
    if (!question) {
      res.status(404).json({ error: 'Question not found' })
      return
    }
    const type = question.type ?? 'multiple'
    if (kind === 'double' && (type === 'poll' || question.points_multiplier === 2)) {
      res.status(409).json({ error: type === 'poll' ? 'Polls have no points to double' : 'This question is already worth double' })
      return
    }
    if (kind === 'fifty' && !(type === 'multiple' && question.options.length === 4)) {
      res.status(409).json({ error: '50/50 needs a question with four answers' })
      return
    }

    const { data: answered } = await supabaseAdmin.from('quiz_answers').select('player_id').eq('player_id', player.id).eq('question_id', question.id).maybeSingle()
    if (answered) {
      res.status(409).json({ error: 'You already answered this question' })
      return
    }

    const hiddenFor = () => fiftyFiftyHidden({ playerId: player.id, questionId: question.id, optionCount: question.options.length, correctIndex: question.correct_index })
    const { data: existing } = await supabaseAdmin.from('quiz_powerup_uses').select('kind').eq('player_id', player.id).eq('question_id', question.id).maybeSingle()
    if (existing) {
      if (existing.kind !== kind) {
        res.status(409).json({ error: 'You already used a power-up on this question' })
        return
      }
      res.status(200).json({ kind, ...(kind === 'fifty' ? { hidden: hiddenFor() } : {}) })
      return
    }
    if ((player.powerups_used ?? []).includes(kind)) {
      res.status(409).json({ error: 'You already used that power-up' })
      return
    }

    const { error } = await supabaseAdmin.from('quiz_powerup_uses').insert({ player_id: player.id, question_id: question.id, kind })
    if (error) {
      if (error.code === '23505') {
        res.status(409).json({ error: 'You already used a power-up on this question' })
        return
      }
      console.error('quiz-powerup: insert failed', error)
      res.status(500).json({ error: 'Could not use the power-up' })
      return
    }
    await supabaseAdmin.from('quiz_players').update({ powerups_used: [...(player.powerups_used ?? []), kind] }).eq('id', player.id)
    res.status(200).json({ kind, ...(kind === 'fifty' ? { hidden: hiddenFor() } : {}) })
  }
}

export default createQuizPowerupHandler(getSupabaseAdmin)
