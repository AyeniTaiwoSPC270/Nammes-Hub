import { describe, it, expect } from 'vitest'
import { createQuizCbtHandler } from './handlers/quiz-cbt.js'
import { createQuizSetsHandler } from './handlers/quiz-sets.js'
import quizRouter from '../quiz.js'
import { fakeRes, fakeDb, anon } from './quizTestKit.js'

const START = Date.parse('2026-10-05T09:00:00.000Z')
const MIN = 60_000
const BANK = '44444444-4444-4444-8444-444444444444'
const COURSE = '55555555-5555-4555-8555-555555555555'
const EXAM = '66666666-6666-4666-8666-666666666666'

// Ten multiple-choice questions whose right answer is always option index 1, plus one typed and one number question.
const questions = [
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `m${i}`, quiz_id: BANK, position: i, type: 'multiple', text: `MCQ ${i}`, options: ['wrong1', 'right', 'wrong2', 'wrong3'], correct_index: 1,
    time_limit_seconds: 20, points: 1000, explanation: `Because ${i}`,
  })),
  { id: 't1', quiz_id: BANK, position: 10, type: 'text', text: 'Capital of France?', options: [], accepted_answers: ['Paris'], time_limit_seconds: 20, points: 1000, explanation: 'Paris is it' },
  { id: 'n1', quiz_id: BANK, position: 11, type: 'numeric', text: 'Days in a leap year?', options: [], numeric_answer: 366, numeric_tolerance: 0, time_limit_seconds: 20, points: 1000 },
  { id: 'p1', quiz_id: BANK, position: 12, type: 'poll', text: 'Fav?', options: ['a', 'b'], time_limit_seconds: 20, points: 1000 },
]

function world({ exam = {}, extra = {} } = {}) {
  const db = fakeDb({
    quizzes: [{ id: BANK, title: 'MTH 101 bank', is_cbt: true }],
    quiz_questions: questions.map((q) => ({ ...q })),
    cbt_courses: [{ id: COURSE, level: '100', code: 'MTH 101', title: 'Elementary Mathematics' }],
    cbt_exams: [{
      id: EXAM, course_id: COURSE, quiz_id: BANK, title: '2024/25 first semester', session_label: '2024/25', code: 'MTHAAA', published: true, mode: 'bank',
      draw_count: 6, duration_minutes: 30, pass_mark_percent: 50, shuffle_questions: true, shuffle_options: true, show_explanations: true, allow_study_mode: true, ...exam,
    }],
    ...extra,
  })
  let clock = START
  let seed = 0.37
  const opts = () => ({ now: () => clock, random: () => (seed = (seed * 7.31 + 0.137) % 1), cleanupChance: 0, allowStart: () => true, allow: () => true, allowRead: () => true })
  const call = async (body, over = {}) => {
    const res = fakeRes()
    await createQuizCbtHandler(() => db, { ...opts(), ...over })(anon(body), res)
    return res
  }
  const sets = async (body) => {
    const res = fakeRes()
    await createQuizSetsHandler(() => db, { now: () => clock, random: () => (seed = (seed * 7.31 + 0.137) % 1), cleanupChance: 0, allow: () => true, allowCreate: () => true })(anon(body), res)
    return res
  }
  const start = async (over = {}) => (await call({ op: 'start', code: 'MTHAAA', ...over })).body
  // Answers every question the way an attentive student would: the option text 'right', the typed and number answers.
  const answersFor = (view, wrong = 0) => {
    let n = 0
    const out = {}
    for (const q of view.questions) {
      const miss = n++ < wrong
      if (q.type === 'multiple') out[q.id] = { choice: miss ? q.options.indexOf('wrong1') : q.options.indexOf('right') }
      else if (q.type === 'text') out[q.id] = { text: miss ? 'Rome' : 'paris' }
      else out[q.id] = { text: miss ? '1' : '366' }
    }
    return out
  }
  return { db, call, sets, start, answersFor, at: (ms) => { clock = ms }, advance: (ms) => { clock += ms }, clock: () => clock }
}

