import { describe, it, expect } from 'vitest'
import { createQuizCreateHandler } from './handlers/quiz-create.js'
import { createQuizAdvanceHandler } from './handlers/quiz-advance.js'
import { createQuizJoinHandler } from './handlers/quiz-join.js'
import { createQuizAnswerHandler } from './handlers/quiz-answer.js'
import { createQuizStateHandler } from './handlers/quiz-state.js'
import quizRouter from '../quiz.js'

import { QUIZ, SESSION, fakeRes, fakeDb, admin, anon } from './quizTestKit.js'

describe('quiz-create', () => {
  it('needs an admin and a quiz with questions', async () => {
    const db = fakeDb()
    const h = createQuizCreateHandler(() => db)
    let res = fakeRes(); await h(anon({ quizId: QUIZ }), res)
    expect(res.statusCode).toBe(401)
    res = fakeRes(); await h({ method: 'POST', headers: { authorization: 'Bearer bad' }, body: { quizId: QUIZ } }, res)
    expect(res.statusCode).toBe(401)
    res = fakeRes(); await h(admin({ quizId: 'nope' }), res)
    expect(res.statusCode).toBe(400)
    const empty = fakeDb({ quiz_questions: [] })
    res = fakeRes(); await createQuizCreateHandler(() => empty)(admin({ quizId: QUIZ }), res)
    expect(res.statusCode).toBe(400)
  })
  it('refuses a signed-in user who is not an admin', async () => {
    const db = fakeDb({ admins: [] })
    const res = fakeRes()
    await createQuizCreateHandler(() => db)(admin({ quizId: QUIZ }), res)
    expect(res.statusCode).toBe(403)
  })
  it("uses the quiz's own player limit unless the admin sets one, and rejects silly limits", async () => {
    const db = fakeDb()
    let res = fakeRes(); await createQuizCreateHandler(() => db, { makeCode: () => '111111' })(admin({ quizId: QUIZ }), res)
    expect(res.body.maxPlayers).toBe(40)
    expect(db.tables.quiz_sessions[0].max_players).toBe(40)
    res = fakeRes(); await createQuizCreateHandler(() => db, { makeCode: () => '222222' })(admin({ quizId: QUIZ, maxPlayers: 12 }), res)
    expect(res.body.maxPlayers).toBe(12)
    for (const bad of [1, 151, 12.5, '12', null]) {
      res = fakeRes(); await createQuizCreateHandler(() => db)(admin({ quizId: QUIZ, maxPlayers: bad }), res)
      expect(res.statusCode).toBe(400)
    }
  })
  it("copies the quiz's look into the game, cleaned, so editing the quiz later never restyles a running game", async () => {
    const db = fakeDb({ quizzes: [{ id: QUIZ, max_players: 40, theme: { look: 'royal', accent: '#FF00AA', pattern: 'nope', headline: '  Freshers   Night ', evil: '</style>' } }] })
    const res = fakeRes()
    await createQuizCreateHandler(() => db, { makeCode: () => '333333' })(admin({ quizId: QUIZ }), res)
    expect(res.statusCode).toBe(200)
    expect(db.tables.quiz_sessions.at(-1).theme).toEqual({ look: 'royal', accent: '#ff00aa', pattern: 'math', confetti: 'math', headline: 'Freshers Night', tagline: '', sound: { music: 'off', effects: true }, logo: null, sponsors: [], showSponsors: { lobby: true, finish: true } })
  })
  it('gives a quiz with no look the default one', async () => {
    const db = fakeDb()
    await createQuizCreateHandler(() => db, { makeCode: () => '444444' })(admin({ quizId: QUIZ }), fakeRes())
    expect(db.tables.quiz_sessions.at(-1).theme).toMatchObject({ look: 'classic', accent: null, pattern: 'math' })
  })
  it('creates a lobby with a six-digit code and retries a code clash', async () => {
    const db = fakeDb({ quiz_sessions: [{ id: 'old', quiz_id: QUIZ, join_code: '111111', state: 'lobby' }] })
    const codes = ['111111', '222222']
    const res = fakeRes()
    await createQuizCreateHandler(() => db, { makeCode: () => codes.shift() })(admin({ quizId: QUIZ }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.joinCode).toBe('222222')
    expect(db.tables.quiz_sessions.at(-1).state).toBe('lobby')
  })
})

async function joinPlayer(db, nickname, code = '123456', avatarId) {
  const res = fakeRes()
  await createQuizJoinHandler(() => db, { allow: () => true })(anon({ code, nickname, avatarId }), res)
  return res
}

describe('quiz-join', () => {
  const lobby = () => fakeDb({ quiz_sessions: [{ id: SESSION, quiz_id: QUIZ, join_code: '123456', state: 'lobby', current_question_index: -1 }] })

  it('joins with a code and nickname and stores only the token hash', async () => {
    const db = lobby()
    const res = await joinPlayer(db, '  Ada ')
    expect(res.statusCode).toBe(200)
    expect(res.body.nickname).toBe('Ada')
    expect(db.tables.quiz_player_tokens[0].token_hash).not.toBe(res.body.token)
    expect(JSON.stringify(db.tables)).not.toContain(res.body.token)
  })
  it('rejects a taken nickname, a bad code, an unknown code and a finished game', async () => {
    const db = lobby()
    await joinPlayer(db, 'Ada')
    expect((await joinPlayer(db, 'ada')).statusCode).toBe(409)
    expect((await joinPlayer(db, 'Bob', '12')).statusCode).toBe(400)
    expect((await joinPlayer(db, 'Bob', '999999')).statusCode).toBe(404)
    db.tables.quiz_sessions[0].state = 'finished'
    expect((await joinPlayer(db, 'Bob')).statusCode).toBe(404)
  })
  it('stores the chosen character, defaults to the first, and rejects out-of-range ones', async () => {
    const db = lobby()
    const picked = await joinPlayer(db, 'Ada', '123456', 17)
    expect(picked.body.avatarId).toBe(17)
    expect(db.tables.quiz_players[0].avatar_id).toBe(17)
    expect((await joinPlayer(db, 'Bob')).body.avatarId).toBe(0)
    expect((await joinPlayer(db, 'Cy', '123456', 50)).statusCode).toBe(400)
    expect((await joinPlayer(db, 'Di', '123456', -1)).statusCode).toBe(400)
    expect((await joinPlayer(db, 'Ed', '123456', 'x')).statusCode).toBe(400)
  })
  it("enforces the game's player limit and starts the full-lobby countdown exactly once", async () => {
    const db = fakeDb({ quiz_sessions: [{ id: SESSION, quiz_id: QUIZ, join_code: '123456', state: 'lobby', current_question_index: -1, max_players: 2 }] })
    const at = new Date('2026-10-01T10:00:00Z')
    const join = (nickname) => {
      const res = fakeRes()
      return createQuizJoinHandler(() => db, { allow: () => true, now: () => at })(anon({ code: '123456', nickname }), res).then(() => res)
    }
    expect((await join('Ada')).statusCode).toBe(200)
    expect(db.tables.quiz_sessions[0].full_at).toBeUndefined()
    expect((await join('Bob')).statusCode).toBe(200)
    expect(db.tables.quiz_sessions[0].full_at).toBe('2026-10-01T10:00:00.000Z')
    const third = await join('Cy')
    expect(third.statusCode).toBe(403)
    expect(third.body.error).toMatch(/full/i)
    expect(db.tables.quiz_players).toHaveLength(2)
    expect(db.tables.quiz_sessions[0].full_at).toBe('2026-10-01T10:00:00.000Z')
  })
  it('steps a player back out if two joins raced past the limit check', async () => {
    const db = fakeDb({ quiz_sessions: [{ id: SESSION, quiz_id: QUIZ, join_code: '123456', state: 'lobby', current_question_index: -1, max_players: 1 }] })
    // Someone else already took the only seat, but the count the handler reads is stale (as in a real race).
    const realFrom = db.from
    let first = true
    db.from = (t) => {
      const q = realFrom(t)
      if (t === 'quiz_players' && first) {
        const origSelect = q.select
        q.select = (cols, opts) => {
          if (opts?.head) { first = false; return { eq: () => ({ then: (r) => r({ data: [], count: 0, error: null }) }) } }
          return origSelect(cols, opts)
        }
      }
      return q
    }
    db.tables.quiz_players.push({ id: 'early', session_id: SESSION, nickname: 'Early', total_score: 0, avatar_id: 0 })
    const res = fakeRes()
    await createQuizJoinHandler(() => db, { allow: () => true })(anon({ code: '123456', nickname: 'Late' }), res)
    expect(res.statusCode).toBe(403)
    expect(db.tables.quiz_players.map((p) => p.nickname)).toEqual(['Early'])
  })
  it('rate limits by IP', async () => {
    const db = lobby()
    const res = fakeRes()
    await createQuizJoinHandler(() => db, { allow: () => false })(anon({ code: '123456', nickname: 'A' }), res)
    expect(res.statusCode).toBe(429)
  })
})

describe('quiz-advance', () => {
  const session = (over = {}) => ({ id: SESSION, quiz_id: QUIZ, join_code: '123456', state: 'lobby', current_question_index: -1, question_started_at: null, ...over })

  it('moves lobby to question 0 and stamps the start time', async () => {
    const db = fakeDb({ quiz_sessions: [session()] })
    const res = fakeRes()
    await createQuizAdvanceHandler(() => db, { now: () => new Date('2026-10-01T10:00:00Z') })(
      admin({ sessionId: SESSION, expectedState: 'lobby', expectedIndex: -1 }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.session).toMatchObject({ state: 'question', current_question_index: 0, question_started_at: '2026-10-01T10:00:00.000Z' })
  })
  it('refuses a stale request so a double click cannot skip a step', async () => {
    const db = fakeDb({ quiz_sessions: [session({ state: 'question', current_question_index: 0 })] })
    const res = fakeRes()
    await createQuizAdvanceHandler(() => db)(admin({ sessionId: SESSION, expectedState: 'lobby', expectedIndex: -1 }), res)
    expect(res.statusCode).toBe(409)
    expect(db.tables.quiz_sessions[0].state).toBe('question')
  })
  it('finishes after the last leaderboard and records the finish time', async () => {
    const db = fakeDb({ quiz_sessions: [session({ state: 'leaderboard', current_question_index: 1 })] })
    const res = fakeRes()
    await createQuizAdvanceHandler(() => db, { now: () => new Date('2026-10-01T11:00:00Z') })(
      admin({ sessionId: SESSION, expectedState: 'leaderboard', expectedIndex: 1 }), res)
    expect(res.body.session.state).toBe('finished')
    expect(res.body.session.finished_at).toBe('2026-10-01T11:00:00.000Z')
  })
  it('is admin only', async () => {
    const db = fakeDb({ quiz_sessions: [session()], admins: [] })
    const res = fakeRes()
    await createQuizAdvanceHandler(() => db)(admin({ sessionId: SESSION, expectedState: 'lobby', expectedIndex: -1 }), res)
    expect(res.statusCode).toBe(403)
  })
})

describe('answering and the answer-leak rule', () => {
  const START = new Date('2026-10-01T10:00:00Z').getTime()

  async function setup() {
    const db = fakeDb({
      quiz_sessions: [{ id: SESSION, quiz_id: QUIZ, join_code: '123456', state: 'question', current_question_index: 0, question_started_at: new Date(START).toISOString() }],
    })
    const a = await joinPlayer(db, 'Ada')
    const b = await joinPlayer(db, 'Bob')
    const ask = (token, chosenIndex, at) => {
      const res = fakeRes()
      return createQuizAnswerHandler(() => db, { now: () => at, allow: () => true })(anon({ token, chosenIndex }), res).then(() => res)
    }
    const state = (token) => {
      const res = fakeRes()
      return createQuizStateHandler(() => db, { now: () => START, allow: () => true })(anon({ token }), res).then(() => res)
    }
    return { db, a: a.body, b: b.body, ask, state }
  }

  it('scores by speed and never says whether the answer was right', async () => {
    const { db, a, b, ask } = await setup()
    const ra = await ask(a.token, 1, START + 2000) // correct, 2s in
    const rb = await ask(b.token, 0, START + 1000) // wrong
    expect(ra.body).toEqual({ accepted: true })
    expect(rb.body).toEqual({ accepted: true })
    const score = (id) => db.tables.quiz_players.find((p) => p.id === id).total_score
    expect(score(a.playerId)).toBe(950)
    expect(score(b.playerId)).toBe(0)
  })
  it('tells phones the limit and when the lobby filled up', async () => {
    const { db, a, state } = await setup()
    db.tables.quiz_sessions[0].max_players = 30
    db.tables.quiz_sessions[0].full_at = '2026-10-01T10:00:00.000Z'
    const res = await state(a.token)
    expect(res.body.session).toMatchObject({ maxPlayers: 30, fullAt: '2026-10-01T10:00:00.000Z' })
  })
  it("sends phones the game's look, cleaned", async () => {
    const { db, a, state } = await setup()
    db.tables.quiz_sessions[0].theme = { look: 'ocean', headline: 'Hello', accent: 'red; background:url(x)' }
    const res = await state(a.token)
    expect(res.body.theme).toEqual({ look: 'ocean', accent: null, pattern: 'math', confetti: 'math', headline: 'Hello', tagline: '', sound: { music: 'off', effects: true }, logo: null, sponsors: [], showSponsors: { lobby: true, finish: true } })
  })
  it('does not send the correct answer to phones while the question is open', async () => {
    const { a, state } = await setup()
    const res = await state(a.token)
    expect(res.body.question.options).toEqual(['a', 'b', 'c'])
    expect(res.body.reveal).toBeUndefined()
    expect(JSON.stringify(res.body)).not.toContain('correct')
  })
  it("tells a phone which option it picked (only its own) so a reload still shows it", async () => {
    const { a, b, ask, state } = await setup()
    await ask(a.token, 2, START + 1000)
    expect((await state(a.token)).body.question).toMatchObject({ answered: true, chosenIndex: 2 })
    expect((await state(b.token)).body.question).toMatchObject({ answered: false, chosenIndex: null })
  })
  it('sends the correct answer and the player result once the game reaches reveal', async () => {
    const { db, a, ask, state } = await setup()
    await ask(a.token, 1, START + 2000)
    db.tables.quiz_sessions[0].state = 'reveal'
    const res = await state(a.token)
    expect(res.body.reveal).toMatchObject({ correctIndex: 1, chosenIndex: 1, pointsAwarded: 950, bonusPoints: 0, correct: true, correctText: null })
    expect(res.body.me).toMatchObject({ nickname: 'Ada', score: 950, rank: 1, avatarId: 0 })
  })
  it('accepts only one answer per player', async () => {
    const { a, ask } = await setup()
    await ask(a.token, 1, START + 1000)
    expect((await ask(a.token, 0, START + 2000)).statusCode).toBe(409)
  })
  it('refuses answers after the timer plus grace, and when no question is open', async () => {
    const { db, a, ask } = await setup()
    expect((await ask(a.token, 1, START + 20_000 + 1501)).statusCode).toBe(409)
    db.tables.quiz_sessions[0].state = 'reveal'
    expect((await ask(a.token, 1, START + 1000)).statusCode).toBe(409)
  })
  it('rejects unknown tokens and out-of-range choices', async () => {
    const { a, ask, state } = await setup()
    expect((await ask('nope', 1, START)).statusCode).toBe(401)
    expect((await state('nope')).statusCode).toBe(401)
    expect((await ask(a.token, 2, START)).statusCode).toBe(200) // 3 options: index 2 is valid
    const { a: a2, ask: ask2 } = await setup()
    expect((await ask2(a2.token, 3, START)).statusCode).toBe(400) // only 3 options
  })
  it('shows the top players once the game is on the leaderboard', async () => {
    const { db, a, b, ask, state } = await setup()
    await ask(a.token, 1, START + 1000)
    await ask(b.token, 1, START + 9000)
    db.tables.quiz_sessions[0].state = 'leaderboard'
    const res = await state(b.token)
    expect(res.body.top.map((p) => [p.nickname, p.rank])).toEqual([['Ada', 1], ['Bob', 2]])
  })
})

describe('quiz router', () => {
  it('404s an unknown action and dispatches a known one', () => {
    for (const query of [{}, { action: 'nope' }, { action: '__proto__' }]) {
      const res = fakeRes()
      quizRouter({ query, method: 'POST', headers: {} }, res)
      expect(res.statusCode).toBe(404)
    }
    const res = fakeRes()
    quizRouter({ query: { action: 'join' }, method: 'GET', headers: {} }, res)
    expect(res.statusCode).toBe(405)
  })
})
