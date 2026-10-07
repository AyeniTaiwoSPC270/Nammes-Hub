import { getSupabaseAdmin } from '../supabaseAdmin.js'
import {
  hashToken, scoreAnswer, createRateLimiter, ANSWER_GRACE_MS, effectiveElapsedMs, questionLimitMs,
  gradeAnswer, computeAward, isComeback, sanitizeGameOptions, fiftyFiftyHidden,
} from '../quiz.js'
import { currentQuestion, optionOrderFor } from '../quizSessionQuestions.js'
import { originalIndex } from '../quizDraw.js'

// A player submits an answer. Points come from the server's own clock and the reply never says whether the
// answer was right: correctness is only revealed once the host moves the game to the reveal step.
// Multiple choice and true/false send `chosenIndex`; typed questions send `answerText`.
export function createQuizAnswerHandler(getClient, { now = () => Date.now(), allow = createRateLimiter({ max: 30, windowMs: 60_000 }) } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    const { token, chosenIndex, answerText } = req.body ?? {}
    if (typeof token !== 'string' || !token) {
      res.status(400).json({ error: 'token is required' })
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
      .select('id, session_id, streak')
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
    if (session.paused_at) {
      res.status(409).json({ error: 'The game is paused' })
      return
    }

    const question = await currentQuestion(supabaseAdmin, session)
    if (!question) {
      res.status(400).json({ error: 'That is not one of the options' })
      return
    }
    // A player answers the option they were shown, so a shuffled question has to be turned back into the stored position
    // before grading. Refused here rather than graded against whatever happened to land there.
    const optionOrder = optionOrderFor(session, question.id)
    const sentIndex = originalIndex(optionOrder, chosenIndex, (question.options ?? []).length)
    const graded = gradeAnswer(question, { chosenIndex: sentIndex ?? chosenIndex, answerText })
    if (!graded.ok) {
      res.status(400).json({ error: graded.error })
      return
    }

    const elapsedMs = effectiveElapsedMs(session, now())
    const limitMs = questionLimitMs(session, question)
    if (elapsedMs > limitMs + ANSWER_GRACE_MS) {
      res.status(409).json({ error: 'Time is up' })
      return
    }

    // A power-up tapped on this question: 50/50 takes two wrong options away, double down doubles a right answer.
    const { data: use } = await supabaseAdmin
      .from('quiz_powerup_uses')
      .select('kind')
      .eq('player_id', player.id)
      .eq('question_id', question.id)
      .maybeSingle()
    const powerup = use?.kind ?? null
    if (powerup === 'fifty') {
      // Also in stored positions, the same space the answer was just graded in, so the option refused here is exactly the
      // one the phone removed.
      const hidden = fiftyFiftyHidden({ playerId: player.id, questionId: question.id, optionCount: (question.options ?? []).length, correctIndex: question.correct_index })
      if (hidden.includes(graded.chosenIndex)) {
        res.status(400).json({ error: 'That option was removed by your 50/50' })
        return
      }
    }

    const options = sanitizeGameOptions(session.game_options)
    let comeback = false
    if (options.comeback && graded.correct) {
      // Standing when the question opened: current totals minus what this question has already awarded.
      const [{ data: players }, { data: answered }] = await Promise.all([
        supabaseAdmin.from('quiz_players').select('id, total_score').eq('session_id', session.id),
        supabaseAdmin.from('quiz_answers').select('player_id, points_awarded').eq('question_id', question.id),
      ])
      const gained = new Map((answered ?? []).map((a) => [a.player_id, a.points_awarded]))
      const before = new Map((players ?? []).map((p) => [p.id, p.total_score - (gained.get(p.id) ?? 0)]))
      comeback = isComeback(before, player.id)
    }

    const base = scoreAnswer({
      correct: graded.correct === true,
      points: question.points,
      timeLimitSeconds: limitMs / 1000,
      elapsedMs,
    })
    const award = computeAward({
      correct: graded.correct,
      base,
      streakBefore: player.streak ?? 0,
      multiplier: question.points_multiplier ?? 1,
      powerup,
      comeback,
      options,
    })

    const { data: recorded, error } = await supabaseAdmin.rpc('quiz_record_answer', {
      p_session: session.id,
      p_player: player.id,
      p_question: question.id,
      p_index: session.current_question_index,
      p_chosen: graded.chosenIndex,
      p_points: award.points,
      p_bonus: award.bonus,
      p_correct: graded.correct,
      p_text: graded.answerText,
      p_powerup: powerup,
      p_streak: award.streakAfter,
      p_elapsed: Math.round(elapsedMs),
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
