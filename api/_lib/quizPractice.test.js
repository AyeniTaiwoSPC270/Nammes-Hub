import { describe, it, expect } from 'vitest'
import { createQuizPracticeHandler } from './handlers/quiz-practice.js'
import quizRouter from '../quiz.js'
import { QUIZ, fakeRes, fakeDb, anon } from './quizTestKit.js'

const START = Date.parse('2026-10-01T10:00:00.000Z')

function world(extra = {}) {
  const db = fakeDb({
    quizzes: [{ id: QUIZ, title: 'Maths', max_players: 40, practice_enabled: true, theme: {} }],
    quiz_questions: [
      { id: 'q1', quiz_id: QUIZ, position: 0, type: 'multiple', text: 'Q1?', options: ['a', 'b', 'c'], correct_index: 1, time_limit_seconds: 20, points: 1000, points_multiplier: 1 },
      { id: 'qp', quiz_id: QUIZ, position: 1, type: 'poll', text: 'Fav?', options: ['x', 'y'], correct_index: null, time_limit_seconds: 20, points: 1000 },
      { id: 'q3', quiz_id: QUIZ, position: 2, type: 'numeric', text: 'Pi?', options: [], numeric_answer: 3.14, numeric_tolerance: 0.01, time_limit_seconds: 20, points: 1000, points_multiplier: 2 },
      { id: 'q4', quiz_id: QUIZ, position: 3, type: 'text', text: 'Who?', options: [], accepted_answers: ['Ada Lovelace'], time_limit_seconds: 10, points: 500, points_multiplier: 1 },
    ],
    ...extra,
  })
  let clock = START
  const at = (ms) => { clock = ms }
  const call = async (body, opts = {}) => {
    const res = fakeRes()
    await createQuizPracticeHandler(() => db, { now: () => clock, baseUrl: 'https://x.supabase.co', allowStart: () => true, allow: () => true, cleanupChance: 0, ...opts })(anon(body), res)
    return res
  }
  const start = async (over = {}) => (await call({ op: 'start', quizId: QUIZ, nickname: 'Ada', avatarId: 3, ...over })).body
  return { db, call, start, at }
}

describe('practice: who can play', () => {
  it('only works for quizzes that are open for practice', async () => {
    const { call } = world({ quizzes: [{ id: QUIZ, title: 'Maths', practice_enabled: false }] })
    expect((await call({ op: 'info', quizId: QUIZ })).statusCode).toBe(404)
    expect((await call({ op: 'start', quizId: QUIZ, nickname: 'Ada' })).statusCode).toBe(404)
    expect((await call({ op: 'top', quizId: QUIZ })).statusCode).toBe(404)
  })
  it('tells the intro screen the title and how many questions (polls are skipped)', async () => {
    const { call } = world()
    const res = await call({ op: 'info', quizId: QUIZ })
    expect(res.body).toMatchObject({ title: 'Maths', questionCount: 3 })
  })
  it('checks the nickname, the character and the quiz id', async () => {
    const { call } = world()
    expect((await call({ op: 'start', quizId: QUIZ, nickname: '  ' })).statusCode).toBe(400)
    expect((await call({ op: 'start', quizId: QUIZ, nickname: 'shit' })).statusCode).toBe(400)
    expect((await call({ op: 'start', quizId: QUIZ, nickname: 'Ada', avatarId: 99 })).statusCode).toBe(400)
    expect((await call({ op: 'start', quizId: 'nope', nickname: 'Ada' })).statusCode).toBe(404)
    expect((await call({ op: 'wat' })).statusCode).toBe(400)
  })
  it('limits how many runs one address can start', async () => {
    const { call } = world()
    const res = await call({ op: 'start', quizId: QUIZ, nickname: 'Ada' }, { allowStart: () => false })
    expect(res.statusCode).toBe(429)
  })
  it('is reachable through the quiz router', async () => {
    const res = fakeRes()
    await quizRouter({ method: 'GET', query: { action: 'practice' }, headers: {} }, res)
    expect(res.statusCode).toBe(405)
  })
})

