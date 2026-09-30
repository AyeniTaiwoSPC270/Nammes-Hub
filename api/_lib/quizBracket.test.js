import { describe, it, expect } from 'vitest'
import { bracketRounds, pairPlayers, matchWinner, botRoundScore, matchRows, bracketViewFor, podium, isRoundEnd, roundOfQuestion, winnerId } from './quizBracket.js'
import { createQuizAdvanceHandler } from './handlers/quiz-advance.js'
import { createQuizHostHandler } from './handlers/quiz-host.js'
import { createQuizStateHandler } from './handlers/quiz-state.js'
import { QUIZ, SESSION, fakeRes, fakeDb, admin, anon } from './quizTestKit.js'

const START = Date.parse('2026-10-01T10:00:00.000Z')
const iso = (ms) => new Date(ms).toISOString()

describe('bracket maths', () => {
  it('needs enough rounds to get down to one player, limited by the quiz', () => {
    expect(bracketRounds(8, 12, 1)).toBe(3)
    expect(bracketRounds(8, 12, 3)).toBe(3)
    expect(bracketRounds(50, 12, 3)).toBe(4) // would need 6, only 12 / 3 = 4 fit
    expect(bracketRounds(1, 12, 3)).toBe(1)
    expect(bracketRounds(0, 12, 3)).toBe(1)
    expect(bracketRounds(8, 2, 3)).toBe(0)
  })
  it('groups questions into rounds', () => {
    expect([0, 1, 2, 3, 5].map((i) => roundOfQuestion(i, 3))).toEqual([0, 0, 0, 1, 1])
    expect([0, 1, 2, 3, 5].map((i) => isRoundEnd(i, 3))).toEqual([false, false, true, false, true])
    expect(isRoundEnd(0, 1)).toBe(true)
  })
})

describe('pairPlayers', () => {
  const players = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, nickname: `P${i}` }))
  it('pairs everyone once, repeatably, with the odd player left for a bot', () => {
    const pairs = pairPlayers(players, 'seed')
    expect(pairs).toHaveLength(4)
    const seen = pairs.flatMap((p) => [p.a.id, p.b?.id]).filter(Boolean)
    expect(new Set(seen).size).toBe(7)
    expect(pairs.filter((p) => p.b === null)).toHaveLength(1)
    expect(pairPlayers(players, 'seed')).toEqual(pairs)
    expect(pairPlayers(players, 'other').map((p) => p.a.id)).not.toEqual(pairs.map((p) => p.a.id))
  })
})

describe('matchWinner', () => {
  const side = (score, speedMs = 1000, present = true) => ({ score, speedMs, present })
  it('higher score, then faster, then a repeatable flip; a missing side loses', () => {
    expect(matchWinner({ a: side(900), b: side(800), seedText: 'x' })).toBe('a')
    expect(matchWinner({ a: side(800), b: side(900), seedText: 'x' })).toBe('b')
    expect(matchWinner({ a: side(800, 5000), b: side(800, 4000), seedText: 'x' })).toBe('b')
    const flip = matchWinner({ a: side(0, 0), b: side(0, 0), seedText: 'same' })
    expect(['a', 'b']).toContain(flip)
    expect(matchWinner({ a: side(0, 0), b: side(0, 0), seedText: 'same' })).toBe(flip)
    expect(matchWinner({ a: side(0, 0, false), b: side(0, 0), seedText: 'x' })).toBe('b')
    expect(matchWinner({ a: side(5000), b: side(0, 0, false), seedText: 'x' })).toBe('a')
    expect(matchWinner({ a: side(0, 0, false), b: side(0, 0, false), seedText: 'x' })).toBeNull()
  })
})

describe('botRoundScore', () => {
  const questions = Array.from({ length: 3 }, (_, i) => ({ id: `q${i}`, type: 'multiple', options: ['a', 'b'], correct_index: 0, points: 1000, time_limit_seconds: 20, difficulty: 'easy' }))
  it('is repeatable and better for experts than beginners', () => {
    expect(botRoundScore({ botId: 'b1', skill: 'expert', questions })).toEqual(botRoundScore({ botId: 'b1', skill: 'expert', questions }))
    const total = (skill) => Array.from({ length: 200 }, (_, i) => botRoundScore({ botId: `bot${i}`, skill, questions }).score).reduce((a, b) => a + b, 0)
    expect(total('expert')).toBeGreaterThan(total('beginner'))
  })
})

