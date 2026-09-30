import { describe, it, expect } from 'vitest'
import { createQuizHostHandler } from './handlers/quiz-host.js'
import { createQuizJoinHandler } from './handlers/quiz-join.js'
import { createQuizAnswerHandler } from './handlers/quiz-answer.js'
import { createQuizStateHandler } from './handlers/quiz-state.js'
import { QUIZ, SESSION, fakeRes, fakeDb, admin, anon } from './quizTestKit.js'
import { effectiveElapsedMs, questionLimitMs } from './quiz.js'
import { isQuizImagePath, publicImageUrl, quizImagePath, cleanAlt } from './quizImage.js'

const START = Date.parse('2026-10-01T10:00:00.000Z')
const iso = (ms) => new Date(ms).toISOString()
const P1 = '44444444-4444-4444-8444-444444444441'
const P2 = '44444444-4444-4444-8444-444444444442'

function game(extra = {}, sessionExtra = {}) {
  return fakeDb({
    quiz_sessions: [{
      id: SESSION, quiz_id: QUIZ, join_code: '123456', state: 'question', current_question_index: 0,
      question_started_at: iso(START), max_players: 40, paused_total_ms: 0, time_bonus_ms: 0, paused_at: null, ...sessionExtra,
    }],
    quiz_players: [
      { id: P1, session_id: SESSION, nickname: 'Ada', total_score: 0, avatar_id: 1, joined_at: iso(START - 5000) },
      { id: P2, session_id: SESSION, nickname: 'Bayo', total_score: 0, avatar_id: 2, joined_at: iso(START - 4000) },
    ],
    quiz_player_tokens: [
      { player_id: P1, token_hash: 'h1' },
      { player_id: P2, token_hash: 'h2' },
    ],
    ...extra,
  })
}

async function host(db, body, { at = START, pick } = {}) {
  const res = fakeRes()
  await createQuizHostHandler(() => db, { now: () => new Date(at), ...(pick ? { pickNumber: pick } : {}) })(admin({ sessionId: SESSION, ...body }), res)
  return res
}
const onQuestion = { expectedState: 'question', expectedIndex: 0 }

describe('timing helpers', () => {
  const session = { question_started_at: iso(START), paused_total_ms: 0, paused_at: null, time_bonus_ms: 0 }
  it('counts elapsed time without the paused time', () => {
    expect(effectiveElapsedMs(session, START + 5000)).toBe(5000)
    expect(effectiveElapsedMs({ ...session, paused_total_ms: 3000 }, START + 5000)).toBe(2000)
  })
  it('freezes the clock while paused', () => {
    const paused = { ...session, paused_at: iso(START + 4000) }
    expect(effectiveElapsedMs(paused, START + 4000)).toBe(4000)
    expect(effectiveElapsedMs(paused, START + 60_000)).toBe(4000)
  })
  it('adds extra time to the limit', () => {
    expect(questionLimitMs({ time_bonus_ms: 20_000 }, { time_limit_seconds: 20 })).toBe(40_000)
    expect(questionLimitMs({}, { time_limit_seconds: 20 })).toBe(20_000)
  })
})

describe('quiz-host: access', () => {
  it('needs an admin, a known op and ids', async () => {
    const db = game()
    let res = fakeRes()
    await createQuizHostHandler(() => db)(anon({ sessionId: SESSION, op: 'lock' }), res)
    expect(res.statusCode).toBe(401)
    db.tables.admins = []
    res = await host(db, { op: 'lock' })
    expect(res.statusCode).toBe(403)
    const ok = game()
    expect((await host(ok, { op: 'explode' })).statusCode).toBe(400)
    expect((await host(ok, { op: 'kick' })).statusCode).toBe(400)
    expect((await host(ok, { op: 'pause' })).statusCode).toBe(400)
  })
  it('404 for an unknown game and 409 for a finished one', async () => {
    const db = game()
    const res = fakeRes()
    await createQuizHostHandler(() => db)(admin({ sessionId: '55555555-5555-4555-8555-555555555555', op: 'lock' }), res)
    expect(res.statusCode).toBe(404)
    const done = game({}, { state: 'finished' })
    expect((await host(done, { op: 'lock' })).statusCode).toBe(409)
  })
})

