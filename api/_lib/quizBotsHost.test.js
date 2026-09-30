import { describe, it, expect } from 'vitest'
import { createQuizHostHandler } from './handlers/quiz-host.js'
import { QUIZ, SESSION, fakeRes, fakeDb, admin, anon } from './quizTestKit.js'

const START = Date.parse('2026-10-01T10:00:00.000Z')
const iso = (ms) => new Date(ms).toISOString()

function lobby(sessionExtra = {}, players = []) {
  return fakeDb({
    quiz_sessions: [{
      id: SESSION, quiz_id: QUIZ, join_code: '123456', state: 'lobby', current_question_index: -1,
      max_players: 10, paused_total_ms: 0, time_bonus_ms: 0, paused_at: null, game_options: {}, ...sessionExtra,
    }],
    quiz_players: players,
  })
}
const human = (n) => ({ id: `55555555-5555-4555-8555-55555555555${n}`, session_id: SESSION, nickname: `Human${n}`, total_score: 0, streak: 0 })

async function host(db, body, { at = START, anonymous = false } = {}) {
  const res = fakeRes()
  await createQuizHostHandler(() => db, { now: () => new Date(at) })((anonymous ? anon : admin)({ sessionId: SESSION, ...body }), res)
  return res
}

describe('quiz-host: addBots / removeBots', () => {
  it('needs an admin', async () => {
    const db = lobby()
    const res = await host(db, { op: 'addBots', count: 3, skill: 'average' }, { anonymous: true })
    expect(res.statusCode).toBe(401)
    expect(db.tables.quiz_players).toHaveLength(0)
  })

  it('adds the bots with their skill and unique names', async () => {
    const db = lobby()
    const res = await host(db, { op: 'addBots', count: 6, skill: 'expert' })
    expect(res.statusCode).toBe(200)
    expect(res.body.added).toBe(6)
    const bots = db.tables.quiz_players
    expect(bots).toHaveLength(6)
    expect(bots.every((b) => b.bot_skill === 'expert')).toBe(true)
    expect(new Set(bots.map((b) => b.nickname.toLowerCase())).size).toBe(6)
    expect(db.tables.quiz_host_log.at(-1)).toMatchObject({ op: 'addBots', detail: { added: 6, skill: 'expert' } })
  })

  it('mixed spreads the skills', async () => {
    const db = lobby({ max_players: 30 })
    await host(db, { op: 'addBots', count: 20, skill: 'mixed' })
    expect(new Set(db.tables.quiz_players.map((b) => b.bot_skill))).toEqual(new Set(['beginner', 'average', 'expert']))
  })

  it('stops at the lobby size and leaves room for real players already in', async () => {
    const db = lobby({ max_players: 5 }, [human(1), human(2)])
    const res = await host(db, { op: 'addBots', count: 50, skill: 'average' })
    expect(res.body.added).toBe(3)
    expect(db.tables.quiz_players).toHaveLength(5)
    const again = await host(db, { op: 'addBots', count: 1, skill: 'average' })
    expect(again.statusCode).toBe(409)
  })

  it('rejects a bad count or skill, and a game that has started', async () => {
    const db = lobby()
    expect((await host(db, { op: 'addBots', count: 0, skill: 'average' })).statusCode).toBe(400)
    expect((await host(db, { op: 'addBots', count: 500, skill: 'average' })).statusCode).toBe(400)
    expect((await host(db, { op: 'addBots', count: 3, skill: 'genius' })).statusCode).toBe(400)
    db.tables.quiz_sessions[0].state = 'question'
    expect((await host(db, { op: 'addBots', count: 3, skill: 'average' })).statusCode).toBe(409)
  })

  it('spreads bots over the teams in team mode', async () => {
    const db = lobby({ team_mode: true }, [])
    db.tables.quiz_teams.push({ id: 'tA', session_id: SESSION, position: 0 }, { id: 'tB', session_id: SESSION, position: 1 })
    await host(db, { op: 'addBots', count: 6, skill: 'average' })
    const per = (t) => db.tables.quiz_players.filter((p) => p.team_id === t).length
    expect(per('tA')).toBe(3)
    expect(per('tB')).toBe(3)
  })

  it('removes only the bots', async () => {
    const db = lobby({}, [human(1)])
    await host(db, { op: 'addBots', count: 4, skill: 'average' })
    const res = await host(db, { op: 'removeBots' })
    expect(res.body.removed).toBe(4)
    expect(db.tables.quiz_players.map((p) => p.nickname)).toEqual(['Human1'])
  })
})

describe('quiz-host: botsPlay', () => {
  function running(extraSession = {}) {
    const db = lobby({ state: 'question', current_question_index: 0, question_started_at: iso(START), ...extraSession }, [human(1)])
    return db
  }
  const play = (db, at, extra = {}) => host(db, { op: 'botsPlay', expectedState: 'question', expectedIndex: 0, ...extra }, { at })

  async function withBots(db, n = 12, skill = 'average') {
    db.tables.quiz_sessions[0].state = 'lobby'
    await host(db, { op: 'addBots', count: n, skill })
    db.tables.quiz_sessions[0].state = 'question'
  }

  it('answers nothing the instant the question opens, everyone by the end, and never twice', async () => {
    const db = running({ max_players: 30 })
    await withBots(db, 12)
    const first = await play(db, START)
    expect(first.body.answered).toBe(0)
    const mid = await play(db, START + 6000)
    expect(mid.body.answered).toBeGreaterThan(0)
    expect(mid.body.answered).toBeLessThan(12)
    await play(db, START + 19000)
    expect(db.tables.quiz_answers).toHaveLength(12)
    const repeat = await play(db, START + 19500)
    expect(repeat.body.answered).toBe(0)
    expect(db.tables.quiz_answers).toHaveLength(12)
    // never answers for a real player
    expect(db.tables.quiz_answers.some((a) => a.player_id === db.tables.quiz_players[0].id)).toBe(false)
  })

  it('scores right answers and adds them to the bot totals', async () => {
    const db = running({ max_players: 60 })
    await withBots(db, 40, 'expert')
    await play(db, START + 19500)
    const answers = db.tables.quiz_answers
    const right = answers.filter((a) => a.correct)
    expect(right.length).toBeGreaterThan(20)
    for (const a of right) {
      expect(a.points_awarded).toBeGreaterThan(0)
      expect(db.tables.quiz_players.find((p) => p.id === a.player_id).total_score).toBe(a.points_awarded)
    }
    expect(answers.filter((a) => !a.correct).every((a) => a.points_awarded === 0)).toBe(true)
  })

  it('does nothing while paused, after the time is up, or for the wrong question', async () => {
    const db = running({ max_players: 30 })
    await withBots(db, 10)
    db.tables.quiz_sessions[0].paused_at = iso(START + 5000)
    expect((await play(db, START + 9000)).body.answered).toBe(0)
    db.tables.quiz_sessions[0].paused_at = null
    expect((await play(db, START + 40_000)).body.answered).toBe(0)
    expect((await play(db, START + 9000, { expectedIndex: 1 })).statusCode).toBe(409)
    expect(db.tables.quiz_answers).toHaveLength(0)
  })

  it('needs an admin', async () => {
    const db = running()
    const res = await host(db, { op: 'botsPlay', expectedState: 'question', expectedIndex: 0 }, { anonymous: true })
    expect(res.statusCode).toBe(401)
  })
})
