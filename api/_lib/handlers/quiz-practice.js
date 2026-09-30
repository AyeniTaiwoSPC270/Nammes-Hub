import { getSupabaseAdmin } from '../supabaseAdmin.js'
import { isUuid } from '../validate.js'
import { logError } from '../logError.js'
import {
  validateNickname, isAvatarId, newPlayerToken, hashToken, createRateLimiter, clientIp, scoreAnswer, ANSWER_GRACE_MS,
  gradeAnswer, isChoiceType, correctText,
} from '../quiz.js'
import { sanitizeTheme } from '../quizTheme.js'
import { publicImageUrl } from '../quizImage.js'
import { botDecision, botNicknames, skillForBot, seeded, BOT_SKILL_CHOICES } from '../quizBots.js'

// Practice mode: one person replays a quiz on their own phone, no host. Questions are sent one at a time, so a player
// never receives a later question (or any answer) in advance. After each answer they see the result at once.
// Scoring uses the server's clock and the same rules as a live game (without streaks or power-ups). Polls are skipped.
// The practice leaderboard is for fun: because answers are shown straight away, a replay can learn them.
//
// One route with an `op`: info, start, state, answer, next, top.
const OPS = ['info', 'start', 'state', 'answer', 'next', 'top', 'list']

// A run can be raced against computer rivals or against recorded past runs ("ghosts"). Rivals only ever show their
// score up to the question the player has just answered, so nothing about a later question is given away.
const RACE_MODES = ['none', 'bots', 'ghosts']
const RIVALS = 4

// What one question is worth to someone who answered it right after `elapsedMs` (same rule as the player's own score).
function questionPoints(question, elapsedMs) {
  const base = scoreAnswer({ correct: true, points: question.points, timeLimitSeconds: question.time_limit_seconds, elapsedMs })
  return base * (question.points_multiplier === 2 ? 2 : 1)
}

