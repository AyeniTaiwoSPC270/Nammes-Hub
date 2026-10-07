import { describe, it, expect } from 'vitest'
import { createQuizBattleHandler } from './handlers/quiz-battle.js'
import quizRouter from '../quiz.js'
import { QUIZ, fakeRes, fakeDb, anon } from './quizTestKit.js'
import { DUEL_START_DELAY_MS, DUEL_REVEAL_MS, DUEL_FORFEIT_MS, DUEL_OPEN_TTL_MS, battleWeight, eloUpdate } from './quizBattle.js'

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

describe('battle: rankings', () => {
  const TAG_A = 'tag-aaaaaaaaaaaaaaaa'
  const TAG_B = 'tag-bbbbbbbbbbbbbbbb'

  // Two real players duel, A answers everything right and B nothing, and the duel plays to the end.
  async function playDuel(w, { tagB = TAG_B, vsBot = false } = {}) {
    const a = await w.create({ mode: 'duel', vsBot, tag: TAG_A })
    let b = null
    if (!vsBot) {
      w.at(START + 1000)
      b = (await w.join(a.code, { tag: tagB })).body
    }
    let t = vsBot ? START + DUEL_START_DELAY_MS : START + 1000 + DUEL_START_DELAY_MS
    for (let q = 0; q < 3; q++) {
      t += 1000
      w.at(t)
      await w.call({ op: 'answer', token: a.token, ...RIGHT[q] })
      if (b) await w.call({ op: 'answer', token: b.token, ...WRONG[q] })
      for (let i = 0; i < 40; i++) {
        t += 1000
        w.at(t)
        const v = (await w.call({ op: 'state', token: a.token })).body
        if (v.state === 'reveal' || v.state === 'finished') break
      }
      t += DUEL_REVEAL_MS
      w.at(t)
      await w.call({ op: 'state', token: a.token })
      if (b) await w.call({ op: 'state', token: b.token })
    }
    return { a, b }
  }

  it('changes both ratings once when two real players finish a duel', async () => {
    const w = world()
    const { a, b } = await playDuel(w)
    expect((await w.call({ op: 'state', token: a.token })).body.state).toBe('finished')
    await w.call({ op: 'state', token: b.token })
    await w.call({ op: 'state', token: a.token })
    const rows = w.db.tables.quiz_battle_ratings
    expect(rows).toHaveLength(2)
    const mine = rows.find((r) => r.nickname === 'Ada')
    const theirs = rows.find((r) => r.nickname === 'Bayo')
    // A three-question duel is a much smaller test than the ten-question battle the rating was tuned around, so it moves
    // the ladder by less than a full step. The winner still goes up and the loser still comes down by the same amount.
    expect(mine).toMatchObject({ wins: 1, losses: 0 })
    expect(theirs).toMatchObject({ wins: 0, losses: 1 })
    expect(mine.rating).toBeGreaterThan(1000)
    expect(theirs.rating).toBeLessThan(1000)
    expect(mine.rating - 1000).toBe(1000 - theirs.rating)
    expect(mine.rating).toBeLessThan(1016) // strictly less than the old flat step
    expect(JSON.stringify(rows)).not.toContain(TAG_A) // only hashes are stored
    expect(w.db.tables.quiz_battles[0].rated).toBe(true)
  })

  it('a longer battle moves the ladder further than a short one, won the same way', async () => {
    // The same 3 questions asked twice is not possible, so this compares the weight maths directly at the level where it
    // lives: a full ten-question win is worth a full step, a two-question one is worth a fraction.
    expect(battleWeight({ questionCount: 10, winnerPoints: 3500, loserPoints: 0, pointsAvailable: 3500 })).toBeGreaterThan(0.9)
    expect(battleWeight({ questionCount: 2, winnerPoints: 700, loserPoints: 0, pointsAvailable: 700 })).toBeLessThan(0.5)
    expect(eloUpdate(1000, 1000, 'a')).toEqual(eloUpdate(1000, 1000, 'a', 1)) // the default is today's behaviour
  })

  it('never rates a duel against a bot, or a player against themselves', async () => {
    const vsBot = world()
    await playDuel(vsBot, { vsBot: true })
    expect(vsBot.db.tables.quiz_battle_ratings).toHaveLength(0)
    const same = world()
    await playDuel(same, { tagB: TAG_A })
    expect(same.db.tables.quiz_battle_ratings).toHaveLength(0)
  })

  it('counts a forfeit, and a player without a tag is simply not ranked', async () => {
    const w = world()
    const a = await w.create({ mode: 'duel', tag: TAG_A })
    w.at(START + 1000)
    await w.join(a.code, { tag: TAG_B })
    w.at(START + 1000 + DUEL_FORFEIT_MS + 5000)
    await w.call({ op: 'state', token: a.token })
    expect(w.db.tables.quiz_battle_ratings.find((r) => r.nickname === 'Ada')).toMatchObject({ wins: 1 })
    const untagged = world()
    const c = await untagged.create({ mode: 'duel', tag: undefined })
    untagged.at(START + 1000)
    await untagged.join(c.code, { tag: undefined })
    untagged.at(START + 1000 + DUEL_FORFEIT_MS + 5000)
    await untagged.call({ op: 'state', token: c.token })
    expect(untagged.db.tables.quiz_battle_ratings).toHaveLength(0)
  })

  it('lists the champions, all time and this week, and tells a player their own record', async () => {
    const w = world()
    await playDuel(w)
    const all = (await w.call({ op: 'ranking', period: 'all', tag: TAG_B })).body
    expect(all.top.map((r) => r.nickname)).toEqual(['Ada', 'Bayo'])
    expect(all.top[0]).toMatchObject({ rank: 1, wins: 1 })
    expect(all.top[0].rating).toBeGreaterThan(1000)
    expect(all.you).toMatchObject({ nickname: 'Bayo', rank: 2, losses: 1 })
    expect(JSON.stringify(all)).not.toMatch(/tag_hash|token/)
    const week = (await w.call({ op: 'ranking', period: 'week' })).body
    expect(week.period).toBe('week')
    expect(week.top[0]).toMatchObject({ nickname: 'Ada', wins: 1, losses: 0 })
    // a month later nobody has played this week
    w.at(START + 30 * 86_400_000)
    expect((await w.call({ op: 'ranking', period: 'week' })).body.top).toEqual([])
    expect((await w.call({ op: 'ranking', period: 'all' })).body.you).toBeNull()
  })

  it('marks which row on the champions list is the person asking', async () => {
    // A player who cannot remember which name they typed needs to see their own row called out. Matching on the nickname
    // would be wrong: two players are free to pick the same one.
    const w = world()
    await playDuel(w)
    const asB = (await w.call({ op: 'ranking', period: 'all', tag: TAG_B })).body
    expect(asB.top.map((r) => r.isYou)).toEqual([false, true])
    expect(asB.top.find((r) => r.isYou).nickname).toBe('Bayo')

    const asA = (await w.call({ op: 'ranking', period: 'all', tag: TAG_A })).body
    expect(asA.top.map((r) => r.isYou)).toEqual([true, false])

    // The week view is ordered by wins this week, not by rating, so "you" has to be marked rather than inferred from a
    // position. Here it happens to be the same row; the flag is what the page relies on, not the number.
    const week = (await w.call({ op: 'ranking', period: 'week', tag: TAG_A })).body
    expect(week.top.filter((r) => r.isYou)).toHaveLength(1)
    expect(week.top.find((r) => r.isYou).nickname).toBe('Ada')
  })

  it('tells two players apart when they have chosen the same nickname', async () => {
    const w = world()
    await playDuel(w)
    // Both players now have a record; force the same display name on both.
    for (const row of w.db.tables.quiz_battle_ratings) row.nickname = 'Same Name'
    const asA = (await w.call({ op: 'ranking', period: 'all', tag: TAG_A })).body
    const asB = (await w.call({ op: 'ranking', period: 'all', tag: TAG_B })).body
    // Same nickname on both rows, but only one of them is each player.
    expect(asA.top.filter((r) => r.nickname === 'Same Name')).toHaveLength(2)
    expect(asA.top.filter((r) => r.isYou)).toHaveLength(1)
    expect(asB.top.filter((r) => r.isYou)).toHaveLength(1)
    expect(asA.top.find((r) => r.isYou).rank).not.toBe(asB.top.find((r) => r.isYou).rank)
  })

  it('marks nobody when the asker has no record or sends no tag', async () => {
    const w = world()
    await playDuel(w)
    // No tag at all: nothing can be identified, and nothing is guessed.
    expect((await w.call({ op: 'ranking', period: 'all' })).body.top.every((r) => r.isYou === false)).toBe(true)
    // A tag that has never played.
    expect((await w.call({ op: 'ranking', period: 'all', tag: 'tag-cccccccccccccccc' })).body).toMatchObject({ you: null })
    expect((await w.call({ op: 'ranking', period: 'all', tag: 'tag-cccccccccccccccc' })).body.top.every((r) => r.isYou === false)).toBe(true)
  })

  it('never sends the tag hash out, even on the row that is marked as you', async () => {
    const w = world()
    await playDuel(w)
    const body = (await w.call({ op: 'ranking', period: 'all', tag: TAG_A })).body
    expect(JSON.stringify(body)).not.toMatch(/tag_hash/)
    expect(body.top.some((r) => r.isYou)).toBe(true)
  })
})