describe('cbt: finding exams', () => {
  it('lists published exams by level and course, and filters by search', async () => {
    const w = world({
      extra: {
        cbt_courses: [
          { id: COURSE, level: '100', code: 'MTH 101', title: 'Elementary Mathematics' },
          { id: 'c2', level: '200', code: 'PHY 201', title: 'Waves' },
          { id: 'c3', level: '100', code: 'EMPTY 100', title: 'No exams' },
        ],
      },
    })
    const all = (await w.call({ op: 'list' })).body
    expect(all.levels).toEqual(['100', '200', '300', '400', '500', 'other'])
    expect(all.courses.map((c) => c.code)).toEqual(['MTH 101']) // courses with no published exam are hidden
    expect(all.courses[0].exams[0]).toMatchObject({ code: 'MTHAAA', bankSize: 12, questionsPerAttempt: 6, durationMinutes: 30, passMarkPercent: 50 })
    expect((await w.call({ op: 'list', q: 'mth' })).body.courses).toHaveLength(1)
    expect((await w.call({ op: 'list', q: 'chemistry' })).body.courses).toHaveLength(0)
    expect(JSON.stringify(all)).not.toContain('correct')
  })

  it('hides unpublished exams and unknown codes', async () => {
    const w = world({ exam: { published: false } })
    expect((await w.call({ op: 'list' })).body.courses).toEqual([])
    expect((await w.call({ op: 'info', code: 'MTHAAA' })).statusCode).toBe(404)
    expect((await w.call({ op: 'info', code: 'ZZZZZZ' })).statusCode).toBe(404)
    expect((await w.call({ op: 'info', code: 'no' })).statusCode).toBe(404)
  })

  it('describes an exam for its start page', async () => {
    const w = world()
    const info = (await w.call({ op: 'info', code: 'mthaaa' })).body
    expect(info).toMatchObject({
      kind: 'exam', code: 'MTHAAA', title: '2024/25 first semester', course: { code: 'MTH 101', level: '100' },
      questionsPerAttempt: 6, bankSize: 12, durationMinutes: 30, passMarkPercent: 50, allowStudyMode: true,
    })
  })

  it('does not count polls in the bank', async () => {
    const w = world({ exam: { draw_count: null } })
    expect((await w.call({ op: 'info', code: 'MTHAAA' })).body).toMatchObject({ bankSize: 12, questionsPerAttempt: 12 })
  })
})

describe('cbt: starting', () => {
  it('draws a paper and never sends the answer key', async () => {
    const w = world()
    const res = await w.call({ op: 'start', code: 'MTHAAA' })
    expect(res.statusCode).toBe(200)
    const view = res.body
    expect(view.questions).toHaveLength(6)
    expect(view).toMatchObject({ status: 'running', mode: 'exam', total: 6, passMarkPercent: 50 })
    expect(view.deadlineAt).toBe(new Date(START + 30 * MIN).toISOString())
    const text = JSON.stringify(view)
    for (const secret of ['correct_index', 'accepted_answers', 'numeric_answer', 'Because', 'Paris is it', 'explanation']) expect(text).not.toContain(secret)
    expect(view.questions.every((q) => q.id !== 'p1')).toBe(true)
    expect(view.token).toBeTruthy()
    const stored = w.db.tables.cbt_attempts[0]
    expect(stored.token_hash).not.toBe(view.token)
    expect(JSON.stringify(stored)).not.toContain(view.token)
  })

  it('gives different papers to different attempts', async () => {
    const w = world()
    const a = (await w.start()).questions.map((q) => q.id).join()
    const b = (await w.start()).questions.map((q) => q.id).join()
    expect(a).not.toBe(b)
  })

  it('study mode has no clock and can be switched off', async () => {
    const w = world()
    const study = await w.start({ mode: 'study' })
    expect(study).toMatchObject({ mode: 'study', deadlineAt: null })
    const off = world({ exam: { allow_study_mode: false } })
    expect((await off.call({ op: 'start', code: 'MTHAAA', mode: 'study' })).statusCode).toBe(400)
  })

  it('refuses unknown or empty exams and respects the start limit', async () => {
    const w = world()
    expect((await w.call({ op: 'start', code: 'ZZZZZZ' })).statusCode).toBe(404)
    const empty = world({ extra: { quiz_questions: [] } })
    expect((await empty.call({ op: 'start', code: 'MTHAAA' })).statusCode).toBe(404)
    expect((await w.call({ op: 'start', code: 'MTHAAA' }, { allowStart: () => false })).statusCode).toBe(429)
  })
})

