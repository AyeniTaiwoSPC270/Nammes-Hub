import { describe, it, expect } from 'vitest'
import { createQuizCreateHandler } from './handlers/quiz-create.js'
import { fakeDb, fakeRes, QUIZ, admin } from './quizTestKit.js'
import { hashToken } from './quiz.js'
import { createQuizStateHandler } from './handlers/quiz-state.js'
import { createQuizAnswerHandler } from './handlers/quiz-answer.js'

// What a hosted game freezes onto its session when it starts, read back through the handlers a phone uses. This is the one
// place that ties the draw, the session columns and the wire format together.

const SESSION = '33333333-3333-4333-8333-333333333333'
const PLAYER = '44444444-4444-4444-8444-444444444444'

const rows = Array.from({ length: 10 }, (_, i) => ({
  id: `q${i}`, quiz_id: QUIZ, position: i, type: 'multiple', text: `Q${i}?`,
  options: ['a', 'b', 'c', 'd'], correct_index: 1, time_limit_seconds: 20, points: 1000,
}))

function world(drawSettings = null) {
  const db = fakeDb({
    quizzes: [{ id: QUIZ, title: 'Maths', max_players: 40, theme: {}, draw_settings: drawSettings }],
    quiz_questions: rows.map((r) => ({ ...r })),
    quiz_sessions: [],
    quiz_players: [],
    quiz_player_tokens: [],
    quiz_answers: [],
    quiz_powerup_uses: [],
  })
  const create = async (over = {}) => {
    const res = fakeRes()
    await createQuizCreateHandler(() => db, { makeCode: () => '123456' })(admin({ quizId: QUIZ, ...over }), res)
    return res
  }
  return { db, create }
}

const startPlaying = (db) => {
  const session = db.tables.quiz_sessions[0]
  session.state = 'question'
  session.current_question_index = 0
  session.question_started_at = new Date(Date.now() - 1000).toISOString()
  db.tables.quiz_players.push({ id: PLAYER, session_id: session.id, nickname: 'Ada', total_score: 0, avatar_id: 0, streak: 0, powerups_used: [] })
  db.tables.quiz_player_tokens.push({ player_id: PLAYER, token_hash: hashToken('tok') })
  return session
}

