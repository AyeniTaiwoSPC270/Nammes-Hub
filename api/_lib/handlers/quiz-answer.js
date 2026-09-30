import { getSupabaseAdmin } from '../supabaseAdmin.js'
import { hashToken, scoreAnswer, createRateLimiter, ANSWER_GRACE_MS } from '../quiz.js'

// A player submits an answer. Points come from the server's own clock and the reply never says whether the
// answer was right: correctness is only revealed once the host moves the game to the reveal step.
export function createQuizAnswerHandler(getClient, { now = () => Date.now(), allow = createRateLimiter({ max: 30, windowMs: 60_000 }) } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    const { token, chosenIndex } = req.body ?? {}
    if (typeof token !== 'string' || !token || !Number.isInteger(chosenIndex) || chosenIndex < 0 || chosenIndex > 3) {
      res.status(400).json({ error: 'token and chosenIndex are required' })
      return
    }
    const tokenHash = hashToken(token)
    if (!allow(tokenHash)) {
      res.status(429).json({ error: 'Slow down' })
      return
    }

    const supabaseAdmin = getClient()
    const { data: tokenRow } = await supabaseAdmin
      .from('quiz_player_tokens')
      .select('player_id')
      .eq('token_hash', tokenHash)
      .maybeSingle()
    if (!tokenRow) {
      res.status(401).json({ error: 'Unknown player. Rejoin the game.' })
      return
    }
    const { data: player } = await supabaseAdmin
      .from('quiz_players')
      .select('id, session_id')
      .eq('id', tokenRow.player_id)
      .maybeSingle()
    const { data: session } = player
      ? await supabaseAdmin.from('quiz_sessions').select('*').eq('id', player.session_id).maybeSingle()
      : { data: null }
    if (!session) {
      res.status(404).json({ error: 'Game not found' })
      return
    }
    if (session.state !== 'question') {
      res.status(409).json({ error: 'There is no question open right now' })
      return
    }

    const { data: question } = await supabaseAdmin
      .from('quiz_questions')
      .select('id, options, correct_index, time_limit_seconds, points')
      .eq('quiz_id', session.quiz_id)
      .eq('position', session.current_question_index)
      .maybeSingle()
    if (!question || chosenIndex >= question.options.length) {
      res.status(400).json({ error: 'That is not one of the options' })
      return
    }

    const elapsedMs = now() - new Date(session.question_started_at).getTime()
    if (elapsedMs > question.time_limit_seconds * 1000 + ANSWER_GRACE_MS) {
      res.status(409).json({ error: 'Time is up' })
      return
    }

    const points = scoreAnswer({
      correct: chosenIndex === question.correct_index,
      points: question.points,
      timeLimitSeconds: question.time_limit_seconds,
      elapsedMs,
    })
    const { data: recorded, error } = await supabaseAdmin.rpc('quiz_record_answer', {
      p_session: session.id,
      p_player: player.id,
      p_question: question.id,
      p_index: session.current_question_index,
      p_chosen: chosenIndex,
      p_points: points,
    })
    if (error) {
      console.error('quiz-answer: record failed', error)
      res.status(500).json({ error: 'Could not save your answer' })
      return
    }
    if (!recorded) {
      res.status(409).json({ error: 'You already answered, or the question just closed' })
      return
    }
    res.status(200).json({ accepted: true })
  }
}

export default createQuizAnswerHandler(getSupabaseAdmin)