describe('matchRows and views', () => {
  it('gives a bot opponent to an unpaired player', () => {
    const rows = matchRows({ sessionId: SESSION, round: 0, pairs: [{ a: { id: 'p1', nickname: 'A', avatar_id: 1 }, b: { id: 'p2', nickname: 'B', avatar_id: 2 } }, { a: { id: 'p3', nickname: 'C', avatar_id: 3 }, b: null }], botSkill: 'expert' })
    expect(rows[0]).toMatchObject({ player_b: 'p2', bot_b: false })
    expect(rows[1]).toMatchObject({ player_b: null, bot_b: true, bot_skill: 'expert' })
    expect(rows[1].name_b).toBeTruthy()
  })
  it('shows a player their match, result and status', () => {
    const session = { bracket_mode: true, bracket_rounds: 2, bracket_length: 3, bracket_done: false, bracket_champion: null }
    const matches = [{ round: 0, player_a: 'me', player_b: 'them', name_a: 'Me', name_b: 'Them', avatar_a: 1, avatar_b: 2, settled_at: iso(START), winner: 'b', score_a: 100, score_b: 200 }]
    expect(bracketViewFor(matches, 'me', session)).toMatchObject({ status: 'out', match: { won: false, myScore: 100, theirScore: 200, opponent: { nickname: 'Them' } } })
    expect(bracketViewFor(matches, 'them', session)).toMatchObject({ status: 'alive', match: { won: true } })
    expect(bracketViewFor(matches, 'them', { ...session, bracket_done: true, bracket_champion: 'them' }).status).toBe('champion')
    expect(bracketViewFor(matches, 'me', { ...session, bracket_mode: false })).toBeNull()
  })
  it('names the champion, runner-up and semifinal losers', () => {
    const m = (round, a, b, winner) => ({ round, player_a: a, player_b: b, name_a: a, name_b: b, avatar_a: 0, avatar_b: 0, bot_b: false, winner, settled_at: iso(START) })
    const matches = [m(0, 'p1', 'p2', 'a'), m(0, 'p3', 'p4', 'a'), m(1, 'p1', 'p3', 'a')]
    const out = podium(matches, 'p1')
    expect(out.champion).toBe('p1')
    expect(out.runnerUp.id).toBe('p3')
    expect(winnerId(matches[2])).toBe('p1')
    expect(out.semifinalists.map((p) => p.id).sort()).toEqual(['p2', 'p4'])
    expect(podium(matches, null)).toBeNull()
  })
})

// ---- a whole bracket game through the handlers ----
const PLAYERS = ['P1', 'P2', 'P3', 'P4'].map((n, i) => ({ id: `44444444-4444-4444-8444-44444444444${i + 1}`, session_id: SESSION, nickname: n, total_score: 0, avatar_id: i, joined_at: iso(START - 1000 * (9 - i)), streak: 0 }))
const questions = Array.from({ length: 6 }, (_, i) => ({ id: `q${i + 1}`, quiz_id: QUIZ, position: i, type: 'multiple', text: `Q${i + 1}?`, options: ['a', 'b'], correct_index: 0, time_limit_seconds: 20, points: 1000 }))

function game({ players = PLAYERS, session = {} } = {}) {
  return fakeDb({
    quiz_questions: questions,
    quiz_sessions: [{
      id: SESSION, quiz_id: QUIZ, join_code: '123456', state: 'lobby', current_question_index: -1, max_players: 40, paused_total_ms: 0, time_bonus_ms: 0, paused_at: null,
      bracket_mode: true, bracket_length: 1, bracket_bot_skill: 'average', bracket_rounds: null, bracket_done: false, bracket_champion: null, game_options: {}, ...session,
    }],
    quiz_players: players.map((p) => ({ ...p })),
  })
}
async function advance(db, expectedState, expectedIndex) {
  const res = fakeRes()
  await createQuizAdvanceHandler(() => db, { now: () => new Date(START) })(admin({ sessionId: SESSION, expectedState, expectedIndex }), res)
  return res
}
async function hostOp(db, body) {
  const res = fakeRes()
  await createQuizHostHandler(() => db, { now: () => new Date(START) })(admin({ sessionId: SESSION, ...body }), res)
  return res
}
// Gives each listed player points on question `position`, as if they had answered it.
const give = (db, position, points) => {
  for (const [id, pts] of Object.entries(points)) {
    db.tables.quiz_answers.push({ session_id: SESSION, player_id: id, question_id: `q${position + 1}`, points_awarded: pts, correct: pts > 0, elapsed_ms: 1000 })
    db.tables.quiz_players.find((p) => p.id === id).total_score += pts
  }
}
const ids = PLAYERS.map((p) => p.id)
// Plays question `i` of a bracket game: open, reveal, leaderboard (the round settles on the way to the leaderboard).
async function playQuestion(db, i, points) {
  if (i === 0) await advance(db, 'lobby', -1)
  else await advance(db, 'leaderboard', i - 1)
  give(db, i, points)
  await advance(db, 'question', i)
  await advance(db, 'reveal', i)
}