// `count` past runs spread from the best to the weakest, so the field is a mix and not just the top scorers.
export function pickGhosts(runs, count = RIVALS) {
  const ranked = [...runs].sort((a, b) => b.total_score - a.total_score || String(a.id).localeCompare(String(b.id)))
  if (ranked.length <= count) return ranked
  return Array.from({ length: count }, (_, i) => ranked[Math.round((i * (ranked.length - 1)) / (count - 1))])
}

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
    const { op, quizId, token, nickname, avatarId = 0, chosenIndex, answerText, race = 'none', raceSkill = 'mixed' } = req.body ?? {}
    if (!OPS.includes(op)) {
      res.status(400).json({ error: 'Unknown request' })
      return
    }

    const supabaseAdmin = getClient()

    async function enabledQuiz(id) {
      if (!isUuid(id)) return null
      const { data } = await supabaseAdmin.from('quizzes').select('id, title, practice_enabled, battle_enabled, theme, expires_at').eq('id', id).maybeSingle()
      const expired = data?.expires_at && new Date(data.expires_at).getTime() < now()
      return data && data.practice_enabled && !expired ? data : null
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

    // The rivals' scores through question number `upto` (0-based), each with what they won on that last question.
    async function raceFor(run, questions, upto) {
      const mode = run.race_mode ?? 'none'
      if (mode === 'none' || upto < 0) return null
      const last = Math.min(upto, questions.length - 1)
      if (mode === 'bots') {
        const pool = botNicknames(50)
        const start = Math.floor(seeded(run.id, 9) * pool.length)
        const rivals = Array.from({ length: RIVALS }, (_, i) => {
          const id = `${run.id}:${i}`
          const skill = skillForBot(run.race_skill ?? 'mixed', i)
          let score = 0
          let gain = 0
          questions.slice(0, last + 1).forEach((q, n) => {
            const d = botDecision({ botId: id, skill, question: q, limitMs: q.time_limit_seconds * 1000 })
            const points = d.correct ? questionPoints(q, d.thinkMs) : 0
            score += points
            if (n === last) gain = points
          })
          return { id, kind: 'bot', nickname: pool[(start + i * 7) % pool.length], avatarId: Math.floor(seeded(id, 5) * 50), score, gain }
        })
        return { mode, rivals }
      }
      const ids = run.race_ghosts ?? []
      if (ids.length === 0) return { mode, rivals: [] }
      const [{ data: runs }, { data: answers }] = await Promise.all([
        supabaseAdmin.from('quiz_practice_runs').select('id, nickname, avatar_id').in('id', ids),
        supabaseAdmin.from('quiz_practice_answers').select('run_id, question_id, points_awarded').in('run_id', ids),
      ])
      const rivals = (runs ?? []).map((g) => {
        let score = 0
        let gain = 0
        questions.slice(0, last + 1).forEach((q, n) => {
          const points = (answers ?? []).find((a) => a.run_id === g.id && a.question_id === q.id)?.points_awarded ?? 0
          score += points
          if (n === last) gain = points
        })
        return { id: g.id, kind: 'ghost', nickname: g.nickname, avatarId: g.avatar_id, score, gain }
      })
      return { mode, rivals }
    }

    // What the player sees for their run right now.
    async function view(run, questions, quiz) {
      const total = questions.length
      const base = { serverNow: now(), total, score: run.total_score, nickname: run.nickname, avatarId: run.avatar_id, theme: sanitizeTheme(quiz?.theme, { quizId: run.quiz_id }) }
      if (run.finished_at || run.current_index >= total) {
        const { data: answers } = await supabaseAdmin.from('quiz_practice_answers').select('correct').eq('run_id', run.id)
        const correct = (answers ?? []).filter((a) => a.correct === true).length
        return { ...base, finished: true, correctCount: correct, race: await raceFor(run, questions, total - 1) }
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
      if (answer) {
        out.result = resultFor(question, answer)
        out.race = await raceFor(run, questions, run.current_index)
      }
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

    // ---- list: every quiz open for practice (for the public practice page) ----
    if (op === 'list') {
      const { data: quizzes } = await supabaseAdmin.from('quizzes').select('id, title, practice_enabled, battle_enabled, archived_at, is_custom').eq('practice_enabled', true)
      const out = []
      for (const q of (quizzes ?? []).filter((x) => !x.archived_at && !x.is_custom)) {
        const count = (await playableQuestions(q.id)).length
        if (count > 0) out.push({ id: q.id, title: q.title, questionCount: count, battleEnabled: q.battle_enabled === true })
      }
      res.status(200).json({ quizzes: out.sort((a, b) => a.title.localeCompare(b.title)) })
      return
    }

    // ---- info: is this quiz open for practice, and how big is it ----
    if (op === 'info') {
      const quiz = await enabledQuiz(quizId)
      if (!quiz) {
        res.status(404).json({ error: 'This quiz is not open for practice' })
        return
      }
      const questions = await playableQuestions(quiz.id)
      const { data: finished } = await supabaseAdmin.from('quiz_practice_runs').select('id').eq('quiz_id', quiz.id).not('finished_at', 'is', null)
      res.status(200).json({ title: quiz.title, questionCount: questions.length, battleEnabled: quiz.battle_enabled === true, ghostCount: (finished ?? []).length, theme: sanitizeTheme(quiz.theme, { quizId: quiz.id }) })
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
      if (!RACE_MODES.includes(race) || !BOT_SKILL_CHOICES.includes(raceSkill)) {
        res.status(400).json({ error: 'Pick who to race' })
        return
      }
      let ghosts = []
      if (race === 'ghosts') {
        const { data: past } = await supabaseAdmin.from('quiz_practice_runs').select('id, total_score').eq('quiz_id', quiz.id).not('finished_at', 'is', null)
        ghosts = pickGhosts(past ?? []).map((g) => g.id)
        if (ghosts.length === 0) {
          res.status(409).json({ error: 'Nobody has finished this practice yet, so there is nobody to race. Try racing the bots.' })
          return
        }
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
          race_mode: race,
          race_skill: race === 'bots' ? raceSkill : null,
          race_ghosts: ghosts,
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
    const { data: quiz } = await supabaseAdmin.from('quizzes').select('id, title, practice_enabled, theme, expires_at').eq('id', run.quiz_id).maybeSingle()
    if (!quiz || !quiz.practice_enabled || (quiz.expires_at && new Date(quiz.expires_at).getTime() < now())) {
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
      res.status(200).json({ result: resultFor(question, answer), score: fresh?.total_score ?? run.total_score + points, race: await raceFor(run, questions, run.current_index) })
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
