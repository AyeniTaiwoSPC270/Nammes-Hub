import { describe, expect, it } from 'vitest'
import { createQuizJoinHandler } from './quiz-join.js'
import { hashToken } from '../quiz.js'
import { QUIZ, SESSION, fakeDb, fakeRes } from '../quizTestKit.js'

const CODE = '123456'
const TOKEN = 'the-secret-token'
const PLAYER = '44444444-4444-4444-8444-444444444444'
const TEAM = '55555555-5555-4555-8555-555555555555'
const allow = () => true

function lobby(overrides = {}, seed = {}) {
  return fakeDb({
    quizzes: [{ id: QUIZ, max_players: 40 }],
    quiz_sessions: [{
      id: SESSION,
      quiz_id: QUIZ,
      join_code: CODE,
      state: 'lobby',
      max_players: 40,
      locked: false,
      blocked_nicknames: [],
      team_mode: false,
      characters: [],
      ...overrides,
    }],
    quiz_players: [],
    quiz_player_tokens: [],
    ...seed,
  })
}

// A seat that is already taken, with the token that opens it.
function seated({ locked = false, team_mode = false, maxPlayers = 40 } = {}) {
  return lobby({ locked, team_mode, max_players: maxPlayers }, {
    quiz_players: [{ id: PLAYER, session_id: SESSION, nickname: 'Ada', total_score: 3400, streak: 3, avatar_id: 4 }],
    quiz_player_tokens: [{ player_id: PLAYER, token_hash: hashToken(TOKEN) }],
  })
}

function join(db, body) {
  const res = fakeRes()
  return createQuizJoinHandler(() => db, { allow })({ method: 'POST', headers: {}, body, query: {} }, res).then(() => res)
}

describe('rejoin', () => {
  // The scenario the whole feature exists for: a phone reloads mid-game, keeps its nickname, and the unique index on
  // (session_id, lower(nickname)) answers "That nickname is taken. Pick another." The student did not pick another
  // nickname, and should not have to -- they are the person who took it.
  it('gives the seat back to the token that owns it', async () => {
    const res = await join(seated(), { code: CODE, nickname: 'Ada', avatarId: 4, token: TOKEN })
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ playerId: PLAYER, token: TOKEN, nickname: 'Ada', score: 3400, streak: 3, resumed: true })
  })

  // The index is on lower(nickname), so the student who types "ada" is the same player as the one stored as "Ada".
  // Matching case-sensitively would hand their own seat to the next person to type it.
  it('matches the nickname without regard to case', async () => {
    const res = await join(seated(), { code: CODE, nickname: 'aDa', avatarId: 4, token: TOKEN })
    expect(res.statusCode).toBe(200)
    expect(res.body.playerId).toBe(PLAYER)
  })

  // "This game is full" is the worst possible answer to the one person it is about. A full lobby has to be joinable
  // by the player who already holds a seat in it, and only by them.
  it('is not refused by a full lobby', async () => {
    const res = await join(seated({ maxPlayers: 1 }), { code: CODE, nickname: 'Ada', avatarId: 4, token: TOKEN })
    expect(res.statusCode).toBe(200)
    expect(res.body.playerId).toBe(PLAYER)
  })

  // Same reason. A host who locks the lobby is stopping new names in, not ejecting the people already in it.
  it('is not refused by a locked lobby', async () => {
    const res = await join(seated({ locked: true }), { code: CODE, nickname: 'Ada', avatarId: 4, token: TOKEN })
    expect(res.statusCode).toBe(200)
    expect(res.body.playerId).toBe(PLAYER)
  })

  it('carries the team back, so a resumed phone is not asked to pick one again', async () => {
    const db = seated({ team_mode: true })
    db.tables.quiz_players[0].team_id = TEAM
    db.tables.quiz_teams = [{ id: TEAM, session_id: SESSION, name: 'Reds', color: '#ef4444', position: 0 }]
    const res = await join(db, { code: CODE, nickname: 'Ada', avatarId: 4, token: TOKEN })
    expect(res.statusCode).toBe(200)
    expect(res.body.team).toMatchObject({ id: TEAM, name: 'Reds' })
  })

  // Everything below is the other half of the contract: a resume must never become a way to take a seat by guessing.
  it('refuses a wrong token and says nothing about the seat', async () => {
    const res = await join(seated(), { code: CODE, nickname: 'Ada', avatarId: 4, token: 'guess' })
    expect(res.statusCode).toBe(409)
    expect(JSON.stringify(res.body)).not.toContain(PLAYER)
    expect(res.body.error).toBe('That nickname is taken. Pick another.')
  })

  it('refuses when no token is offered at all', async () => {
    const res = await join(seated(), { code: CODE, nickname: 'Ada', avatarId: 4 })
    expect(res.statusCode).toBe(409)
  })

  // An empty string must not hash into something that could collide, and must not be treated as "no token supplied"
  // in a way that skips the check.
  it('refuses an empty token', async () => {
    const res = await join(seated(), { code: CODE, nickname: 'Ada', avatarId: 4, token: '' })
    expect(res.statusCode).toBe(409)
  })

  it('refuses a token of the wrong shape without reaching the database for one', async () => {
    const res = await join(seated(), { code: CODE, nickname: 'Ada', avatarId: 4, token: { toString: () => TOKEN } })
    expect(res.statusCode).toBe(409)
  })

  // A resumed session keeps its seat but must not be able to smuggle in a nickname the host blocked, so the block is
  // still consulted -- it just happens after the resume is known not to apply.
  it('still refuses a nickname the host blocked', async () => {
    const res = await join(lobby({ blocked_nicknames: ['ada'] }, {
      quiz_players: [{ id: PLAYER, session_id: SESSION, nickname: 'Ada', total_score: 0, streak: 0, avatar_id: 4 }],
      quiz_player_tokens: [{ player_id: PLAYER, token_hash: hashToken('someone-elses-token') }],
    }), { code: CODE, nickname: 'Ada', avatarId: 4, token: 'someone-elses-token' })
    expect(res.statusCode).toBe(403)
    expect(res.body.error).toBe('Please pick a different nickname')
  })

  // A brand new player must not be handed a `resumed` shape, because the phone keys its "welcome back" copy off it.
  it('does not mark an ordinary first join as resumed', async () => {
    const res = await join(lobby(), { code: CODE, nickname: 'Grace', avatarId: 0 })
    expect(res.statusCode).toBe(200)
    expect(res.body.resumed).toBeUndefined()
    expect(res.body.token).toEqual(expect.any(String))
  })

  it('still validates the nickname before trying to resume, so the lookup is never asked to match junk', async () => {
    const res = await join(seated(), { code: CODE, nickname: '', avatarId: 4, token: TOKEN })
    expect(res.statusCode).toBe(400)
  })
})