describe('quiz-host: lock', () => {
  it('stops new players joining until unlocked, and logs it', async () => {
    const db = game({}, { state: 'lobby', current_question_index: -1 })
    const join = async () => {
      const res = fakeRes()
      await createQuizJoinHandler(() => db, { allow: () => true })(anon({ code: '123456', nickname: 'Chidi' }), res)
      return res
    }
    expect((await host(db, { op: 'lock' })).body.session.locked).toBe(true)
    const blocked = await join()
    expect(blocked.statusCode).toBe(403)
    expect(blocked.body.error).toMatch(/locked/i)
    await host(db, { op: 'unlock' })
    expect((await join()).statusCode).toBe(200)
    expect(db.tables.quiz_host_log.map((l) => l.op)).toEqual(['lock', 'unlock'])
  })
})

describe('quiz-host: kick and rename', () => {
  it('removes the player and their token; their phone is told to rejoin', async () => {
    const db = game({}, { state: 'lobby', current_question_index: -1 })
    db.tables.quiz_player_tokens[0].token_hash = '5d41402abc4b2a76b9719d911017c592'
    const res = await host(db, { op: 'kick', playerId: P1 })
    expect(res.statusCode).toBe(200)
    expect(db.tables.quiz_players.map((p) => p.id)).toEqual([P2])
    expect(db.tables.quiz_player_tokens.map((t) => t.player_id)).toEqual([P2])
  })
  it('can block the nickname from coming straight back', async () => {
    const db = game({}, { state: 'lobby', current_question_index: -1 })
    await host(db, { op: 'kick', playerId: P1, block: true })
    const res = fakeRes()
    await createQuizJoinHandler(() => db, { allow: () => true })(anon({ code: '123456', nickname: 'ADA' }), res)
    expect(res.statusCode).toBe(403)
    const other = fakeRes()
    await createQuizJoinHandler(() => db, { allow: () => true })(anon({ code: '123456', nickname: 'Adaora' }), other)
    expect(other.statusCode).toBe(200)
  })
  it('without blocking, the same nickname can rejoin', async () => {
    const db = game({}, { state: 'lobby', current_question_index: -1 })
    await host(db, { op: 'kick', playerId: P1 })
    const res = fakeRes()
    await createQuizJoinHandler(() => db, { allow: () => true })(anon({ code: '123456', nickname: 'Ada' }), res)
    expect(res.statusCode).toBe(200)
  })
  it('cancels a full-lobby countdown when the lobby is no longer full', async () => {
    const db = game({}, { state: 'lobby', current_question_index: -1, max_players: 2, full_at: iso(START) })
    await host(db, { op: 'kick', playerId: P2 })
    expect(db.tables.quiz_sessions[0].full_at).toBeNull()
  })
  it('only touches players of this game', async () => {
    const db = game()
    db.tables.quiz_players.push({ id: '44444444-4444-4444-8444-444444444449', session_id: 'other', nickname: 'Zed', total_score: 0 })
    const res = await host(db, { op: 'kick', playerId: '44444444-4444-4444-8444-444444444449' })
    expect(res.statusCode).toBe(404)
    expect(db.tables.quiz_players).toHaveLength(3)
  })
  it('renames to a neutral name, retrying a clash', async () => {
    const db = game()
    db.tables.quiz_players.push({ id: '44444444-4444-4444-8444-444444444448', session_id: SESSION, nickname: 'Player 111', total_score: 0 })
    const picks = [111, 222]
    const res = await host(db, { op: 'rename', playerId: P1 }, { pick: () => picks.shift() })
    expect(res.statusCode).toBe(200)
    expect(db.tables.quiz_players.find((p) => p.id === P1).nickname).toBe('Player 222')
  })
})

