import { describe, expect, it } from 'vitest'
import { createQuizHostHandler } from './quiz-host.js'
import { LOBBY_WAIT_MS } from '../quizSchedule.js'
import { QUIZ, SESSION, fakeDb, fakeRes } from '../quizTestKit.js'

const NOW = Date.parse('2026-11-09T15:00:00.000Z')
const Q1 = '55555555-5555-4555-8555-555555555555'

// The host screen asks this op on every poll. It is an engine, not an authority: the same `dueStep` a phone poll and
// the pg_cron tick ask, applied with the same compare-and-swap.
function setup(session = {}) {
  const db = fakeDb({
    quiz_questions: [
      { id: Q1, quiz_id: QUIZ, position: 0, text: 'Q1?', options: ['a', 'b'], correct_index: 0, time_limit_seconds: 20, points: 1000 },
    ],
    quiz_sessions: [
      {
        id: SESSION,
        quiz_id: QUIZ,
        join_code: '123456',
        state: 'lobby',
        current_question_index: -1,
        question_ids: [Q1],
        autopilot: true,
        open_join: true,
        max_players: 40,
        created_at: new Date(NOW - 3_600_000).toISOString(),
        state_changed_at: new Date(NOW - 3_600_000).toISOString(),
        lobby_start_at: null,
        scheduled_at: null,
        ...session,
      },
    ],
    quiz_players: [],
  })
  return { db }
}

async function clock(db) {
  const res = fakeRes()
  await createQuizHostHandler(() => db, { now: () => new Date(NOW) })({
    method: 'POST',
    headers: { authorization: 'Bearer good' },
    body: { sessionId: SESSION, op: 'clock' },
  }, res)
  return res
}

describe('quiz-host clock', () => {
  it('starts an open lobby whose minute is up, even with nobody on a phone', async () => {
    const { db } = setup({ lobby_start_at: new Date(NOW - LOBBY_WAIT_MS).toISOString() })
    db.tables.quiz_players.push({ id: 'p1', session_id: SESSION, nickname: 'Ada' })
    const res = await clock(db)
    expect(res.statusCode).toBe(200)
    expect(res.body.advanced).toBe(true)
    const row = db.tables.quiz_sessions[0]
    expect(row.state).toBe('question')
    expect(row.current_question_index).toBe(0)
    expect(row.question_started_at).toBe(new Date(NOW).toISOString())
    expect(row.state_changed_at).toBe(new Date(NOW).toISOString())
  })

  it('reports the countdown the host screen shows, without moving the game', async () => {
    const { db } = setup({ lobby_start_at: new Date(NOW).toISOString() })
    db.tables.quiz_players.push({ id: 'p1', session_id: SESSION, nickname: 'Ada' })
    const res = await clock(db)
    expect(res.body.advanced).toBe(false)
    expect(res.body.startsInMs).toBe(LOBBY_WAIT_MS)
    expect(db.tables.quiz_sessions[0].state).toBe('lobby')
  })

  it('leaves a game the admin is driving alone', async () => {
    const { db } = setup({ autopilot: false, lobby_start_at: new Date(NOW - LOBBY_WAIT_MS).toISOString() })
    db.tables.quiz_players.push({ id: 'p1', session_id: SESSION, nickname: 'Ada' })
    const res = await clock(db)
    expect(res.body.advanced).toBe(false)
    expect(db.tables.quiz_sessions[0].state).toBe('lobby')
  })

  it('steps the reveal on once its hold is over', async () => {
    const { db } = setup({
      state: 'reveal',
      current_question_index: 0,
      question_started_at: new Date(NOW - 30_000).toISOString(),
      state_changed_at: new Date(NOW - 9_000).toISOString(),
    })
    db.tables.quiz_players.push({ id: 'p1', session_id: SESSION, nickname: 'Ada' })
    const res = await clock(db)
    expect(res.body.advanced).toBe(true)
    expect(db.tables.quiz_sessions[0].state).toBe('leaderboard')
  })
})