describe('starting a game freezes its questions', () => {
  it('freezes the whole bank in order for a quiz with no settings', async () => {
    const { db, create } = world(null)
    expect((await create()).statusCode).toBe(200)
    const session = db.tables.quiz_sessions[0]
    expect(session.question_ids).toHaveLength(10)
    expect(session.question_ids).toEqual(rows.map((r) => r.id))
    // Answers as written, because a quiz that predates question banks has no shuffles set.
    for (const order of Object.values(session.option_orders)) expect(order).toEqual([0, 1, 2, 3])
  })

  it('freezes the drawn number of questions, not the whole bank', async () => {
    const { db, create } = world({ draw_count: 4 })
    await create()
    const session = db.tables.quiz_sessions[0]
    expect(session.question_ids).toHaveLength(4)
    expect(new Set(session.question_ids).size).toBe(4) // never the same question twice
  })

  it('freezes a different mix each time the same quiz is hosted again', async () => {
    const first = world({ draw_count: 4 })
    await first.create()
    const second = world({ draw_count: 4 })
    await second.create()
    const a = first.db.tables.quiz_sessions[0].question_ids
    const b = second.db.tables.quiz_sessions[0].question_ids
    // Not a guarantee of difference, but ten questions into four should not be the same mix every single time.
    expect(a).toHaveLength(4)
    expect(b).toHaveLength(4)
    expect(a).not.toEqual(b)
  })

  it('never asks for more questions than the quiz holds', async () => {
    const { db, create } = world({ draw_count: 999 })
    await create()
    expect(db.tables.quiz_sessions[0].question_ids).toHaveLength(10)
  })

  it('still refuses a quiz with no questions', async () => {
    const db = fakeDb({ quizzes: [{ id: QUIZ, max_players: 40, theme: {} }], quiz_questions: [], quiz_sessions: [] })
    const res = fakeRes()
    await createQuizCreateHandler(() => db, { makeCode: () => '123456' })(admin({ quizId: QUIZ }), res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toMatch(/at least one question/)
    expect(db.tables.quiz_sessions).toHaveLength(0)
  })

  it('editing the quiz afterwards cannot change the game that is already running', async () => {
    const { db, create } = world({ draw_count: 4 })
    await create()
    const session = db.tables.quiz_sessions[0]
    const drawn = [...session.question_ids]
    startPlaying(db)

    // The admin adds three more questions to the quiz while the game is mid-play.
    db.tables.quiz_questions.push({ ...rows[0], id: 'new1', position: 10 }, { ...rows[0], id: 'new2', position: 11 }, { ...rows[0], id: 'new3', position: 12 })

    const res = fakeRes()
    await createQuizStateHandler(() => db, { now: () => Date.now(), allow: () => true })({ method: 'POST', headers: {}, body: { token: 'tok' } }, res)
    expect(res.statusCode).toBe(200)
    // The game still asks its own four, even though the quiz behind it now holds thirteen. Before question banks this count
    // was re-read from the quiz on every single step.
    expect(res.body.session.questionCount).toBe(4)
    expect(session.question_ids).toEqual(drawn)
    expect(res.body.question.text).toBe(rows.find((r) => r.id === drawn[0]).text)
  })

  it('a question deleted from the quiz does not take the running game with it', async () => {
    const { db, create } = world({ draw_count: 4 })
    await create()
    const session = db.tables.quiz_sessions[0]
    const first = session.question_ids[0]
    startPlaying(db)

    // The admin deletes the question the game is currently on. The game must not crash or change what it is playing.
    db.tables.quiz_questions = db.tables.quiz_questions.filter((q) => q.id !== first)

    const res = fakeRes()
    await createQuizStateHandler(() => db, { now: () => Date.now(), allow: () => true })({ method: 'POST', headers: {}, body: { token: 'tok' } }, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.session.questionCount).toBe(4) // still four, still counting the missing one
    expect(res.body.question).toBeUndefined() // nothing to show for the deleted one, but no error either
  })
})

describe('the game a phone plays is the one that was frozen', () => {
  it('the question, the answer order and the count all come from the session', async () => {
    const { db, create } = world({ draw_count: 3, shuffle_questions: true, shuffle_options: true })
    await create()
    const session = startPlaying(db)

    const res = fakeRes()
    await createQuizStateHandler(() => db, { now: () => Date.now(), allow: () => true })({ method: 'POST', headers: {}, body: { token: 'tok' } }, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.session.questionCount).toBe(3)
    expect(res.body.question.text).toBe(rows.find((r) => r.id === session.question_ids[0]).text)
    expect([...res.body.question.options].sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('the answer a phone taps is stored in the question own positions', async () => {
    const { db, create } = world({ draw_count: 3, shuffle_options: true })
    await create()
    const session = startPlaying(db)

    const shown = fakeRes()
    await createQuizStateHandler(() => db, { now: () => Date.now(), allow: () => true })({ method: 'POST', headers: {}, body: { token: 'tok' } }, shown)
    const first = shown.body.question
    const question = rows.find((r) => r.id === session.question_ids[0])
    const correctShown = first.options.indexOf(question.options[question.correct_index])

    const res = fakeRes()
    await createQuizAnswerHandler(() => db, { now: () => Date.now(), allow: () => true })({ method: 'POST', headers: {}, body: { token: 'tok', chosenIndex: correctShown } }, res)
    expect(res.statusCode).toBe(200)
    expect(db.tables.quiz_answers[0].chosen_index).toBe(question.correct_index)
    expect(db.tables.quiz_answers[0].correct).toBe(true)
  })
})