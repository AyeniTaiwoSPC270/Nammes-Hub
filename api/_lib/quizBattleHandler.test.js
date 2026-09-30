import { describe, it, expect } from 'vitest'
import { createQuizBattleHandler } from './handlers/quiz-battle.js'
import quizRouter from '../quiz.js'
import { QUIZ, fakeRes, fakeDb, anon } from './quizTestKit.js'
import { DUEL_START_DELAY_MS, DUEL_REVEAL_MS, DUEL_FORFEIT_MS, DUEL_OPEN_TTL_MS } from './quizBattle.js'

const START = Date.parse('2026-10-01T10:00:00.000Z')

function world(extra = {}) {
  const db = fakeDb({
    quizzes: [{ id: QUIZ, title: 'Maths', max_players: 40, battle_enabled: true, theme: {} }],
    quiz_questions: [
      { id: 'q1', quiz_id: QUIZ, position: 0, type: 'multiple', text: 'Q1?', options: ['a', 'b', 'c'], correct_index: 1, time_limit_seconds: 20, points: 1000, points_multiplier: 1 },
      { id: 'qp', quiz_id: QUIZ, position: 1, type: 'poll', text: 'Fav?', options: ['x', 'y'], correct_index: null, time_limit_seconds: 20, points: 1000 },
      { id: 'q3', quiz_id: QUIZ, position: 2, type: 'numeric', text: 'Pi?', options: [], numeric_answer: 3.14, numeric_tolerance: 0.01, time_limit_seconds: 20, points: 1000, points_multiplier: 2 },
      { id: 'q4', quiz_id: QUIZ, position: 3, type: 'text', text: 'Who?', options: [], accepted_answers: ['Ada Lovelace'], time_limit_seconds: 10, points: 500, points_multiplier: 1 },
    ],
    ...extra,
  })
  let clock = START
  let seed = 0.1
  const at = (ms) => { clock = ms }
  const call = async (body, opts = {}) => {
    const res = fakeRes()
    await createQuizBattleHandler(() => db, {
      now: () => clock, baseUrl: 'https://x.supabase.co', allowCreate: () => true, allowJoin: () => true, allow: () => true,
      cleanupChance: 0, random: () => (seed = (seed * 7.31 + 0.137) % 1), ...opts,
    })(anon(body), res)
    return res
  }
  const create = async (over = {}) => (await call({ op: 'create', quizId: QUIZ, mode: 'challenge', nickname: 'Ada', avatarId: 3, tag: 'tag-aaaaaaaaaaaaaaaa', ...over })).body
  const join = async (code, over = {}) => await call({ op: 'join', code, nickname: 'Bayo', avatarId: 4, tag: 'tag-bbbbbbbbbbbbbbbb', ...over })
  return { db, call, create, join, at }
}

const playChallenge = async (call, token, answers) => {
  let last
  for (const a of answers) {
    await call({ op: 'answer', token, ...a })
    last = (await call({ op: 'next', token })).body
  }
  return last
}
const RIGHT = [{ chosenIndex: 1 }, { answerText: '3.14' }, { answerText: 'Ada Lovelace' }]
const WRONG = [{ chosenIndex: 0 }, { answerText: '9' }, { answerText: 'nobody' }]