describe('cbt: taking an exam', () => {
  it('saves answers, resumes with the same paper and clock, then grades on submit', async () => {
    const w = world({ exam: { draw_count: null } })
    const view = await w.start()
    expect(view.questions).toHaveLength(12)
    const answers = w.answersFor(view, 3)
    const flagged = [view.questions[0].id]
    expect((await w.call({ op: 'save', token: view.token, answers, flagged })).body).toMatchObject({ status: 'running' })

    w.advance(5 * MIN)
    const back = (await w.call({ op: 'resume', token: view.token })).body
    expect(back.questions.map((q) => q.id)).toEqual(view.questions.map((q) => q.id))
    expect(back.questions.map((q) => q.options)).toEqual(view.questions.map((q) => q.options)) // same answer order
    expect(back.answers).toEqual(answers)
    expect(back.flagged).toEqual(flagged)
    expect(back.deadlineAt).toBe(view.deadlineAt)
    expect(back.serverNow).toBe(START + 5 * MIN)

    w.advance(5 * MIN)
    const res = await w.call({ op: 'submit', token: view.token })
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ status: 'submitted', mode: 'exam', score: 9, total: 12, percent: 75, passed: true, passMarkPercent: 50, secondsUsed: 600 })
    expect(res.body.review).toHaveLength(12)
    const wrong = res.body.review.filter((r) => !r.correct)
    expect(wrong).toHaveLength(3)
    const mcq = res.body.review.find((r) => r.type === 'multiple' && r.correct)
    expect(mcq.options[mcq.correctIndex]).toBe('right')
    expect(mcq.explanation).toMatch(/Because/)
    expect(res.body.review.find((r) => r.id === view.questions[0].id).flagged).toBe(true)
    expect(w.db.tables.cbt_attempts[0]).toMatchObject({ score: 9, total: 12 })
  })

  it('submit sends the final answers along and is safe to repeat', async () => {
    const w = world({ exam: { draw_count: null } })
    const view = await w.start()
    const first = await w.call({ op: 'submit', token: view.token, answers: w.answersFor(view) })
    expect(first.body).toMatchObject({ score: 12, total: 12 })
    const again = await w.call({ op: 'submit', token: view.token, answers: w.answersFor(view, 12) })
    expect(again.body).toMatchObject({ score: 12, total: 12 }) // the second call cannot change a closed attempt
    expect((await w.call({ op: 'resume', token: view.token })).body).toMatchObject({ status: 'submitted', score: 12 })
    expect(w.db.tables.cbt_attempts).toHaveLength(1)
  })

  it('scores an empty paper as zero and fails it', async () => {
    const w = world()
    const view = await w.start()
    const res = await w.call({ op: 'submit', token: view.token })
    expect(res.body).toMatchObject({ score: 0, total: 6, percent: 0, passed: false })
    expect(res.body.review.every((r) => r.answered === false)).toBe(true)
  })

  it('ignores answers to questions that are not in the paper and bad shapes', async () => {
    const w = world()
    const view = await w.start()
    const real = view.questions[0]
    const sent = { [real.id]: { choice: 99 }, m9999: { choice: 0 }, [view.questions[1].id]: { choice: 'x' } }
    await w.call({ op: 'save', token: view.token, answers: sent })
    expect(w.db.tables.cbt_attempts[0].answers).toEqual({})
  })

  it('clearing an answer removes it, and a flagged question must be part of the paper', async () => {
    const w = world()
    const view = await w.start()
    const id = view.questions[0].id
    await w.call({ op: 'save', token: view.token, answers: { [id]: { choice: 0 } }, flagged: [id, 'bogus'] })
    expect(w.db.tables.cbt_attempts[0].flagged).toEqual([id])
    await w.call({ op: 'save', token: view.token, answers: {} })
    expect(w.db.tables.cbt_attempts[0].answers).toEqual({})
  })

  it('maps shuffled answers back correctly', async () => {
    const w = world({ exam: { draw_count: null, shuffle_options: true } })
    const view = await w.start()
    const q = view.questions.find((x) => x.type === 'multiple')
    const shown = q.options.indexOf('wrong2')
    await w.call({ op: 'save', token: view.token, answers: { [q.id]: { choice: shown } } })
    const stored = w.db.tables.cbt_attempts[0].answers[q.id]
    expect(stored.chosen_index).toBe(2) // 'wrong2' is the third option in the question as typed
    const done = await w.call({ op: 'submit', token: view.token })
    const row = done.body.review.find((r) => r.id === q.id)
    expect(row).toMatchObject({ chosen: shown, correct: false })
    expect(row.options[row.correctIndex]).toBe('right')
  })

  it('needs a real attempt token', async () => {
    const w = world()
    expect((await w.call({ op: 'save', answers: {} })).statusCode).toBe(400)
    expect((await w.call({ op: 'save', token: 'x'.repeat(40), answers: {} })).statusCode).toBe(401)
    expect((await w.call({ op: 'submit', token: 'x'.repeat(40) })).statusCode).toBe(401)
  })
})