describe('battle: leaving', () => {
  it('cancels a duel nobody has joined, so the link stops working', async () => {
    const w = world()
    const a = await w.create({ mode: 'duel' })
    expect((await w.call({ op: 'leave', token: a.token })).body).toEqual({ left: true })
    expect((await w.call({ op: 'info', code: a.code })).body).toMatchObject({ expired: true, seatFree: false })
    expect((await w.join(a.code)).statusCode).toBe(410)
    expect((await w.call({ op: 'state', token: a.token })).body.state).toBe('cancelled')
  })

  it('leaving a duel under way loses it by default, and a duel against a bot is just dropped', async () => {
    const w = world()
    const a = await w.create({ mode: 'duel' })
    w.at(START + 1000)
    const b = (await w.join(a.code)).body
    await w.call({ op: 'leave', token: b.token })
    const after = (await w.call({ op: 'state', token: a.token })).body
    expect(after).toMatchObject({ state: 'finished', final: { winner: 'me', forfeit: true } })

    const bot = world()
    const c = await bot.create({ mode: 'duel', vsBot: true })
    await bot.call({ op: 'leave', token: c.token })
    expect((await bot.call({ op: 'state', token: c.token })).body.state).toBe('cancelled')
  })

  it('a challenger can cancel the challenge, and a friend who changes their mind frees the seat', async () => {
    const w = world()
    const a = await w.create()
    w.at(START + 1000)
    await playChallenge(w.call, a.token, RIGHT)
    const friend = (await w.join(a.code)).body
    expect(w.db.tables.quiz_battle_sides).toHaveLength(2)
    await w.call({ op: 'leave', token: friend.token })
    expect(w.db.tables.quiz_battle_sides).toHaveLength(1)
    expect((await w.join(a.code, { nickname: 'Cleo' })).statusCode).toBe(200)

    const solo = world()
    const b = await solo.create()
    await solo.call({ op: 'leave', token: b.token })
    expect((await solo.join(b.code)).statusCode).toBe(410)
  })

  it('leaving a finished battle is harmless, and needs a real token', async () => {
    const w = world()
    const a = await w.create()
    w.at(START + 1000)
    await playChallenge(w.call, a.token, RIGHT)
    const friend = (await w.join(a.code)).body
    await playChallenge(w.call, friend.token, WRONG)
    expect((await w.call({ op: 'leave', token: a.token })).body).toEqual({ left: true })
    expect((await w.call({ op: 'state', token: a.token })).body.state).toBe('finished')
    expect((await w.call({ op: 'leave', token: 'made-up' })).statusCode).toBe(401)
  })
})