describe('battle: who can start one', () => {
  it('only for quizzes that are open for battles, with a mode and a clean nickname', async () => {
    const { call } = world({ quizzes: [{ id: QUIZ, title: 'Maths', battle_enabled: false }] })
    expect((await call({ op: 'create', quizId: QUIZ, mode: 'challenge', nickname: 'Ada' })).statusCode).toBe(404)
    const w = world()
    expect((await w.call({ op: 'create', quizId: QUIZ, mode: 'war', nickname: 'Ada' })).statusCode).toBe(400)
    expect((await w.call({ op: 'create', quizId: QUIZ, mode: 'duel', nickname: '  ' })).statusCode).toBe(400)
    expect((await w.call({ op: 'create', quizId: QUIZ, mode: 'duel', nickname: 'shit' })).statusCode).toBe(400)
    expect((await w.call({ op: 'create', quizId: QUIZ, mode: 'duel', nickname: 'Ada', avatarId: 99 })).statusCode).toBe(400)
    expect((await w.call({ op: 'create', quizId: QUIZ, mode: 'challenge', nickname: 'Ada', vsBot: true })).statusCode).toBe(400)
    expect((await w.call({ op: 'wat' })).statusCode).toBe(400)
  })
  it('limits how many battles one address can start', async () => {
    const { call } = world()
    expect((await call({ op: 'create', quizId: QUIZ, mode: 'duel', nickname: 'Ada' }, { allowCreate: () => false })).statusCode).toBe(429)
  })
  it('lists the quizzes that are open for battles', async () => {
    const { call } = world()
    const res = await call({ op: 'list' })
    expect(res.body.quizzes).toEqual([{ id: QUIZ, title: 'Maths', questionCount: 3 }])
  })
  it('is reachable through the quiz router', async () => {
    const res = fakeRes()
    await quizRouter({ method: 'GET', query: { action: 'battle' }, headers: {} }, res)
    expect(res.statusCode).toBe(405)
  })
})

describe('battle: challenge a friend', () => {
  it('the challenger plays first, then the friend plays the same questions and both see who won', async () => {
    const { call, create, join, at } = world()
    const a = await create()
    expect(a).toMatchObject({ state: 'question', mode: 'challenge', total: 3, index: 0, me: { nickname: 'Ada', slot: 'a' } })
    expect(a.code).toMatch(/^[A-Z2-9]{6}$/)
    expect(JSON.stringify(a)).not.toMatch(/correct_index|Lovelace/)

    // the friend cannot take the seat before the challenger has finished
    expect((await join(a.code)).statusCode).toBe(409)
    expect((await call({ op: 'info', code: a.code })).body).toMatchObject({ seatFree: false, notReady: true, challenger: { nickname: 'Ada' } })

    at(START + 2000)
    const wait = await playChallenge(call, a.token, RIGHT)
    expect(wait).toMatchObject({ state: 'waiting', me: { score: expect.any(Number) } })
    expect(wait.me.score).toBeGreaterThan(3000)

    const info = (await call({ op: 'info', code: a.code })).body
    expect(info).toMatchObject({ seatFree: true, challenger: { nickname: 'Ada', score: wait.me.score } })
    expect(JSON.stringify(info)).not.toContain('Who?') // no question text leaks through the link

    at(START + 60_000)
    const joined = await join(a.code)
    expect(joined.statusCode).toBe(200)
    const b = joined.body
    expect(b).toMatchObject({ state: 'question', me: { nickname: 'Bayo', slot: 'b' }, opponent: { nickname: 'Ada' } })
    expect(b.opponent.score).toBeUndefined() // the challenger's score is not shown mid-game

    const done = await playChallenge(call, b.token, WRONG)
    expect(done.state).toBe('finished')
    expect(done.final.winner).toBe('them')
    expect(done.final.questions).toHaveLength(3)
    expect(done.final.questions.every((q) => q.winner === 'them')).toBe(true)
    expect(done.me.score).toBe(0)

    const mine = (await call({ op: 'state', token: a.token })).body
    expect(mine.state).toBe('finished')
    expect(mine.final.winner).toBe('me')
  })

  it('a third person cannot take the seat, and the same nickname is refused', async () => {
    const { call, create, join, at } = world()
    const a = await create()
    at(START + 1000)
    await playChallenge(call, a.token, RIGHT)
    expect((await join(a.code, { nickname: 'ADA' })).statusCode).toBe(409)
    expect((await join(a.code)).statusCode).toBe(200)
    expect((await join(a.code, { nickname: 'Cleo' })).statusCode).toBe(409)
  })

  it('an old challenge cannot be taken', async () => {
    const { call, create, join, at } = world()
    const a = await create()
    at(START + 1000)
    await playChallenge(call, a.token, RIGHT)
    at(START + 8 * 86_400_000)
    expect((await join(a.code)).statusCode).toBe(410)
    expect((await call({ op: 'info', code: a.code })).body).toMatchObject({ expired: true, seatFree: false })
  })

  it('scores with the server clock, refuses late and repeated answers, and counts a timed-out question as a miss', async () => {
    const { call, create, at } = world()
    const a = await create()
    at(START + 2000) // 2 s of 20 s: 950
    const ok = await call({ op: 'answer', token: a.token, chosenIndex: 1 })
    expect(ok.body.result).toMatchObject({ correct: true, pointsAwarded: 950 })
    expect((await call({ op: 'answer', token: a.token, chosenIndex: 0 })).statusCode).toBe(409)
    await call({ op: 'next', token: a.token })
    at(START + 2000 + 40_000)
    const timedOut = (await call({ op: 'state', token: a.token })).body
    expect(timedOut.result).toMatchObject({ correct: false, timedOut: true })
    expect((await call({ op: 'answer', token: a.token, answerText: '3.14' })).statusCode).toBe(409)
  })

  it('needs an answer before moving on', async () => {
    const { call, create } = world()
    const a = await create()
    expect((await call({ op: 'next', token: a.token })).statusCode).toBe(409)
  })

  it('unknown or missing tokens are refused', async () => {
    const { call } = world()
    expect((await call({ op: 'state', token: 'made-up' })).statusCode).toBe(401)
    expect((await call({ op: 'answer', chosenIndex: 1 })).statusCode).toBe(400)
  })
})