describe('practice: one question at a time', () => {
  it('starts on the first question without its answer, and never sends later questions', async () => {
    const { start } = world()
    const s = await start()
    expect(s).toMatchObject({ finished: false, index: 0, total: 3, score: 0 })
    expect(s.question).toMatchObject({ type: 'multiple', text: 'Q1?', options: ['a', 'b', 'c'] })
    expect(s.result).toBeUndefined()
    const text = JSON.stringify(s)
    expect(text).not.toContain('Pi?')
    expect(text).not.toContain('Who?')
    expect(text).not.toContain('Fav?')
    expect(text).not.toContain('correct_index')
    expect(text).not.toContain('Lovelace')
    expect(s.token).toBeTruthy()
  })
  it('shows the result straight away and scores with the server clock', async () => {
    const { call, start, at } = world()
    const { token } = await start()
    at(START + 2000) // 2 s of 20 s: 1000 * (1 - 0.1 / 2) = 950
    const res = await call({ op: 'answer', token, chosenIndex: 1 })
    expect(res.body.result).toMatchObject({ correct: true, pointsAwarded: 950, correctIndex: 1, chosenIndex: 1 })
    expect(res.body.score).toBe(950)
    const wrong = await call({ op: 'answer', token, chosenIndex: 0 })
    expect(wrong.statusCode).toBe(409) // already answered
  })
  it('walks through every playable question, skipping the poll, doubling the double round, and finishes', async () => {
    const { call, start, at, db } = world()
    const { token } = await start()
    await call({ op: 'answer', token, chosenIndex: 1 })
    let s = (await call({ op: 'next', token })).body
    expect(s).toMatchObject({ index: 1, question: { type: 'numeric', text: 'Pi?' }, score: 1000 })
    at(START + 1)
    await call({ op: 'answer', token, answerText: '3.145' })
    // double round: 1000 * 2
    expect(db.tables.quiz_practice_runs[0].total_score).toBe(3000)
    s = (await call({ op: 'next', token })).body
    expect(s.question).toMatchObject({ type: 'text', text: 'Who?' })
    const last = await call({ op: 'answer', token, answerText: 'ADA lovelace' })
    expect(last.body.result).toMatchObject({ correct: true, correctText: 'Ada Lovelace' })
    s = (await call({ op: 'next', token })).body
    expect(s).toMatchObject({ finished: true, correctCount: 3, score: 3500 })
    expect((await call({ op: 'answer', token, chosenIndex: 0 })).statusCode).toBe(409)
    expect(db.tables.quiz_practice_runs[0].finished_at).toBeTruthy()
  })
  it('needs an answer before moving on, and counts a question that ran out of time as a miss', async () => {
    const { call, start, at, db } = world()
    const { token } = await start()
    expect((await call({ op: 'next', token })).statusCode).toBe(409)
    at(START + 40_000)
    const s = (await call({ op: 'state', token })).body
    expect(s.result).toMatchObject({ correct: false, pointsAwarded: 0, timedOut: true, correctIndex: 1 })
    expect(db.tables.quiz_practice_answers).toHaveLength(1)
    expect((await call({ op: 'next', token })).statusCode).toBe(200)
  })
  it('gives no points for a late answer even if it is right', async () => {
    const { call, start, at } = world()
    const { token } = await start()
    at(START + 30_000)
    const res = await call({ op: 'answer', token, chosenIndex: 1 })
    expect(res.body.result).toMatchObject({ correct: false, pointsAwarded: 0, timedOut: true })
    expect(res.body.score).toBe(0)
  })
  it('rejects the wrong shape of answer and answers from the wrong person', async () => {
    const { call, start } = world()
    const { token } = await start()
    expect((await call({ op: 'answer', token, answerText: 'b' })).statusCode).toBe(400)
    expect((await call({ op: 'answer', token, chosenIndex: 9 })).statusCode).toBe(400)
    expect((await call({ op: 'answer', token: 'made-up', chosenIndex: 1 })).statusCode).toBe(401)
    expect((await call({ op: 'answer', chosenIndex: 1 })).statusCode).toBe(400)
  })
  it('stops working the moment the quiz is closed for practice', async () => {
    const { call, start, db } = world()
    const { token } = await start()
    db.tables.quizzes[0].practice_enabled = false
    expect((await call({ op: 'state', token })).statusCode).toBe(404)
  })
})

describe('practice: the leaderboard', () => {
  it('lists only finished runs, best first, with nickname, character and score', async () => {
    const { call, db } = world()
    db.tables.quiz_practice_runs.push(
      { id: 'r1', quiz_id: QUIZ, nickname: 'Low', avatar_id: 1, total_score: 500, finished_at: '2026-10-01T10:05:00Z' },
      { id: 'r2', quiz_id: QUIZ, nickname: 'High', avatar_id: 2, total_score: 4000, finished_at: '2026-10-01T10:06:00Z' },
      { id: 'r3', quiz_id: QUIZ, nickname: 'Midway', avatar_id: 3, total_score: 9000, finished_at: null },
    )
    const res = await call({ op: 'top', quizId: QUIZ })
    expect(res.body.top).toEqual([{ nickname: 'High', avatarId: 2, score: 4000 }, { nickname: 'Low', avatarId: 1, score: 500 }])
  })
  it('never exposes tokens', async () => {
    const { call, db } = world()
    db.tables.quiz_practice_runs.push({ id: 'r1', quiz_id: QUIZ, nickname: 'A', avatar_id: 1, total_score: 5, token_hash: 'secret-hash', finished_at: 'x' })
    expect(JSON.stringify((await call({ op: 'top', quizId: QUIZ })).body)).not.toContain('secret-hash')
  })
})
