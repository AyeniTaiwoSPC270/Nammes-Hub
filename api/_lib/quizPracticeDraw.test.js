import { describe, it, expect } from 'vitest'
import { createQuizPracticeHandler } from './handlers/quiz-practice.js'
import { fakeDb, fakeRes, QUIZ, anon } from './quizTestKit.js'

// Practice with question banks: a run draws from the same bank as a hosted game, and the intro screen has to say how many
// questions a run will actually ask.

const Q1 = '11111111-1111-4111-8111-111111111111'
const Q2 = '22222222-2222-4222-8222-222222222222'
const Q3 = '33333333-3333-4333-8333-333333333333'
const Q4 = '44444444-4444-4444-8444-444444444444'

const rows = [
  { id: Q1, quiz_id: QUIZ, position: 0, type: 'multiple', text: 'Q1?', options: ['a', 'b', 'c', 'd'], correct_index: 1, time_limit_seconds: 20, points: 1000 },
  { id: Q2, quiz_id: QUIZ, position: 1, type: 'multiple', text: 'Q2?', options: ['w', 'x', 'y', 'z'], correct_index: 0, time_limit_seconds: 20, points: 1000 },
  { id: Q3, quiz_id: QUIZ, position: 2, type: 'multiple', text: 'Q3?', options: ['p', 'q', 'r', 's'], correct_index: 2, time_limit_seconds: 20, points: 1000 },
  { id: Q4, quiz_id: QUIZ, position: 3, type: 'poll', text: 'Fav?', options: ['yes', 'no'], correct_index: null, time_limit_seconds: 20, points: 1000 },
]

function world(drawSettings = null) {
  const db = fakeDb({
    quizzes: [{ id: QUIZ, title: 'Maths', practice_enabled: true, battle_enabled: false, draw_settings: drawSettings }],
    quiz_questions: rows.map((r) => ({ ...r })),
    quiz_practice_runs: [],
    quiz_practice_answers: [],
  })
  const call = async (body) => {
    const res = fakeRes()
    await createQuizPracticeHandler(() => db, { now: () => Date.now(), allow: () => true, allowStart: () => true, cleanupChance: 0 })(anon(body), res)
    return res
  }
  return { db, call }
}

const start = (call) => call({ op: 'start', quizId: QUIZ, nickname: 'Ada', avatarId: 1 })

describe('the intro screen counts what a run will ask', () => {
  it('says every question when the admin asked for all of them', async () => {
    const res = await world().call({ op: 'info', quizId: QUIZ })
    // Four questions in the quiz, one of them a poll, so three can be practised.
    expect(res.body.questionCount).toBe(3)
  })

  it('says the drawn number, not the size of the bank', async () => {
    const res = await world({ draw_count: 2 }).call({ op: 'info', quizId: QUIZ })
    expect(res.body.questionCount).toBe(2)
  })

  it('the public list says the drawn number too', async () => {
    const res = await world({ draw_count: 2 }).call({ op: 'list' })
    expect(res.body.quizzes).toEqual([{ id: QUIZ, title: 'Maths', questionCount: 2, battleEnabled: false }])
  })
})

describe('a run draws from the bank and keeps its own set', () => {
  it('asks the number the admin set', async () => {
    const { call } = world({ draw_count: 2 })
    const res = await start(call)
    expect(res.statusCode).toBe(200)
    expect(res.body.total).toBe(2)
    expect(res.body.index).toBe(0)
  })

  it('asks the whole bank when the admin asked for all of it', async () => {
    const { call } = world({ draw_count: null })
    const res = await start(call)
    expect(res.body.total).toBe(3)
  })

  it('never asks for a poll, even when the poll is the only one left', async () => {
    const { call } = world({ draw_count: 99 })
    const res = await start(call)
    expect(res.body.total).toBe(3)
  })

  it('freezes its questions on the run, so a reload sees the same ones', async () => {
    const { db, call } = world({ draw_count: 2 })
    const res = await start(call)
    const run = db.tables.quiz_practice_runs[0]
    expect(run.question_ids).toHaveLength(2)
    expect(run.question_ids).not.toContain(Q4) // never the poll

    const again = await call({ op: 'state', token: res.body.token })
    expect(again.body.question.text).toBe(res.body.question.text)
  })

  it('shuffles the answers when the quiz says to, and grades them back', async () => {
    const { db, call } = world({ draw_count: 3, shuffle_options: true })
    const res = await start(call)
    const run = db.tables.quiz_practice_runs[0]
    const first = res.body.question
    expect(first.options).toHaveLength(4)

    // The right answer is whichever option the server showed at the position it was stored at. Finding it that way means
    // this test works whichever shuffle came out, rather than hard-coding one.
    const question = rows.find((r) => r.id === run.question_ids[0])
    const correctShown = first.options.indexOf(question.options[question.correct_index])
    expect(correctShown).toBeGreaterThanOrEqual(0)

    const answered = await call({ op: 'answer', token: res.body.token, chosenIndex: correctShown })
    expect(answered.statusCode).toBe(200)
    // Stored in the question's own positions, and reported back in the order it was shown.
    expect(db.tables.quiz_practice_answers[0].chosen_index).toBe(question.correct_index)
    expect(answered.body.result.correct).toBe(true)
    expect(answered.body.result.chosenIndex).toBe(correctShown)
    expect(answered.body.result.correctIndex).toBe(correctShown)
  })

  it('a wrong answer stays wrong, wherever it was shown', async () => {
    // Its own run, because a question can only be answered once.
    const { db, call } = world({ draw_count: 3, shuffle_options: true })
    const res = await start(call)
    const run = db.tables.quiz_practice_runs[0]
    const question = rows.find((r) => r.id === run.question_ids[0])
    const shown = res.body.question.options
    const wrongShown = shown.indexOf(question.options[(question.correct_index + 1) % question.options.length])

    const answered = await call({ op: 'answer', token: res.body.token, chosenIndex: wrongShown })
    expect(answered.statusCode).toBe(200)
    expect(answered.body.result.correct).toBe(false)
    expect(db.tables.quiz_practice_answers[0].chosen_index).toBe((question.correct_index + 1) % question.options.length)
    expect(answered.body.result.chosenIndex).toBe(wrongShown)
  })

  it('leaves the answers as typed for a quiz with no settings', async () => {
    const { call } = world(null)
    const res = await start(call)
    const question = rows.find((r) => r.id === res.body.question ? true : false) ?? rows.find((r) => r.text === res.body.question.text)
    expect(res.body.question.options).toEqual(question.options)
  })
})

describe('a run started before question banks', () => {
  it('plays the whole bank in the quiz order, with answers as typed', async () => {
    const { db, call } = world(null)
    // A run with no frozen list, exactly as one created before the feature would be.
    db.tables.quiz_practice_runs.push({
      id: 'run-old', quiz_id: QUIZ, nickname: 'Old', avatar_id: 1, token_hash: 'x', current_index: 0, total_score: 0,
    })
    const { hashToken } = await import('./quiz.js')
    db.tables.quiz_practice_runs[0].token_hash = hashToken('old-token')
    const res = await call({ op: 'state', token: 'old-token' })
    expect(res.body.total).toBe(3)
    expect(res.body.question.text).toBe('Q1?') // the first in the quiz, not a draw
    expect(res.body.question.options).toEqual(['a', 'b', 'c', 'd'])
  })
})