describe('a whole bracket game', () => {
  it('pairs everyone at the start and settles rounds until there is a champion', async () => {
    const db = game()
    await advance(db, 'lobby', -1)
    let matches = db.tables.quiz_bracket_matches
    expect(matches).toHaveLength(2)
    expect(matches.every((m) => m.round === 0 && m.player_a && m.player_b && !m.settled_at)).toBe(true)
    expect(db.tables.quiz_sessions[0].bracket_rounds).toBe(2)

    // question 1: P1 and P3 score highest (whoever they face, they win their match)
    give(db, 0, { [ids[0]]: 900, [ids[1]]: 100, [ids[2]]: 800, [ids[3]]: 200 })
    await advance(db, 'question', 0)
    await advance(db, 'reveal', 0)
    matches = db.tables.quiz_bracket_matches
    const round0 = matches.filter((m) => m.round === 0)
    expect(round0.every((m) => m.settled_at && m.winner)).toBe(true)
    const winners = round0.map((m) => winnerId(m))
    // the winner of each pair is whoever scored more in it
    const pts = { [ids[0]]: 900, [ids[1]]: 100, [ids[2]]: 800, [ids[3]]: 200 }
    for (const m of round0) expect(pts[winnerId(m)]).toBeGreaterThan(pts[m.winner === 'a' ? m.player_b : m.player_a])
    const finalMatches = matches.filter((m) => m.round === 1)
    expect(finalMatches).toHaveLength(1)
    expect([finalMatches[0].player_a, finalMatches[0].player_b].sort()).toEqual([...winners].sort())

    // the final: the higher scorer wins and is crowned
    await advance(db, 'leaderboard', 0)
    const [f1, f2] = [finalMatches[0].player_a, finalMatches[0].player_b]
    give(db, 1, { [f1]: 100, [f2]: 700 })
    await advance(db, 'question', 1)
    await advance(db, 'reveal', 1)
    expect(db.tables.quiz_sessions[0]).toMatchObject({ bracket_done: true, bracket_champion: f2 })
    expect(db.tables.quiz_bracket_matches.find((m) => m.round === 1)).toMatchObject({ score_a: expect.any(Number), settled_at: expect.any(String) })
  })

  it('a longer match adds up the scores of all its questions', async () => {
    const db = game({ session: { bracket_length: 3 } })
    await advance(db, 'lobby', -1)
    const m = db.tables.quiz_bracket_matches.find((x) => x.round === 0)
    const [a, b] = [m.player_a, m.player_b]
    give(db, 0, { [a]: 100, [b]: 900 })
    await advance(db, 'question', 0)
    await advance(db, 'reveal', 0)
    await advance(db, 'leaderboard', 0)
    expect(db.tables.quiz_bracket_matches.filter((x) => x.round === 0).every((x) => !x.settled_at)).toBe(true) // round not over yet
    give(db, 1, { [a]: 100, [b]: 0 })
    await advance(db, 'question', 1)
    await advance(db, 'reveal', 1)
    await advance(db, 'leaderboard', 1)
    give(db, 2, { [a]: 1200, [b]: 0 })
    await advance(db, 'question', 2)
    await advance(db, 'reveal', 2)
    const settled = db.tables.quiz_bracket_matches.find((x) => x.id === m.id)
    expect(settled).toMatchObject({ winner: 'a', score_a: 1400, score_b: 900 })
  })

  it('an odd player faces a bot, and a player who is removed forfeits', async () => {
    const three = game({ players: PLAYERS.slice(0, 3) })
    await advance(three, 'lobby', -1)
    const rows = three.tables.quiz_bracket_matches
    expect(rows).toHaveLength(2)
    expect(rows.filter((m) => m.bot_b)).toHaveLength(1)

    const db = game()
    await advance(db, 'lobby', -1)
    const m = db.tables.quiz_bracket_matches[0]
    db.tables.quiz_players = db.tables.quiz_players.filter((p) => p.id !== m.player_a)
    m.player_a = null // what "on delete set null" does
    give(db, 0, { [m.player_b]: 0 })
    await advance(db, 'question', 0)
    await advance(db, 'reveal', 0)
    expect(db.tables.quiz_bracket_matches.find((x) => x.id === m.id)).toMatchObject({ winner: 'b' })
  })

  it('a game whose quiz is too short for a bracket just plays normally', async () => {
    const db = game({ session: { bracket_length: 5 } })
    db.tables.quiz_questions = questions.slice(0, 3)
    await advance(db, 'lobby', -1)
    expect(db.tables.quiz_bracket_matches).toHaveLength(0)
    expect(db.tables.quiz_sessions[0]).toMatchObject({ bracket_rounds: 0, bracket_done: true })
  })

  it('skipping the last question of a round still settles it', async () => {
    const db = game()
    await advance(db, 'lobby', -1)
    await hostOp(db, { op: 'skip', expectedState: 'question', expectedIndex: 0 })
    expect(db.tables.quiz_bracket_matches.filter((m) => m.round === 0).every((m) => m.settled_at)).toBe(true)
  })

  it('a game that is not a bracket is untouched', async () => {
    const db = game({ session: { bracket_mode: false } })
    await advance(db, 'lobby', -1)
    await advance(db, 'question', 0)
    await advance(db, 'reveal', 0)
    expect(db.tables.quiz_bracket_matches).toHaveLength(0)
  })
})

