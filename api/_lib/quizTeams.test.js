import { describe, it, expect } from 'vitest'
import { cleanTeams, cleanTeamName, pickAutoTeam, rankTeams, TEAM_PRESETS, TEAM_COLORS } from './quizTeams.js'
import { createQuizCreateHandler } from './handlers/quiz-create.js'
import { createQuizJoinHandler } from './handlers/quiz-join.js'
import { createQuizStateHandler } from './handlers/quiz-state.js'
import { hashToken } from './quiz.js'
import { QUIZ, SESSION, fakeRes, fakeDb, admin, anon } from './quizTestKit.js'

describe('cleanTeams', () => {
  it('accepts 2 to 8 teams and numbers them', () => {
    const res = cleanTeams([{ name: ' 100L ', color: 'red', avatarId: 3 }, { name: '200L' }])
    expect(res.ok).toBe(true)
    expect(res.teams).toEqual([
      { name: '100L', color: 'red', avatarId: 3, position: 0 },
      { name: '200L', color: TEAM_COLORS[1], avatarId: 0, position: 1 },
    ])
  })
  it('rejects too few, too many, blank, rude or repeated names', () => {
    expect(cleanTeams([{ name: 'Solo' }]).ok).toBe(false)
    expect(cleanTeams(Array.from({ length: 9 }, (_, i) => ({ name: `T${i}` }))).ok).toBe(false)
    expect(cleanTeams([{ name: 'A' }, { name: '   ' }]).ok).toBe(false)
    expect(cleanTeams([{ name: 'A' }, { name: 'sh1t' }]).ok).toBe(true) // only the obvious words are blocked
    expect(cleanTeams([{ name: 'A' }, { name: 'shit' }]).ok).toBe(false)
    expect(cleanTeams([{ name: 'Red' }, { name: 'red' }]).error).toMatch(/called/)
    expect(cleanTeams([{ name: 'x'.repeat(25) }, { name: 'B' }]).ok).toBe(false)
    expect(cleanTeams('nope').ok).toBe(false)
  })
  it('falls back to safe colours and mascots for bad values', () => {
    const { teams } = cleanTeams([{ name: 'A', color: 'url(evil)', avatarId: 99 }, { name: 'B', color: 'blue', avatarId: 'x' }])
    expect(teams[0]).toMatchObject({ color: TEAM_COLORS[0], avatarId: 0 })
    expect(teams[1]).toMatchObject({ color: 'blue', avatarId: 0 })
  })
  it('has presets that pass their own checks', () => {
    for (const preset of Object.values(TEAM_PRESETS)) expect(cleanTeams(preset.teams).ok).toBe(true)
    expect(cleanTeamName('Level 200')).toBe('Level 200')
  })
})

describe('pickAutoTeam and rankTeams', () => {
  const teams = [{ id: 'a', position: 0 }, { id: 'b', position: 1 }, { id: 'c', position: 2 }]
  it('puts the next player on the smallest team, the first on a tie', () => {
    expect(pickAutoTeam(teams, []).id).toBe('a')
    expect(pickAutoTeam(teams, [{ team_id: 'a' }, { team_id: 'a' }, { team_id: 'b' }]).id).toBe('c')
    expect(pickAutoTeam(teams, [{ team_id: 'a' }, { team_id: 'b' }, { team_id: 'c' }]).id).toBe('a')
    expect(pickAutoTeam([], [])).toBeNull()
  })
  const teamRows = [
    { id: 'a', name: 'Big', color: 'red', avatar_id: 1, position: 0 },
    { id: 'b', name: 'Small', color: 'blue', avatar_id: 2, position: 1 },
    { id: 'c', name: 'Empty', color: 'green', avatar_id: 3, position: 2 },
  ]
  const players = [
    ...[1000, 1000, 1000, 1000].map((s, i) => ({ id: `a${i}`, team_id: 'a', total_score: s })),
    { id: 'b0', team_id: 'b', total_score: 2500 },
  ]
  it('averages by default so a big class does not win on numbers alone', () => {
    const ranked = rankTeams({ teams: teamRows, players })
    expect(ranked.map((t) => [t.name, t.score, t.members, t.rank])).toEqual([['Small', 2500, 1, 1], ['Big', 1000, 4, 2]])
  })
  it('can add scores up instead', () => {
    const ranked = rankTeams({ teams: teamRows, players, scoring: 'total' })
    expect(ranked.map((t) => [t.name, t.score])).toEqual([['Big', 4000], ['Small', 2500]])
  })
  it('hides teams with nobody on them, shares ranks on a tie, and never divides by zero', () => {
    const tied = rankTeams({ teams: teamRows, players: [{ id: 'x', team_id: 'a', total_score: 5 }, { id: 'y', team_id: 'b', total_score: 5 }] })
    expect(tied.map((t) => t.rank)).toEqual([1, 1])
    expect(rankTeams({ teams: teamRows, players: [] })).toEqual([])
  })
})

const presets = [{ name: 'Red', color: 'red', avatarId: 0 }, { name: 'Blue', color: 'blue', avatarId: 1 }]

