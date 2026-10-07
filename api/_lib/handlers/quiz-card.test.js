import { describe, expect, it } from 'vitest'
import { createQuizCardHandler } from './quiz-card.js'
import { buildPracticeMe } from '../quizCardData.js'
import { hashToken } from '../quiz.js'
import { QUIZ, SESSION, fakeDb, fakeRes } from '../quizTestKit.js'

const TOKEN = 'player-token'
const SHARE = 'ABCD2345'
const BATTLE = 'AB12CD'

const allow = () => true
const get = (query, headers = {}) => ({ method: 'GET', headers, query })

function finishedGame(overrides = {}) {
  return fakeDb({
    quizzes: [{ id: QUIZ, title: 'Naming Origins', theme: {}, card: {} }],
    quiz_sessions: [{ id: SESSION, quiz_id: QUIZ, state: 'finished', team_mode: false, theme: {}, card: {}, question_ids: ['q1', 'q2'], ...overrides }],
    quiz_players: [{ id: 'p1', session_id: SESSION, nickname: 'Ada', total_score: 14200, avatar_id: 13, streak: 5 }],
    // The endpoint resolves a player by hashing the token it is given, exactly as quiz-state.js does.
    quiz_player_tokens: [{ player_id: 'p1', token_hash: hashToken(TOKEN) }],
  })
}

function run(game, query = { session: SESSION, token: TOKEN }, options = {}) {
  const res = fakeRes()
  res.send = (b) => { res.body = b; return res }
  return createQuizCardHandler(() => game, { allow, ...options })(get(query, options.headers ?? {}), res).then(() => res)
}

const isPng = (body) => Buffer.isBuffer(body) && body.subarray(1, 4).toString() === 'PNG'