describe('battle: live duel', () => {
  async function duel(w) {
    const a = await w.create({ mode: 'duel' })
    expect(a.state).toBe('open')
    w.at(START + 1000)
    const joined = await w.join(a.code)
    return { a, b: joined.body, startsAt: START + 1000 + DUEL_START_DELAY_MS }
  }

  it('starts when the second player joins, with a countdown before the first question', async () => {
    const w = world()
    const { a, b } = await duel(w)
    expect((await w.call({ op: 'info', code: a.code })).body.seatFree).toBe(false)
    expect(b).toMatchObject({ state: 'question', mode: 'duel', opponent: { nickname: 'Ada', isBot: false } })
    expect(new Date(b.startsAt).getTime()).toBe(START + 1000 + DUEL_START_DELAY_MS)
    const early = await w.call({ op: 'answer', token: b.token, chosenIndex: 1 })
    expect(early.statusCode).toBe(409)
  })

  it('keeps answers hidden until both have answered, then reveals together and moves on', async () => {
    const w = world()
    const { a, b, startsAt } = await duel(w)
    w.at(startsAt + 2000)
    expect((await w.call({ op: 'answer', token: a.token, chosenIndex: 1 })).body).toEqual({ accepted: true })
    let viewA = (await w.call({ op: 'state', token: a.token })).body
    let viewB = (await w.call({ op: 'state', token: b.token })).body
    expect(viewA).toMatchObject({ state: 'question', myAnswered: true, opponentAnswered: false })
    expect(viewB).toMatchObject({ state: 'question', myAnswered: false, opponentAnswered: true })
    expect(viewA.reveal).toBeUndefined()
    expect(viewA.me.score).toBe(0) // nothing is scored on the bar until the question closes
    expect(JSON.stringify(viewB)).not.toMatch(/correctIndex|"correct"/)

    w.at(startsAt + 4000)
    await w.call({ op: 'answer', token: b.token, chosenIndex: 0 })
    viewA = (await w.call({ op: 'state', token: a.token })).body
    expect(viewA.state).toBe('reveal')
    expect(viewA.reveal.mine).toMatchObject({ correct: true, correctIndex: 1 })
    expect(viewA.reveal.theirs).toMatchObject({ correct: false, answered: true })
    expect(viewA.me.score).toBe(950)
    expect(viewA.opponent.score).toBe(0)

    // too early to move on, then it moves on by itself
    w.at(startsAt + 4000 + DUEL_REVEAL_MS - 100)
    expect((await w.call({ op: 'state', token: b.token })).body.state).toBe('reveal')
    w.at(startsAt + 4000 + DUEL_REVEAL_MS)
    const next = (await w.call({ op: 'state', token: b.token })).body
    expect(next).toMatchObject({ state: 'question', index: 1, question: { text: 'Pi?' } })
    expect(new Date(next.startsAt).getTime()).toBeGreaterThan(startsAt + 4000 + DUEL_REVEAL_MS)
  })

  it('a question nobody answers closes on time, and the duel ends with a winner', async () => {
    const w = world()
    const { a, b, startsAt } = await duel(w)
    let t = startsAt
    for (let q = 0; q < 3; q++) {
      t = Math.max(t, new Date((await w.call({ op: 'state', token: a.token })).body.startsAt).getTime()) + 1000
      w.at(t)
      await w.call({ op: 'answer', token: a.token, ...RIGHT[q] })
      if (q === 1) {
        // B never answers question 2: it closes when the time runs out
        t += 25_000
        w.at(t)
        await w.call({ op: 'state', token: b.token })
        expect((await w.call({ op: 'state', token: a.token })).body.state).toBe('reveal')
      } else {
        await w.call({ op: 'answer', token: b.token, ...WRONG[q] })
        await w.call({ op: 'state', token: a.token })
      }
      t += DUEL_REVEAL_MS
      w.at(t)
      await w.call({ op: 'state', token: a.token })
      await w.call({ op: 'state', token: b.token })
    }
    const final = (await w.call({ op: 'state', token: a.token })).body
    expect(final.state).toBe('finished')
    expect(final.final.winner).toBe('me')
    expect(final.final.questions).toHaveLength(3)
    expect((await w.call({ op: 'state', token: b.token })).body.final.winner).toBe('them')
    expect((await w.call({ op: 'answer', token: a.token, chosenIndex: 1 })).statusCode).toBe(409)
  })

  it('goes to the side that stays if the other goes silent, and is dropped if nobody joins', async () => {
    const w = world()
    const { a, startsAt } = await duel(w)
    w.at(startsAt + DUEL_FORFEIT_MS + 5000)
    const after = (await w.call({ op: 'state', token: a.token })).body
    expect(after).toMatchObject({ state: 'finished', final: { winner: 'me', forfeit: true } })

    const lonely = world()
    const solo = await lonely.create({ mode: 'duel' })
    lonely.at(START + DUEL_OPEN_TTL_MS + 1000)
    expect((await lonely.call({ op: 'state', token: solo.token })).body.state).toBe('cancelled')
  })

  it('tells you when the other player has gone quiet', async () => {
    const w = world()
    const { a, startsAt } = await duel(w)
    w.at(startsAt + 25_000)
    const view = (await w.call({ op: 'state', token: a.token })).body
    expect(view.opponent.presence).toBe('away')
  })
})

