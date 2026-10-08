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

describe('practice: the card link', () => {
  async function finishARun() {
    const w = world()
    const { token } = await w.start()
    await w.call({ op: 'answer', token, chosenIndex: 1 })
    await w.call({ op: 'next', token })
    w.at(START + 1)
    await w.call({ op: 'answer', token, answerText: '3.145' })
    await w.call({ op: 'next', token })
    await w.call({ op: 'answer', token, answerText: 'Ada Lovelace' })
    const res = await w.call({ op: 'next', token })
    return { ...w, finished: res.body }
  }

  it('mints a share code only once the run is finished', async () => {
    const { finished, db } = await finishARun()
    expect(finished.finished).toBe(true)
    expect(finished.shareCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/)
    expect(db.tables.quiz_practice_runs[0].share_code).toBe(finished.shareCode)
  })

  it('has no share code mid-run, so a card button never points at nothing', async () => {
    const { call, start } = world()
    const { token } = await start()
    expect((await call({ op: 'state', token })).body.shareCode).toBeNull()
  })

  it('never mints a share code for a run that has not finished', async () => {
    const { call, start, db } = world()
    const { token } = await start()
    await call({ op: 'answer', token, chosenIndex: 1 })
    await call({ op: 'next', token })
    expect(db.tables.quiz_practice_runs[0].finished_at).toBeNull()
    expect(db.tables.quiz_practice_runs[0].share_code ?? null).toBeNull()
  })

  it('hands the phone the card design but never a token', async () => {
    const { finished } = await finishARun()
    expect(Object.keys(finished)).not.toContain('token')
    expect(finished.card).toMatchObject({ showStreak: true })
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

describe('practice: racing rivals', () => {
  it('runs are solo unless a race is asked for, and a bad race is refused', async () => {
    const { call, start } = world()
    const s = await start()
    const a = await call({ op: 'answer', token: s.token, chosenIndex: 1 })
    expect(a.body.race).toBeNull()
    expect((await call({ op: 'start', quizId: QUIZ, nickname: 'Ada', race: 'dragons' })).statusCode).toBe(400)
    expect((await call({ op: 'start', quizId: QUIZ, nickname: 'Ada', race: 'bots', raceSkill: 'genius' })).statusCode).toBe(400)
  })

  it('bots: rivals appear only after an answer, never change, and add up over the run', async () => {
    const { call, start, at } = world()
    const s = await start({ race: 'bots', raceSkill: 'expert' })
    expect(s.race).toBeUndefined() // nothing before the first answer
    at(START + 1000)
    const first = (await call({ op: 'answer', token: s.token, chosenIndex: 1 })).body.race
    expect(first.mode).toBe('bots')
    expect(first.rivals).toHaveLength(4)
    expect(first.rivals.every((r) => r.kind === 'bot' && r.nickname && r.score >= 0 && r.score === r.gain)).toBe(true)
    const again = (await call({ op: 'state', token: s.token })).body.race
    expect(again).toEqual(first)
    await call({ op: 'next', token: s.token })
    at(START + 2000)
    const second = (await call({ op: 'answer', token: s.token, answerText: '3.14' })).body.race
    second.rivals.forEach((r, i) => expect(r.score).toBe(first.rivals[i].score + r.gain))
  })

  it('bots: the finished screen carries the final standings', async () => {
    const { call, start } = world()
    const s = await start({ race: 'bots', raceSkill: 'mixed' })
    for (let i = 0; i < 3; i++) {
      await call({ op: 'answer', token: s.token, ...(i === 0 ? { chosenIndex: 1 } : i === 1 ? { answerText: '3.14' } : { answerText: 'Ada Lovelace' }) })
      await call({ op: 'next', token: s.token })
    }
    const done = (await call({ op: 'state', token: s.token })).body
    expect(done.finished).toBe(true)
    expect(done.race.rivals).toHaveLength(4)
  })

  it('ghosts: needs someone to have finished first', async () => {
    const { call, start } = world()
    expect((await call({ op: 'start', quizId: QUIZ, nickname: 'Ada', race: 'ghosts' })).statusCode).toBe(409)
    expect((await call({ op: 'info', quizId: QUIZ })).body.ghostCount).toBe(0)
    expect((await start()).token).toBeTruthy()
  })

  it('ghosts: race the recorded answers of real past runs, question by question', async () => {
    const { call, db } = world()
    db.tables.quiz_practice_runs.push(
      { id: 'g1', quiz_id: QUIZ, nickname: 'Ghost One', avatar_id: 4, total_score: 3000, finished_at: 'x' },
      { id: 'g2', quiz_id: QUIZ, nickname: 'Ghost Two', avatar_id: 5, total_score: 500, finished_at: 'x' },
      { id: 'g3', quiz_id: QUIZ, nickname: 'Still going', avatar_id: 6, total_score: 9999, finished_at: null },
    )
    db.tables.quiz_practice_answers.push(
      { run_id: 'g1', question_id: 'q1', points_awarded: 900 },
      { run_id: 'g1', question_id: 'q3', points_awarded: 2100 },
      { run_id: 'g2', question_id: 'q1', points_awarded: 500 },
    )
    expect((await call({ op: 'info', quizId: QUIZ })).body.ghostCount).toBe(2)
    const s = (await call({ op: 'start', quizId: QUIZ, nickname: 'Ada', race: 'ghosts' })).body
    const first = (await call({ op: 'answer', token: s.token, chosenIndex: 1 })).body.race
    expect(first.mode).toBe('ghosts')
    const byName = (race) => Object.fromEntries(race.rivals.map((r) => [r.nickname, r]))
    expect(Object.keys(byName(first)).sort()).toEqual(['Ghost One', 'Ghost Two']) // the unfinished run never races
    expect(byName(first)['Ghost One']).toMatchObject({ kind: 'ghost', score: 900, gain: 900 })
    await call({ op: 'next', token: s.token })
    const second = (await call({ op: 'answer', token: s.token, answerText: '3.14' })).body.race
    expect(byName(second)['Ghost One']).toMatchObject({ score: 3000, gain: 2100 })
    expect(byName(second)['Ghost Two']).toMatchObject({ score: 500, gain: 0 })
  })
})

describe('practice: the public list', () => {
  it('lists the quizzes open for practice that have something to play, without any private data', async () => {
    const { call, db } = world()
    db.tables.quizzes.push(
      { id: 'quiz-closed', title: 'Closed', practice_enabled: false },
      { id: 'quiz-archived', title: 'Old', practice_enabled: true, archived_at: '2026-01-01' },
      { id: 'quiz-empty', title: 'Empty', practice_enabled: true },
    )
    const res = await call({ op: 'list' })
    expect(res.statusCode).toBe(200)
    expect(res.body.quizzes).toEqual([{ id: QUIZ, title: 'Maths', questionCount: 3, battleEnabled: false }])
    expect(JSON.stringify(res.body)).not.toMatch(/correct|token|theme/)
  })
})