describe('quiz-host: pause, resume and extra time', () => {
  async function answer(db, token, index, at) {
    const res = fakeRes()
    await createQuizAnswerHandler(() => db, { now: () => at, allow: () => true })(anon({ token, chosenIndex: index }), res)
    return res
  }
  function withTokens() {
    const db = game()
    // the answer handler hashes the token, so store the hashes of "t1" and "t2"
    return import('./quiz.js').then(({ hashToken }) => {
      db.tables.quiz_player_tokens = [{ player_id: P1, token_hash: hashToken('t1') }, { player_id: P2, token_hash: hashToken('t2') }]
      return db
    })
  }

  it('refuses answers while paused and gives the paused time back on resume', async () => {
    const db = await withTokens()
    await host(db, { op: 'pause', ...onQuestion }, { at: START + 5000 })
    expect(db.tables.quiz_sessions[0].paused_at).toBe(iso(START + 5000))
    expect((await answer(db, 't1', 1, START + 9000)).statusCode).toBe(409)
    // paused for 30 s; by wall clock it is 35 s in, but only 5 s of the 20 s have been played
    await host(db, { op: 'resume', ...onQuestion }, { at: START + 35_000 })
    expect(db.tables.quiz_sessions[0].paused_total_ms).toBe(30_000)
    const res = await answer(db, 't1', 1, START + 35_000)
    expect(res.statusCode).toBe(200)
    // 5 s of 20 s played -> 1000 * (1 - 0.25/2) = 875
    expect(db.tables.quiz_players.find((p) => p.id === P1).total_score).toBe(875)
  })
  it('pause and resume twice in a row are harmless', async () => {
    const db = await withTokens()
    await host(db, { op: 'pause', ...onQuestion }, { at: START + 1000 })
    await host(db, { op: 'pause', ...onQuestion }, { at: START + 2000 })
    expect(db.tables.quiz_sessions[0].paused_at).toBe(iso(START + 1000))
    await host(db, { op: 'resume', ...onQuestion }, { at: START + 4000 })
    await host(db, { op: 'resume', ...onQuestion }, { at: START + 9000 })
    expect(db.tables.quiz_sessions[0].paused_total_ms).toBe(3000)
  })
  it('adds 10 seconds at a time up to 60, and late answers then count', async () => {
    const db = await withTokens()
    expect((await answer(db, 't1', 1, START + 30_000)).statusCode).toBe(409) // 20 s question, long over
    for (let i = 0; i < 6; i++) expect((await host(db, { op: 'extend', ...onQuestion })).statusCode).toBe(200)
    expect(db.tables.quiz_sessions[0].time_bonus_ms).toBe(60_000)
    expect((await host(db, { op: 'extend', ...onQuestion })).statusCode).toBe(409)
    expect((await answer(db, 't1', 1, START + 30_000)).statusCode).toBe(200)
  })
  it('rejects a stale click that names the wrong question or step', async () => {
    const db = game()
    expect((await host(db, { op: 'pause', expectedState: 'question', expectedIndex: 3 })).statusCode).toBe(409)
    expect((await host(db, { op: 'pause', expectedState: 'reveal', expectedIndex: 0 })).statusCode).toBe(409)
    const reveal = game({}, { state: 'reveal' })
    expect((await host(reveal, { op: 'extend', expectedState: 'reveal', expectedIndex: 0 })).statusCode).toBe(409)
  })
})

describe('quiz-host: skip', () => {
  it('throws away the answers, takes the points back, and starts the next question with a clean clock', async () => {
    const db = game({ quiz_answers: [
      { session_id: SESSION, player_id: P1, question_id: 'q1', chosen_index: 1, points_awarded: 900 },
      { session_id: SESSION, player_id: P2, question_id: 'q1', chosen_index: 0, points_awarded: 0 },
    ] }, { time_bonus_ms: 20_000, paused_total_ms: 4000 })
    db.tables.quiz_players[0].total_score = 900
    const res = await host(db, { op: 'skip', ...onQuestion }, { at: START + 7000 })
    expect(res.statusCode).toBe(200)
    expect(res.body.session).toMatchObject({ state: 'question', current_question_index: 1, time_bonus_ms: 0, paused_total_ms: 0, paused_at: null })
    expect(res.body.session.question_started_at).toBe(iso(START + 7000))
    expect(db.tables.quiz_players[0].total_score).toBe(0)
    expect(db.tables.quiz_answers).toHaveLength(0)
  })
  it('skipping the last question finishes the game', async () => {
    const db = game({}, { current_question_index: 1 })
    const res = await host(db, { op: 'skip', expectedState: 'question', expectedIndex: 1 })
    expect(res.body.session.state).toBe('finished')
  })
})