describe('battle: duel against a bot', () => {
  it('starts straight away, the bot answers by itself, and the duel finishes', async () => {
    const w = world()
    const a = await w.create({ mode: 'duel', vsBot: true, botSkill: 'expert' })
    expect(a).toMatchObject({ state: 'question', opponent: { isBot: true } })
    expect(a.opponent.nickname).toBeTruthy()
    let t = START + DUEL_START_DELAY_MS
    let view = a
    for (let q = 0; q < 3; q++) {
      t += 1000
      w.at(t)
      await w.call({ op: 'answer', token: a.token, ...RIGHT[q] })
      // poll until the bot has answered and the question closes
      for (let i = 0; i < 40 && view.state !== 'reveal' && view.state !== 'finished'; i++) {
        t += 1000
        w.at(t)
        view = (await w.call({ op: 'state', token: a.token })).body
      }
      expect(view.state).toBe('reveal')
      expect(view.opponentAnswered).toBe(true)
      t += DUEL_REVEAL_MS
      w.at(t)
      view = (await w.call({ op: 'state', token: a.token })).body
    }
    expect(view.state).toBe('finished')
    expect(['me', 'them', null]).toContain(view.final.winner)
    expect(w.db.tables.quiz_battle_answers.filter((x) => x.slot === 'b')).toHaveLength(3)
  })
})