describe('quiz-create with teams', () => {
  it('copies the quiz team list into the game', async () => {
    const db = fakeDb({ quizzes: [{ id: QUIZ, max_players: 40, team_mode: true, team_scoring: 'total', team_presets: presets }] })
    const res = fakeRes()
    await createQuizCreateHandler(() => db, { makeCode: () => '555555' })(admin({ quizId: QUIZ }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.teamMode).toBe(true)
    expect(db.tables.quiz_sessions[0]).toMatchObject({ team_mode: true, team_scoring: 'total' })
    expect(db.tables.quiz_teams.map((t) => [t.name, t.color, t.position])).toEqual([['Red', 'red', 0], ['Blue', 'blue', 1]])
  })
  it('lets the host override the quiz setting and the team list', async () => {
    const db = fakeDb()
    const res = fakeRes()
    await createQuizCreateHandler(() => db, { makeCode: () => '666666' })(admin({ quizId: QUIZ, teamMode: true, teams: presets, teamScoring: 'average' }), res)
    expect(res.statusCode).toBe(200)
    expect(db.tables.quiz_teams).toHaveLength(2)
    const off = fakeDb({ quizzes: [{ id: QUIZ, max_players: 40, team_mode: true, team_presets: presets }] })
    const res2 = fakeRes()
    await createQuizCreateHandler(() => off, { makeCode: () => '777777' })(admin({ quizId: QUIZ, teamMode: false }), res2)
    expect(off.tables.quiz_teams).toHaveLength(0)
  })
  it('refuses team mode without a valid team list, and rejects bad input', async () => {
    const db = fakeDb()
    let res = fakeRes()
    await createQuizCreateHandler(() => db)(admin({ quizId: QUIZ, teamMode: true }), res)
    expect(res.statusCode).toBe(400)
    for (const body of [{ teamMode: 'yes' }, { teamScoring: 'median' }, { teams: [{ name: 'One' }] }]) {
      res = fakeRes()
      await createQuizCreateHandler(() => db)(admin({ quizId: QUIZ, ...body }), res)
      expect(res.statusCode, JSON.stringify(body)).toBe(400)
    }
    expect(db.tables.quiz_sessions).toHaveLength(0)
  })
})

function teamGame() {
  const db = fakeDb({
    quiz_sessions: [{ id: SESSION, quiz_id: QUIZ, join_code: '123456', state: 'lobby', current_question_index: -1, max_players: 40, team_mode: true, team_scoring: 'average' }],
    quiz_teams: [
      { id: 'team-red', session_id: SESSION, name: 'Red', color: 'red', avatar_id: 0, position: 0 },
      { id: 'team-blue', session_id: SESSION, name: 'Blue', color: 'blue', avatar_id: 1, position: 1 },
    ],
  })
  const join = async (nickname, teamId, code = '123456') => {
    const res = fakeRes()
    await createQuizJoinHandler(() => db, { allow: () => true })(anon({ code, nickname, ...(teamId === undefined ? {} : { teamId }) }), res)
    return res
  }
  return { db, join }
}

describe('joining a team game', () => {
  it('asks for a team first, listing the teams and how many are on each', async () => {
    const { join } = teamGame()
    const res = await join('Ada')
    expect(res.statusCode).toBe(409)
    expect(res.body).toMatchObject({ needsTeam: true })
    expect(res.body.teams.map((t) => [t.name, t.members])).toEqual([['Red', 0], ['Blue', 0]])
  })
  it('joins the chosen team', async () => {
    const { db, join } = teamGame()
    const res = await join('Ada', 'team-blue')
    expect(res.statusCode).toBe(200)
    expect(res.body.team).toEqual({ id: 'team-blue', name: 'Blue', color: 'blue' })
    expect(db.tables.quiz_players[0].team_id).toBe('team-blue')
  })
  it('balances when asked to put the player anywhere', async () => {
    const { db, join } = teamGame()
    for (const name of ['A', 'B', 'C', 'D', 'E']) await join(name, 'auto')
    const sizes = ['team-red', 'team-blue'].map((id) => db.tables.quiz_players.filter((p) => p.team_id === id).length)
    expect(sizes).toEqual([3, 2])
  })
  it('refuses a team from another game or a made-up one', async () => {
    const { db, join } = teamGame()
    db.tables.quiz_teams.push({ id: 'team-other', session_id: 'other-game', name: 'Elsewhere', color: 'red', avatar_id: 0, position: 0 })
    expect((await join('Ada', 'team-other')).statusCode).toBe(400)
    expect((await join('Ada', 'nonsense')).statusCode).toBe(400)
    expect(db.tables.quiz_players).toHaveLength(0)
  })
  it('is unchanged for a game without teams', async () => {
    const db = fakeDb({ quiz_sessions: [{ id: SESSION, quiz_id: QUIZ, join_code: '123456', state: 'lobby', current_question_index: -1 }] })
    const res = fakeRes()
    await createQuizJoinHandler(() => db, { allow: () => true })(anon({ code: '123456', nickname: 'Ada' }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.team).toBeUndefined()
  })
})

describe('what phones see in a team game', () => {
  it("shows the player's team, and the team standings on the leaderboard only", async () => {
    const { db, join } = teamGame()
    const a = (await join('Ada', 'team-red')).body
    await join('Bayo', 'team-blue')
    db.tables.quiz_players.find((p) => p.nickname === 'Ada').total_score = 900
    db.tables.quiz_players.find((p) => p.nickname === 'Bayo').total_score = 1200
    Object.assign(db.tables.quiz_sessions[0], { state: 'question', current_question_index: 0, question_started_at: new Date().toISOString() })
    const ask = async () => {
      const res = fakeRes()
      await createQuizStateHandler(() => db, { allow: () => true, baseUrl: 'https://x.supabase.co' })(anon({ token: a.token }), res)
      return res.body
    }
    let body = await ask()
    expect(body.session.teamMode).toBe(true)
    expect(body.me.team).toEqual({ id: 'team-red', name: 'Red', color: 'red' })
    expect(body.teams).toBeUndefined()
    db.tables.quiz_sessions[0].state = 'leaderboard'
    body = await ask()
    expect(body.teams.map((t) => [t.name, t.score, t.rank])).toEqual([['Blue', 1200, 1], ['Red', 900, 2]])
    expect(hashToken(a.token)).toBeTruthy()
  })
})