describe('cbt: the clock', () => {
  it('accepts saves in the grace period after the deadline', async () => {
    const w = world({ exam: { draw_count: null } })
    const view = await w.start()
    w.at(START + 30 * MIN + 5_000)
    const res = await w.call({ op: 'submit', token: view.token, answers: w.answersFor(view) })
    expect(res.body).toMatchObject({ score: 12 })
  })

  it('grades only what was saved once time is up, whatever is sent late', async () => {
    const w = world({ exam: { draw_count: null } })
    const view = await w.start()
    await w.call({ op: 'save', token: view.token, answers: w.answersFor(view, 6) })
    w.at(START + 30 * MIN + 11_000)
    const res = await w.call({ op: 'submit', token: view.token, answers: w.answersFor(view) })
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ score: 6, total: 12, secondsUsed: 30 * 60 }) // closed at the deadline, not when the call arrived
    const save = await w.call({ op: 'save', token: view.token, answers: w.answersFor(view) })
    expect(save.body.status).toBe('submitted')
    expect(w.db.tables.cbt_attempts[0].score).toBe(6)
  })

  it('submits a forgotten exam by itself when the student comes back', async () => {
    const w = world()
    const view = await w.start()
    w.advance(3 * 60 * MIN)
    const back = await w.call({ op: 'resume', token: view.token })
    expect(back.body).toMatchObject({ status: 'submitted', score: 0 })
  })

  it('keeps a result readable for 24 hours', async () => {
    const w = world()
    const view = await w.start()
    await w.call({ op: 'submit', token: view.token })
    w.advance(23 * 60 * MIN)
    expect((await w.call({ op: 'resume', token: view.token })).statusCode).toBe(200)
    w.advance(2 * 60 * MIN)
    expect((await w.call({ op: 'resume', token: view.token })).statusCode).toBe(410)
  })

  it('study mode never runs out of time', async () => {
    const w = world()
    const view = await w.start({ mode: 'study' })
    w.advance(48 * 60 * MIN)
    expect((await w.call({ op: 'resume', token: view.token })).body.status).toBe('running')
  })
})

describe('cbt: study mode', () => {
  it('shows the answer after each check and locks it in', async () => {
    const w = world({ exam: { draw_count: null } })
    const view = await w.start({ mode: 'study' })
    const q = view.questions.find((x) => x.type === 'multiple')
    const wrong = q.options.indexOf('wrong3')
    const first = await w.call({ op: 'check', token: view.token, questionId: q.id, choice: wrong })
    expect(first.body.feedback).toMatchObject({ correct: false })
    expect(first.body.feedback.explanation).toMatch(/Because/)
    expect(view.questions.find((x) => x.id === q.id).options[first.body.feedback.correctIndex]).toBe('right')
    // changing the answer later does not change what was recorded
    const second = await w.call({ op: 'check', token: view.token, questionId: q.id, choice: q.options.indexOf('right') })
    expect(second.body.feedback.correct).toBe(false)
    const back = (await w.call({ op: 'resume', token: view.token })).body
    expect(back.feedback[q.id].correct).toBe(false)
    expect(back.answers[q.id]).toEqual({ choice: wrong })
  })

  it('checks typed answers and refuses empty ones', async () => {
    const w = world({ exam: { draw_count: null } })
    const view = await w.start({ mode: 'study' })
    const t = view.questions.find((x) => x.type === 'text')
    expect((await w.call({ op: 'check', token: view.token, questionId: t.id, text: '' })).statusCode).toBe(400)
    const ok = await w.call({ op: 'check', token: view.token, questionId: t.id, text: 'paris' })
    expect(ok.body.feedback).toMatchObject({ correct: true, correctText: 'Paris' })
    expect((await w.call({ op: 'check', token: view.token, questionId: 'nope', text: 'x' })).statusCode).toBe(400)
  })

  it('is not available in an exam (answers wait until submit)', async () => {
    const w = world()
    const view = await w.start()
    expect((await w.call({ op: 'check', token: view.token, questionId: view.questions[0].id, choice: 0 })).statusCode).toBe(400)
  })

  it('study attempts are marked and can be submitted for a score', async () => {
    const w = world({ exam: { draw_count: null } })
    const view = await w.start({ mode: 'study' })
    const res = await w.call({ op: 'submit', token: view.token })
    expect(res.body).toMatchObject({ mode: 'study', score: 0, total: 12 })
    expect(w.db.tables.cbt_attempts[0].mode).toBe('study')
  })
})

