import { getSupabaseAdmin } from '../supabaseAdmin.js'
import { logError } from '../logError.js'
import { newPlayerToken, hashToken, createRateLimiter, clientIp } from '../quiz.js'
import { isBattleCode } from '../quizBattle.js'
import {
  CBT_GRACE_MS, CBT_RESULT_TTL_MS, CBT_LEVELS, cleanCbtSettings, buildAttempt, publicQuestion, readAnswer, readAnswers, gradeAttempt,
  reviewQuestion, percentOf,
} from '../cbt.js'

// CBT practice exams. A student takes a timed paper drawn from a course's question bank (or from a quiz they made
// themselves), then sees a score and a review. The server is the only one who knows the answers: the browser gets the
// questions without the key and learns what was right only after submitting (or, in study mode, after each answer).
// The server also owns the clock: the deadline is fixed when the attempt starts. Identity is a secret token per attempt;
// only its hash is stored.
//
// One route with an `op`: list, info, start, resume, save, check, submit.
const OPS = ['list', 'info', 'start', 'resume', 'save', 'check', 'submit']

export function createQuizCbtHandler(
  getClient,
  {
    now = () => Date.now(),
    allowStart = createRateLimiter({ max: 30, windowMs: 60 * 60_000 }),
    allow = createRateLimiter({ max: 180, windowMs: 60_000 }),
    allowRead = createRateLimiter({ max: 90, windowMs: 60_000 }),
    cleanupChance = 0.03,
    random = Math.random,
  } = {},
) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    const body = req.body ?? {}
    const { op, code, token } = body
    if (!OPS.includes(op)) {
      res.status(400).json({ error: 'Unknown request' })
      return
    }
    const db = getClient()
    const iso = (ms) => new Date(ms).toISOString()
    const fail = async (error, message) => {
      console.error(`quiz-cbt: ${op} failed`, error)
      await logError(db, 'quiz-cbt', error, 500)
      res.status(500).json({ error: message })
    }
    const gone = (message) => {
      res.status(404).json({ error: message })
      return null
    }

    // ---- finding what to take: a published course exam, or a student's own exam, by its 6-character code ----
    async function bankOf(quizId) {
      const { data } = await db.from('quiz_questions').select('*').eq('quiz_id', quizId)
      return (data ?? []).filter((q) => (q.type ?? 'multiple') !== 'poll')
    }
    async function bankSize(quizId) {
      const { count } = await db.from('quiz_questions').select('id', { count: 'exact', head: true }).eq('quiz_id', quizId).neq('type', 'poll')
      return count ?? 0
    }
    async function findTarget(rawCode) {
      if (!isBattleCode(rawCode)) return null
      const wanted = rawCode.toUpperCase()
      const { data: exam } = await db.from('cbt_exams').select('*').eq('code', wanted).maybeSingle()
      if (exam) {
        if (!exam.published) return null
        const { data: course } = await db.from('cbt_courses').select('*').eq('id', exam.course_id).maybeSingle()
        const size = await bankSize(exam.quiz_id)
        return { kind: 'exam', code: wanted, examId: exam.id, quizId: exam.quiz_id, title: exam.title, session: exam.session_label ?? null, course, settings: cleanCbtSettings(exam, size), bankSize: size }
      }
      const { data: quiz } = await db.from('quizzes').select('id, title, is_custom, expires_at, cbt_settings').eq('custom_code', wanted).maybeSingle()
      if (!quiz || !quiz.is_custom || (quiz.expires_at && new Date(quiz.expires_at).getTime() < now())) return null
      const size = await bankSize(quiz.id)
      return { kind: 'personal', code: wanted, examId: null, quizId: quiz.id, title: quiz.title, session: null, course: null, settings: cleanCbtSettings(quiz.cbt_settings, size), bankSize: size, expiresAt: quiz.expires_at }
    }
    const describe = (t) => ({
      kind: t.kind,
      code: t.code,
      title: t.title,
      session: t.session,
      course: t.course ? { code: t.course.code, title: t.course.title, level: t.course.level } : null,
      questionsPerAttempt: t.settings.questionsPerAttempt,
      bankSize: t.bankSize,
      durationMinutes: t.settings.durationMinutes,
      passMarkPercent: t.settings.passMarkPercent,
      allowStudyMode: t.settings.allowStudyMode,
      showExplanations: t.settings.showExplanations,
      expiresAt: t.expiresAt ?? null,
    })

    // ---- list: every published course exam, grouped by course (for /cbt) ----
    if (op === 'list') {
      if (!allowRead(`list:${clientIp(req)}`)) {
        res.status(429).json({ error: 'Slow down' })
        return
      }
      const [{ data: courses }, { data: exams }] = await Promise.all([db.from('cbt_courses').select('*'), db.from('cbt_exams').select('*').eq('published', true)])
      const sizes = new Map()
      await Promise.all((exams ?? []).map(async (e) => sizes.set(e.id, await bankSize(e.quiz_id))))
      const needle = typeof body.q === 'string' ? body.q.trim().toLowerCase() : ''
      const out = []
      for (const c of courses ?? []) {
        const items = (exams ?? [])
          .filter((e) => e.course_id === c.id && (sizes.get(e.id) ?? 0) > 0)
          .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')) || a.title.localeCompare(b.title))
          .map((e) => {
            const s = cleanCbtSettings(e, sizes.get(e.id))
            return { code: e.code, title: e.title, session: e.session_label ?? null, bankSize: sizes.get(e.id), questionsPerAttempt: s.questionsPerAttempt, durationMinutes: s.durationMinutes, passMarkPercent: s.passMarkPercent }
          })
        if (items.length === 0) continue
        if (needle && !`${c.code} ${c.title}`.toLowerCase().includes(needle)) continue
        out.push({ level: c.level, code: c.code, title: c.title, exams: items })
      }
      out.sort((a, b) => CBT_LEVELS.indexOf(a.level) - CBT_LEVELS.indexOf(b.level) || a.code.localeCompare(b.code))
      res.status(200).json({ levels: CBT_LEVELS, courses: out })
      return
    }

    // ---- info: one exam's details, for its start page ----
    if (op === 'info') {
      if (!allowRead(`info:${clientIp(req)}`)) {
        res.status(429).json({ error: 'Slow down' })
        return
      }
      const target = await findTarget(code)
      if (!target || target.bankSize === 0) return gone('No exam found with that code. It may have been removed or expired.')
      res.status(200).json(describe(target))
      return
    }

    // ---- start: draw a paper and begin the clock ----
    if (op === 'start') {
      const target = await findTarget(code)
      if (!target || target.bankSize === 0) return gone('No exam found with that code. It may have been removed or expired.')
      const mode = body.mode === 'study' ? 'study' : 'exam'
      if (mode === 'study' && !target.settings.allowStudyMode) {
        res.status(400).json({ error: 'Study mode is not available for this exam.' })
        return
      }
      if (!allowStart(clientIp(req))) {
        res.status(429).json({ error: 'You have started a lot of exams. Try again later.' })
        return
      }
      const bank = await bankOf(target.quizId)
      const drawn = buildAttempt(bank, target.settings, random)
      if (drawn.questionIds.length === 0) return gone('This exam has no questions yet.')
      const secret = newPlayerToken()
      const startedMs = now()
      const { data: attempt, error } = await db
        .from('cbt_attempts')
        .insert({
          exam_id: target.examId,
          quiz_id: target.quizId,
          token_hash: hashToken(secret),
          mode,
          question_ids: drawn.questionIds,
          option_orders: drawn.optionOrders,
          answers: {},
          flagged: [],
          pass_mark_percent: target.settings.passMarkPercent,
          started_at: iso(startedMs),
          deadline_at: mode === 'exam' ? iso(startedMs + target.settings.durationMinutes * 60_000) : null,
          results: [],
        })
        .select('*')
        .single()
      if (error || !attempt) return fail(error, 'Could not start the exam')
      if (random() < cleanupChance) await db.rpc('cbt_cleanup') // housekeeping, best effort
      const byId = new Map(bank.map((q) => [q.id, q]))
      const questions = drawn.questionIds.map((id) => byId.get(id))
      res.status(200).json({ token: secret, ...runningView(attempt, questions, target) })
      return
    }

    // ---- everything below belongs to one attempt, found by its token ----
    if (typeof token !== 'string' || token.length < 16) {
      res.status(400).json({ error: 'token is required' })
      return
    }
    const hash = hashToken(token)
    if (!allow(hash)) {
      res.status(429).json({ error: 'Slow down' })
      return
    }
    const { data: attempt } = await db.from('cbt_attempts').select('*').eq('token_hash', hash).maybeSingle()
    if (!attempt) {
      res.status(401).json({ error: 'Exam session not found. Start again.' })
      return
    }

    // The questions of this attempt, in the order they were shown. A question the admin has since removed is dropped.
    async function questionsOf(a) {
      const { data } = await db.from('quiz_questions').select('*').in('id', a.question_ids)
      const byId = new Map((data ?? []).map((q) => [q.id, q]))
      return a.question_ids.map((id) => byId.get(id)).filter(Boolean)
    }
    async function describeAttempt(a) {
      if (a.exam_id) {
        const { data: exam } = await db.from('cbt_exams').select('title, show_explanations, session_label').eq('id', a.exam_id).maybeSingle()
        return { title: exam?.title ?? 'Exam', explanations: exam ? exam.show_explanations !== false : true }
      }
      const { data: quiz } = await db.from('quizzes').select('title').eq('id', a.quiz_id).maybeSingle()
      return { title: quiz?.title ?? 'Exam', explanations: true }
    }

    function displayAnswers(a, questions) {
      const out = {}
      for (const q of questions) {
        const stored = a.answers?.[q.id]
        if (!stored) continue
        const order = a.option_orders?.[q.id]
        if (stored.chosen_index != null) out[q.id] = { choice: (order ?? q.options.map((_, i) => i)).indexOf(stored.chosen_index) }
        else out[q.id] = { text: stored.answer_text }
      }
      return out
    }

    function runningView(a, questions, target) {
      const view = {
        status: 'running',
        mode: a.mode,
        title: target.title,
        serverNow: now(),
        startedAt: a.started_at,
        deadlineAt: a.deadline_at,
        total: questions.length,
        passMarkPercent: a.pass_mark_percent,
        questions: questions.map((q) => publicQuestion(q, a.option_orders?.[q.id])),
        answers: displayAnswers(a, questions),
        flagged: a.flagged ?? [],
      }
      if (a.mode === 'study') {
        view.feedback = {}
        for (const q of questions) {
          if (a.answers?.[q.id]) view.feedback[q.id] = feedbackFor(q, a, target.explanations ?? target.settings?.showExplanations !== false)
        }
      }
      return view
    }

    function feedbackFor(q, a, explanations) {
      const r = reviewQuestion(q, a.option_orders?.[q.id], a.answers?.[q.id], { explanations })
      return { correct: r.correct, correctIndex: r.correctIndex, correctText: r.correctText, explanation: r.explanation }
    }

    // Grades the attempt and closes it. Safe to call twice: the second caller gets the first one's result.
    async function finalize(a, questions, answers, flagged, submittedMs) {
      const graded = gradeAttempt(questions, answers)
      const { data: done } = await db
        .from('cbt_attempts')
        .update({ submitted_at: iso(submittedMs), score: graded.score, total: graded.total, results: graded.results, answers, flagged })
        .eq('id', a.id)
        .is('submitted_at', null)
        .select('id')
      if (!done || done.length === 0) {
        const { data: fresh } = await db.from('cbt_attempts').select('*').eq('id', a.id).maybeSingle()
        return fresh ?? a
      }
      return { ...a, submitted_at: iso(submittedMs), score: graded.score, total: graded.total, results: graded.results, answers, flagged }
    }

    async function resultView(a, questions) {
      const info = await describeAttempt(a)
      const flagged = new Set(a.flagged ?? [])
      const review = questions.map((q) => reviewQuestion(q, a.option_orders?.[q.id], a.answers?.[q.id], { flagged: flagged.has(q.id), explanations: info.explanations }))
      const score = review.filter((r) => r.correct).length
      const total = review.length
      return {
        status: 'submitted',
        mode: a.mode,
        title: info.title,
        score,
        total,
        percent: percentOf(score, total),
        passed: percentOf(score, total) >= a.pass_mark_percent,
        passMarkPercent: a.pass_mark_percent,
        secondsUsed: Math.max(0, Math.round((new Date(a.submitted_at).getTime() - new Date(a.started_at).getTime()) / 1000)),
        review,
      }
    }

    async function respondWithResult(a) {
      if (now() - new Date(a.submitted_at).getTime() > CBT_RESULT_TTL_MS) {
        res.status(410).json({ error: 'This result is no longer stored. Your score is kept in your device history.' })
        return
      }
      const questions = await questionsOf(a)
      res.status(200).json(await resultView(a, questions))
    }

    if (attempt.submitted_at) return respondWithResult(attempt)

    const questions = await questionsOf(attempt)
    if (questions.length === 0) {
      res.status(410).json({ error: 'This exam was updated while you were taking it. Please start again.' })
      return
    }
    const deadlineMs = attempt.deadline_at ? new Date(attempt.deadline_at).getTime() : null
    const pastGrace = deadlineMs !== null && now() > deadlineMs + CBT_GRACE_MS
    const pastDeadline = deadlineMs !== null && now() > deadlineMs

    // Time is up: whatever was saved is what gets graded.
    if (pastGrace) {
      const closed = await finalize(attempt, questions, attempt.answers ?? {}, attempt.flagged ?? [], deadlineMs)
      return respondWithResult(closed)
    }

    const knownIds = new Set(attempt.question_ids)
    const sentFlags = Array.isArray(body.flagged) ? [...new Set(body.flagged.filter((id) => typeof id === 'string' && knownIds.has(id)))] : null

    if (op === 'resume') {
      const target = await describeAttempt(attempt)
      res.status(200).json(runningView(attempt, questions, { title: target.title, explanations: target.explanations }))
      return
    }

    if (op === 'save') {
      const patch = {}
      if (attempt.mode === 'exam' && body.answers) patch.answers = readAnswers(questions, attempt.option_orders, body.answers)
      if (sentFlags) patch.flagged = sentFlags
      if (Object.keys(patch).length > 0) {
        const { error } = await db.from('cbt_attempts').update(patch).eq('id', attempt.id).is('submitted_at', null)
        if (error) return fail(error, 'Could not save your answers')
      }
      res.status(200).json({ status: 'running', serverNow: now(), deadlineAt: attempt.deadline_at, overtime: pastDeadline })
      return
    }

    if (op === 'check') {
      if (attempt.mode !== 'study') {
        res.status(400).json({ error: 'Answers are shown after you submit.' })
        return
      }
      const question = questions.find((q) => q.id === body.questionId)
      if (!question) {
        res.status(400).json({ error: 'That question is not part of this exam.' })
        return
      }
      const info = await describeAttempt(attempt)
      if (!attempt.answers?.[question.id]) {
        const read = readAnswer(question, attempt.option_orders?.[question.id], { choice: body.choice, text: body.text })
        if (!read) {
          res.status(400).json({ error: 'Choose or type an answer first.' })
          return
        }
        attempt.answers = { ...(attempt.answers ?? {}), [question.id]: read }
        const { error } = await db.from('cbt_attempts').update({ answers: attempt.answers }).eq('id', attempt.id).is('submitted_at', null)
        if (error) return fail(error, 'Could not check your answer')
      }
      res.status(200).json({ status: 'running', feedback: feedbackFor(question, attempt, info.explanations), answer: displayAnswers(attempt, [question])[question.id] })
      return
    }

    // submit
    const answers = attempt.mode === 'exam' && body.answers ? readAnswers(questions, attempt.option_orders, body.answers) : attempt.answers ?? {}
    const closed = await finalize(attempt, questions, answers, sentFlags ?? attempt.flagged ?? [], now())
    return respondWithResult(closed)
  }
}

export default createQuizCbtHandler(getSupabaseAdmin)
