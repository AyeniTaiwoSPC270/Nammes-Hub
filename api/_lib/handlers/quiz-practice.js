import { getSupabaseAdmin } from '../supabaseAdmin.js'
import { isUuid } from '../validate.js'
import { logError } from '../logError.js'
import {
  validateNickname, isAvatarId, newPlayerToken, hashToken, createRateLimiter, clientIp, scoreAnswer, ANSWER_GRACE_MS,
  gradeAnswer, isChoiceType, correctText,
} from '../quiz.js'
import { sanitizeTheme } from '../quizTheme.js'
import { publicImageUrl } from '../quizImage.js'

// Practice mode: one person replays a quiz on their own phone, no host. Questions are sent one at a time, so a player
// never receives a later question (or any answer) in advance. After each answer they see the result at once.
// Scoring uses the server's clock and the same rules as a live game (without streaks or power-ups). Polls are skipped.
// The practice leaderboard is for fun: because answers are shown straight away, a replay can learn them.
//
// One route with an `op`: info, start, state, answer, next, top.
const OPS = ['info', 'start', 'state', 'answer', 'next', 'top']

export function createQuizPracticeHandler(
  getClient,
  {
    now = () => Date.now(),
    baseUrl = process.env.VITE_SUPABASE_URL,
    allowStart = createRateLimiter({ max: 5, windowMs: 60 * 60_000 }),
    allow = createRateLimiter({ max: 90, windowMs: 60_000 }),
    cleanupChance = 0.02,
    random = Math.random,
  } = {},
) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    const { op, quizId, token, nickname, avatarId = 0, chosenIndex, answerText } = req.body ?? {}
    if (!OPS.includes(op)) {
      res.status(400).json({ error: 'Unknown request' })
      return
    }

    const supabaseAdmin = getClient()

    async function enabledQuiz(id) {
      if (!isUuid(id)) return null
      const { data } = await supabaseAdmin.from('quizzes').select('id, title, practice_enabled, theme').eq('id', id).maybeSingle()
      return data && data.practice_enabled ? data : null
    }
    async function playableQuestions(id) {
      const { data } = await supabaseAdmin.from('quiz_questions').select('*').eq('quiz_id', id)
      return (data ?? []).filter((q) => (q.type ?? 'multiple') !== 'poll').sort((a, b) => a.position - b.position)
    }
    const fail = async (error, message) => {
      console.error(`quiz-practice: ${op} failed`, error)
      await logError(supabaseAdmin, 'quiz-practice', error, 500)
      res.status(500).json({ error: message })
    }

    // What the player sees for their run right now.
    async function view(run, questions, quiz) {
      const total = questions.length
      const base = { serverNow: now(), total, score: run.total_score, nickname: run.nickname, avatarId: run.avatar_id, theme: sanitizeTheme(quiz?.theme, { quizId: run.quiz_id }) }
      if (run.finished_at || run.current_index >= total) {
        const { data: answers } = await supabaseAdmin.from('quiz_practice_answers').select('correct').eq('run_id', run.id)
        const correct = (answers ?? []).filter((a) => a.correct === true).length
        return { ...base, finished: true, correctCount: correct }
      }
      const question = questions[run.current_index]
      let { data: answer } = await supabaseAdmin
        .from('quiz_practice_answers')
        .select('chosen_index, answer_text, correct, points_awarded')
        .eq('run_id', run.id)
        .eq('question_id', question.id)
        .maybeSingle()
      const elapsed = now() - new Date(run.question_started_at).getTime()
      let score = run.total_score
      if (!answer && elapsed > question.time_limit_seconds * 1000 + ANSWER_GRACE_MS) {
        // The time ran out with no answer: it counts as a miss and the answer is shown.
        await supabaseAdmin.rpc('quiz_practice_record', { p_run: run.id, p_question: question.id, p_chosen: null, p_text: null, p_correct: false, p_points: 0 })
        answer = { chosen_index: null, answer_text: null, correct: false, points_awarded: 0 }
      }
      const type = question.type ?? 'multiple'
      const out = {
        ...base,
        score,
        finished: false,
        index: run.current_index,
        startedAt: run.question_started_at,
        question: {
          type,
          text: question.text,
          options: isChoiceType(type) ? question.options : [],
          timeLimitSeconds: question.time_limit_seconds,
          multiplier: question.points_multiplier ?? 1,
          imageUrl: publicImageUrl(baseUrl, question.image_path, run.quiz_id),
          imageAlt: question.image_alt ?? '',
        },
      }
      if (answer) out.result = resultFor(question, answer)
      return out
    }

    function resultFor(question, answer) {
      const type = question.type ?? 'multiple'
      return {
        correct: answer.correct === true,
        pointsAwarded: answer.points_awarded ?? 0,
        chosenIndex: answer.chosen_index ?? null,
        answerText: answer.answer_text ?? null,
        correctIndex: isChoiceType(type) ? question.correct_index : null,
        correctText: correctText(question),
        timedOut: answer.chosen_index == null && answer.answer_text == null,
      }
    }

    async function runFromToken() {
      if (typeof token !== 'string' || !token) {
        res.status(400).json({ error: 'token is required' })
        return null
      }
      const hash = hashToken(token)
      if (!allow(hash)) {
        res.status(429).json({ error: 'Slow down' })
        return null
      }
      const { data: run } = await supabaseAdmin.from('quiz_practice_runs').select('*').eq('token_hash', hash).maybeSingle()
      if (!run) {
        res.status(401).json({ error: 'Practice session not found. Start again.' })
        return null
      }
      return run
    }

    // ---- info: is this quiz open for practice, and how big is it ----
    if (op === 'info') {
      const quiz = await enabledQuiz(quizId)
      if (!quiz) {
        res.status(404).json({ error: 'This quiz is not open for practice' })
        return
      }
      const questions = await playableQuestions(quiz.id)
      res.status(200).json({ title: quiz.title, questionCount: questions.length, theme: sanitizeTheme(quiz.theme, { quizId: quiz.id }) })
      return
    }

    // ---- top: the practice leaderboard (finished runs only) ----
    if (op === 'top') {
      const quiz = await enabledQuiz(quizId)
      if (!quiz) {
        res.status(404).json({ error: 'This quiz is not open for practice' })
        return
      }
      const { data } = await supabaseAdmin
        .from('quiz_practice_runs')
        .select('nickname, avatar_id, total_score')
        .eq('quiz_id', quiz.id)
        .not('finished_at', 'is', null)
        .order('total_score', { ascending: false })
        .limit(10)
      const top = (data ?? []).sort((a, b) => b.total_score - a.total_score).slice(0, 10).map((r) => ({ nickname: r.nickname, avatarId: r.avatar_id, score: r.total_score }))
      res.status(200).json({ top })
      return
    }

    // ---- start ----
    if (op === 'start') {
      if (!allowStart(clientIp(req))) {
        res.status(429).json({ error: 'You have started a lot of practice runs. Try again later.' })
        return
      }
      const quiz = await enabledQuiz(quizId)
      if (!quiz) {
        res.status(404).json({ error: 'This quiz is not open for practice' })
        return
      }
      const checked = validateNickname(nickname)
      if (!checked.ok) {
        res.status(400).json({ error: checked.error })
        return
      }
      if (!isAvatarId(avatarId)) {
        res.status(400).json({ error: 'Pick one of the characters' })
        return
      }
      const questions = await playableQuestions(quiz.id)
      if (questions.length === 0) {
        res.status(404).json({ error: 'This quiz has no questions to practise yet' })
        return
      }
      const newToken = newPlayerToken()
      const { data: run, error } = await supabaseAdmin
        .from('quiz_practice_runs')
        .insert({
          quiz_id: quiz.id,
          nickname: checked.value,
          avatar_id: avatarId,
          token_hash: hashToken(newToken),
          current_index: 0,
          question_started_at: new Date(now()).toISOString(),
        })
        .select('*')
        .single()
      if (error) return fail(error, 'Could not start practice')
      if (random() < cleanupChance) await supabaseAdmin.rpc('quiz_practice_cleanup') // housekeeping, best effort
      res.status(200).json({ token: newToken, nickname: checked.value, avatarId, ...(await view(run, questions, quiz)) })
      return
    }

    // ---- state / answer / next need a run ----
    const run = await runFromToken()
    if (!run) return
    const { data: quiz } = await supabaseAdmin.from('quizzes').select('id, title, practice_enabled, theme').eq('id', run.quiz_id).maybeSingle()
    if (!quiz || !quiz.practice_enabled) {
      res.status(404).json({ error: 'This quiz is not open for practice any more' })
      return
    }
    const questions = await playableQuestions(run.quiz_id)

    if (op === 'state') {
      res.status(200).json(await view(run, questions, quiz))
      return
    }

    if (run.finished_at || run.current_index >= questions.length) {
      res.status(409).json({ error: 'This practice run is finished' })
      return
    }
    const question = questions[run.current_index]

    if (op === 'answer') {
      const { data: existing } = await supabaseAdmin.from('quiz_practice_answers').select('run_id').eq('run_id', run.id).eq('question_id', question.id).maybeSingle()
      if (existing) {
        res.status(409).json({ error: 'You already answered this question' })
        return
      }
      const graded = gradeAnswer(question, { chosenIndex, answerText })
      if (!graded.ok) {
        res.status(400).json({ error: graded.error })
        return
      }
      const elapsedMs = now() - new Date(run.question_started_at).getTime()
      const late = elapsedMs > question.time_limit_seconds * 1000 + ANSWER_GRACE_MS
      const correct = !late && graded.correct === true
      const base = correct ? scoreAnswer({ correct, points: question.points, timeLimitSeconds: question.time_limit_seconds, elapsedMs }) : 0
      const points = base * (correct && question.points_multiplier === 2 ? 2 : 1)
      const { data: recorded, error } = await supabaseAdmin.rpc('quiz_practice_record', {
        p_run: run.id,
        p_question: question.id,
        p_chosen: late ? null : graded.chosenIndex,
        p_text: late ? null : graded.answerText,
        p_correct: correct,
        p_points: points,
      })
      if (error) return fail(error, 'Could not save your answer')
      if (!recorded) {
        res.status(409).json({ error: 'You already answered this question' })
        return
      }
      const answer = { chosen_index: late ? null : graded.chosenIndex, answer_text: late ? null : graded.answerText, correct, points_awarded: points }
      const { data: fresh } = await supabaseAdmin.from('quiz_practice_runs').select('total_score').eq('id', run.id).maybeSingle()
      res.status(200).json({ result: resultFor(question, answer), score: fresh?.total_score ?? run.total_score + points })
      return
    }

    // next: only after this question has an answer (or ran out of time)
    const { data: answered } = await supabaseAdmin.from('quiz_practice_answers').select('run_id').eq('run_id', run.id).eq('question_id', question.id).maybeSingle()
    const elapsed = now() - new Date(run.question_started_at).getTime()
    if (!answered && elapsed <= question.time_limit_seconds * 1000 + ANSWER_GRACE_MS) {
      res.status(409).json({ error: 'Answer this question first' })
      return
    }
    if (!answered) {
      await supabaseAdmin.rpc('quiz_practice_record', { p_run: run.id, p_question: question.id, p_chosen: null, p_text: null, p_correct: false, p_points: 0 })
    }
    const last = run.current_index + 1 >= questions.length
    const patch = last
      ? { finished_at: new Date(now()).toISOString(), current_index: run.current_index + 1 }
      : { current_index: run.current_index + 1, question_started_at: new Date(now()).toISOString() }
    const { data: updated, error } = await supabaseAdmin
      .from('quiz_practice_runs')
      .update(patch)
      .eq('id', run.id)
      .eq('current_index', run.current_index)
      .select('*')
      .maybeSingle()
    if (error) return fail(error, 'Could not move on')
    res.status(200).json(await view(updated ?? { ...run, ...patch }, questions, quiz))
  }
}

export default createQuizPracticeHandler(getSupabaseAdmin)