describe('cbt: hiding explanations and removed questions', () => {
  it('leaves explanations out when the exam turns them off', async () => {
    const w = world({ exam: { show_explanations: false } })
    const view = await w.start()
    const res = await w.call({ op: 'submit', token: view.token })
    expect(res.body.review.every((r) => r.explanation === null)).toBe(true)
  })

  it('tells the student to start again if the whole bank was replaced mid-exam', async () => {
    const w = world()
    const view = await w.start()
    w.db.tables.quiz_questions = []
    expect((await w.call({ op: 'resume', token: view.token })).statusCode).toBe(410)
  })
})

describe('cbt: students’ own exams', () => {
  const own = [
    { type: 'multiple', text: 'Capital of Ghana?', options: ['Lagos', 'Accra', 'Kumasi'], correct_index: 1, explanation: 'Accra it is' },
    { type: 'truefalse', text: 'The sun is a star.', correct_index: 0 },
    { type: 'numeric', text: 'Days in a leap year?', numeric_answer: '366' },
  ]

  it('can be made with settings and kept for a chosen time, then taken by code', async () => {
    const w = world({ extra: { cbt_exams: [], cbt_courses: [] } })
    const made = (await w.sets({ op: 'create', title: 'My revision', questions: own, days: 90, settings: { duration_minutes: 7, pass_mark_percent: 60, shuffle_questions: false } })).body
    const row = w.db.tables.quizzes.find((q) => q.id === made.quizId)
    expect(row.expires_at).toBe(new Date(START + 90 * 86_400_000).toISOString())
    expect(row.cbt_settings).toMatchObject({ duration_minutes: 7, pass_mark_percent: 60, shuffle_questions: false })
    expect(w.db.tables.quiz_questions.find((q) => q.quiz_id === made.quizId && q.type === 'multiple').explanation).toBe('Accra it is')

    const info = (await w.call({ op: 'info', code: made.code })).body
    expect(info).toMatchObject({ kind: 'personal', title: 'My revision', questionsPerAttempt: 3, durationMinutes: 7, passMarkPercent: 60, course: null })
    const view = await w.start({ code: made.code })
    expect(view.questions).toHaveLength(3)
    expect(new Date(view.deadlineAt).getTime()).toBe(START + 7 * MIN)
    const done = await w.call({ op: 'submit', token: view.token })
    expect(done.body).toMatchObject({ total: 3, score: 0 })
  })

  it('accepts up to 100 questions and only the three keep-for choices', async () => {
    const w = world({ extra: { cbt_exams: [], cbt_courses: [] } })
    const many = Array.from({ length: 100 }, (_, i) => ({ type: 'truefalse', text: `Statement ${i}`, correct_index: 0 }))
    const ok = await w.sets({ op: 'create', title: 'A hundred', questions: many, days: 12 })
    expect(ok.statusCode).toBe(200)
    expect(w.db.tables.quizzes.find((q) => q.is_custom).expires_at).toBe(new Date(START + 30 * 86_400_000).toISOString()) // 12 is not a choice, so 30
    const tooMany = await w.sets({ op: 'create', title: 'Too many', questions: [...many, many[0]] })
    expect(tooMany.statusCode).toBe(400)
  })

  it('can be extended by its maker only', async () => {
    const w = world({ extra: { cbt_exams: [], cbt_courses: [] } })
    const made = (await w.sets({ op: 'create', title: 'My revision', questions: own })).body
    w.advance(10 * 86_400_000)
    expect((await w.sets({ op: 'extend', code: made.code, manageToken: 'wrong', days: 180 })).statusCode).toBe(404)
    const ok = await w.sets({ op: 'extend', code: made.code, manageToken: made.manageToken, days: 180 })
    expect(ok.statusCode).toBe(200)
    expect(ok.body.expiresAt).toBe(new Date(w.clock() + 180 * 86_400_000).toISOString())
  })

  it('is gone after it expires', async () => {
    const w = world({ extra: { cbt_exams: [], cbt_courses: [] } })
    const made = (await w.sets({ op: 'create', title: 'My revision', questions: own })).body
    w.advance(31 * 86_400_000)
    expect((await w.call({ op: 'info', code: made.code })).statusCode).toBe(404)
  })

  it('never appears in the course lists', async () => {
    const w = world()
    await w.sets({ op: 'create', title: 'My revision', questions: own })
    expect((await w.call({ op: 'list' })).body.courses).toHaveLength(1)
  })
})

describe('cbt: the route', () => {
  it('is reachable through the quiz router', async () => {
    const res = fakeRes()
    await quizRouter({ query: { action: 'cbt' }, method: 'GET', headers: {}, body: {} }, res)
    expect(res.statusCode).toBe(405)
  })

  it('rejects unknown operations', async () => {
    const w = world()
    expect((await w.call({ op: 'nope' })).statusCode).toBe(400)
  })
})