describe('quiz card endpoint', () => {
  it('refuses anything that is not a GET', async () => {
    const res = fakeRes()
    await createQuizCardHandler(() => finishedGame(), { allow })({ method: 'POST', headers: {}, query: {} }, res)
    expect(res.statusCode).toBe(405)
  })

  it('rejects a malformed session id', async () => {
    const res = await run(finishedGame(), { session: 'not-a-uuid', token: TOKEN })
    expect(res.statusCode).toBe(400)
  })

  it('rejects a missing token rather than serving the card to anyone', async () => {
    const res = await run(finishedGame(), { session: SESSION })
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('token is required')
  })

  it('rejects an unknown player token with 401 and the state handler message', async () => {
    const res = await run(finishedGame(), { session: SESSION, token: 'nope' })
    expect(res.statusCode).toBe(401)
    expect(res.body.error).toBe('Unknown player. Rejoin the game.')
  })

  it('refuses a card for a game that has not finished', async () => {
    const res = await run(finishedGame({ state: 'question' }), { session: SESSION, token: TOKEN })
    expect(res.statusCode).toBe(410)
    expect(res.body.error).toBe('This game is not finished yet.')
  })

  it('throttles rather than rendering', async () => {
    const res = await run(finishedGame(), { session: SESSION, token: TOKEN }, { allow: () => false })
    expect(res.statusCode).toBe(429)
  })

  it('serves a finished player card as a png with no-store', async () => {
    const res = await run(finishedGame())
    expect(res.statusCode).toBe(200)
    expect(res.headers['Content-Type']).toBe('image/png')
    expect(res.headers['Cache-Control']).toBe('no-store')
    expect(isPng(res.body)).toBe(true)
  })

  it('serves a board card to an admin and caches it briefly', async () => {
    const res = await run(finishedGame(), { session: SESSION, view: 'board' }, {
      headers: { authorization: 'Bearer good' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['Cache-Control']).toBe('public, s-maxage=300')
    expect(isPng(res.body)).toBe(true)
  })

  it('refuses a board card to a signed-in non-admin', async () => {
    const res = await run(finishedGame(), { session: SESSION, view: 'board' }, {
      headers: { authorization: 'Bearer bad' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('refuses a board card with no session at all', async () => {
    const res = await run(finishedGame(), { session: SESSION, view: 'board' })
    expect(res.statusCode).toBe(401)
  })

  it('never sends a player card to a viewer asking for the whole board', async () => {
    // The token only ever resolves its own player, so a player token plus view=board must not widen the result.
    const res = await run(finishedGame(), { session: SESSION, token: TOKEN, view: 'board' }, {
      headers: { authorization: 'Bearer bad' },
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('practice cards', () => {
  function practiceGame(overrides = {}) {
    return fakeDb({
      quizzes: [{ id: QUIZ, title: 'Naming Origins', theme: {}, card: {} }],
      quiz_practice_runs: [{
        id: 'r1', quiz_id: QUIZ, nickname: 'Ada', avatar_id: 24, total_score: 8600,
        share_code: SHARE, question_ids: ['q1', 'q2'], ...overrides,
      }],
      quiz_practice_answers: [
        { run_id: 'r1', question_id: 'q1', correct: true },
        { run_id: 'r1', question_id: 'q2', correct: false },
      ],
    })
  }

  it('serves a practice card by share code', async () => {
    const res = await run(practiceGame(), { practice: SHARE })
    expect(res.statusCode).toBe(200)
    expect(res.headers['Cache-Control']).toBe('no-store')
    expect(isPng(res.body)).toBe(true)
  })

  it('rejects a malformed share code', async () => {
    const res = await run(practiceGame(), { practice: 'lowercase!' })
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('Invalid share code')
  })

  it('reports a practice card whose run has been cleaned up', async () => {
    const res = await run(fakeDb(), { practice: SHARE })
    expect(res.statusCode).toBe(410)
    expect(res.body.error).toBe('This practice run is no longer stored.')
  })
})

describe('battle cards', () => {
  function battleGame(overrides = {}) {
    return fakeDb({
      quizzes: [{ id: QUIZ, title: 'Naming Origins', theme: {}, card: {} }],
      quiz_battles: [{
        id: 'b1', quiz_id: QUIZ, code: BATTLE, state: 'finished', winner_slot: 'a',
        forfeit: false, question_ids: ['q1', 'q2'], ...overrides,
      }],
      quiz_battle_sides: [
        { battle_id: 'b1', slot: 'a', nickname: 'Ada', avatar_id: 13, total_score: 14200 },
        { battle_id: 'b1', slot: 'b', nickname: 'Bola', avatar_id: 24, total_score: 9900 },
      ],
    })
  }

  it('serves a duel card by battle code', async () => {
    const res = await run(battleGame(), { battle: BATTLE })
    expect(res.statusCode).toBe(200)
    expect(isPng(res.body)).toBe(true)
  })

  it('accepts a lowercase code, since the URL may have been retyped', async () => {
    const res = await run(battleGame(), { battle: 'ab12cd' })
    expect(res.statusCode).toBe(200)
  })

  it('rejects a malformed battle code', async () => {
    const res = await run(battleGame(), { battle: 'lower case' })
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('Invalid battle code')
  })

  it('reports a duel that has not finished as a conflict, not a gone result', async () => {
    const res = await run(battleGame({ state: 'reveal' }), { battle: BATTLE })
    expect(res.statusCode).toBe(409)
    expect(res.body.error).toBe('This duel is not finished yet.')
  })

  it('reports an unknown duel', async () => {
    const res = await run(fakeDb(), { battle: BATTLE })
    expect(res.statusCode).toBe(404)
  })
})

describe('the studio preview', () => {
  it('renders sample data for anyone who knows a quiz id, because an <img> cannot send a bearer token', async () => {
    // Deliberately reachable without admin: it draws invented numbers, never a real player.
    const res = await run(fakeDb({ quizzes: [{ id: QUIZ, title: 'Naming Origins', theme: {}, card: {} }] }), { preview: QUIZ })
    expect(res.statusCode).toBe(200)
    expect(isPng(res.body)).toBe(true)
  })

  it('rejects a malformed quiz id', async () => {
    const res = await run(fakeDb(), { preview: 'nope' })
    expect(res.statusCode).toBe(400)
  })
})

describe('buildPracticeMe', () => {
  it('never shows a streak or a rank on a practice card, because practice has neither', () => {
    expect(buildPracticeMe({ nickname: 'Ada', avatar_id: 3, total_score: 900 }, [{ correct: true }, { correct: false }], 5)).toEqual({
      nickname: 'Ada', avatarId: 3, score: 900, rank: null, playerCount: null,
      correctCount: 1, totalQuestions: 5, bestStreak: null, teamName: null,
    })
  })

  it('leaves the question total off when there is none, rather than saying "0 of 0"', () => {
    expect(buildPracticeMe({ nickname: 'A', total_score: 1 }, [], 0).totalQuestions).toBeNull()
  })

  it('defaults a missing character to the first one', () => {
    expect(buildPracticeMe({ nickname: 'A', total_score: 1 }, [], 3).avatarId).toBe(0)
  })
})