describe('setBracket (host control)', () => {
  it('turns the bracket on with a length and bot level, only in the lobby', async () => {
    const db = game({ session: { bracket_mode: false } })
    expect((await hostOp(db, { op: 'setBracket', enabled: true, length: 3, botSkill: 'expert' })).statusCode).toBe(200)
    expect(db.tables.quiz_sessions[0]).toMatchObject({ bracket_mode: true, bracket_length: 3, bracket_bot_skill: 'expert' })
    expect((await hostOp(db, { op: 'setBracket', enabled: false })).statusCode).toBe(200)
    expect(db.tables.quiz_sessions[0].bracket_mode).toBe(false)
    db.tables.quiz_sessions[0].state = 'question'
    expect((await hostOp(db, { op: 'setBracket', enabled: true })).statusCode).toBe(409)
  })
  it('refuses a bad length, a quiz that is too short, and a team game', async () => {
    const db = game({ session: { bracket_mode: false } })
    expect((await hostOp(db, { op: 'setBracket', enabled: true, length: 2 })).statusCode).toBe(400)
    expect((await hostOp(db, { op: 'setBracket', enabled: true, length: 5, botSkill: 'genius' })).statusCode).toBe(400)
    db.tables.quiz_questions = questions.slice(0, 2)
    expect((await hostOp(db, { op: 'setBracket', enabled: true, length: 3 })).statusCode).toBe(409)
    db.tables.quiz_questions = questions
    db.tables.quiz_sessions[0].team_mode = true
    expect((await hostOp(db, { op: 'setBracket', enabled: true, length: 1 })).statusCode).toBe(409)
  })
})

describe('phones see the bracket', () => {
  it('state carries each player their own match', async () => {
    const db = game()
    db.tables.quiz_player_tokens.push(...PLAYERS.map((p, i) => ({ player_id: p.id, token_hash: `h${i}` })))
    await advance(db, 'lobby', -1)
    const res = fakeRes()
    // the fake token check hashes the token, so look the player up by the stored hash
    const { hashToken } = await import('./quiz.js')
    db.tables.quiz_player_tokens[0].token_hash = hashToken('tok-1')
    await createQuizStateHandler(() => db, { now: () => START, allow: () => true })(anon({ token: 'tok-1' }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.session.bracket).toMatchObject({ rounds: 2, length: 1, status: 'alive', match: { round: 0, settled: false } })
    expect(res.body.session.bracket.match.opponent.nickname).toBeTruthy()
  })
})