describe('what phones are told', () => {
  it('includes the clock fields so every screen counts down the same way', async () => {
    const db = game({}, { paused_at: iso(START + 3000), paused_total_ms: 1000, time_bonus_ms: 10_000 })
    const { hashToken } = await import('./quiz.js')
    db.tables.quiz_player_tokens[0].token_hash = hashToken('t1')
    const res = fakeRes()
    await createQuizStateHandler(() => db, { allow: () => true, now: () => START + 4000, baseUrl: 'https://x.supabase.co' })(anon({ token: 't1' }), res)
    expect(res.body.session).toMatchObject({ paused: true, pausedAt: iso(START + 3000), pausedTotalMs: 1000, timeBonusMs: 10_000 })
  })
})

describe('question images', () => {
  const Q = '66666666-6666-4666-8666-666666666666'
  it('accepts only paths of the exact shape inside the right quiz', () => {
    const good = `${QUIZ}/${Q}.webp`
    expect(isQuizImagePath(good)).toBe(true)
    expect(isQuizImagePath(`${QUIZ}/${Q}-1767261600000.png`, QUIZ)).toBe(true)
    expect(isQuizImagePath(good, '77777777-7777-4777-8777-777777777777')).toBe(false)
    for (const bad of [`../${Q}.webp`, `${QUIZ}/../${Q}.webp`, `${QUIZ}/${Q}.svg`, `${QUIZ}/${Q}.webp?x=1`, `https://evil.example/${Q}.webp`, `${QUIZ}/${Q}.webp/extra`, null, 5, '']) {
      expect(isQuizImagePath(bad), String(bad)).toBe(false)
    }
  })
  it('builds the public address only from a valid path', () => {
    expect(publicImageUrl('https://x.supabase.co/', `${QUIZ}/${Q}.jpg`, QUIZ)).toBe(`https://x.supabase.co/storage/v1/object/public/quiz-images/${QUIZ}/${Q}.jpg`)
    expect(publicImageUrl('https://x.supabase.co', 'http://evil/x.png', QUIZ)).toBeNull()
    expect(publicImageUrl('', `${QUIZ}/${Q}.jpg`, QUIZ)).toBeNull()
    expect(quizImagePath({ quizId: QUIZ, questionId: Q, ext: 'webp', stamp: 1767261600000 })).toBe(`${QUIZ}/${Q}-1767261600000.webp`)
  })
  it('tidies alt text', () => {
    expect(cleanAlt('  a\n\tgraph   of x ')).toBe('a graph of x')
    expect(cleanAlt('y'.repeat(500))).toHaveLength(200)
    expect(cleanAlt(7)).toBe('')
  })
  it('puts the picture on the current question, and the next picture only on the leaderboard', async () => {
    const db = game({}, {})
    db.tables.quiz_questions[0].image_path = `${QUIZ}/${Q}.webp`
    db.tables.quiz_questions[0].image_alt = 'A parabola'
    db.tables.quiz_questions[1].image_path = `${QUIZ}/${'88888888-8888-4888-8888-888888888888'}.png`
    const { hashToken } = await import('./quiz.js')
    db.tables.quiz_player_tokens[0].token_hash = hashToken('t1')
    const ask = async () => {
      const res = fakeRes()
      await createQuizStateHandler(() => db, { allow: () => true, now: () => START, baseUrl: 'https://x.supabase.co' })(anon({ token: 't1' }), res)
      return res.body
    }
    let body = await ask()
    expect(body.question.imageUrl).toBe(`https://x.supabase.co/storage/v1/object/public/quiz-images/${QUIZ}/${Q}.webp`)
    expect(body.question.imageAlt).toBe('A parabola')
    expect(body.nextImageUrl).toBeUndefined()
    db.tables.quiz_sessions[0].state = 'leaderboard'
    body = await ask()
    expect(body.nextImageUrl).toContain('88888888-8888-4888-8888-888888888888.png')
    expect(JSON.stringify(body)).not.toContain('Q2?') // the next question's text never leaks
  })
  it('ignores a hand-edited path that is not a valid image path', async () => {
    const db = game()
    db.tables.quiz_questions[0].image_path = 'https://evil.example/pixel.png'
    const { hashToken } = await import('./quiz.js')
    db.tables.quiz_player_tokens[0].token_hash = hashToken('t1')
    const res = fakeRes()
    await createQuizStateHandler(() => db, { allow: () => true, now: () => START, baseUrl: 'https://x.supabase.co' })(anon({ token: 't1' }), res)
    expect(res.body.question.imageUrl).toBeNull()
  })
})
