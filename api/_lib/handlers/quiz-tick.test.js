import { describe, expect, it } from 'vitest'
import { createQuizTickHandler } from './quiz-tick.js'
import { LOBBY_WAIT_MS, EMPTY_LOBBY_EXPIRY_MS } from '../quizSchedule.js'
import { QUIZ, SESSION, fakeDb, fakeRes } from '../quizTestKit.js'

const NOW = Date.parse('2026-11-09T15:00:00.000Z')
const Q1 = '55555555-5555-4555-8555-555555555555'

function setup(session = {}, extra = {}) {
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
    ...extra,
  })
  return { db }
}

async function tick(db, { authentic = async () => true, now = () => NOW } = {}) {
  const res = fakeRes()
  await createQuizTickHandler(() => db, { now, authentic })({ method: 'POST', headers: {}, body: {} }, res)
  return res
}

describe('quiz-tick', () => {
  it('refuses a call that is not signed', async () => {
    const { db } = setup()
    const res = await tick(db, { authentic: async () => false })
    expect(res.statusCode).toBe(401)
    expect(db.tables.quiz_sessions[0].state).toBe('lobby')
  })

  it('starts a waiting room sixty seconds after the first arrival', async () => {
    const { db } = setup({ lobby_start_at: new Date(NOW - LOBBY_WAIT_MS).toISOString() })
    db.tables.quiz_players.push({ id: 'p1', session_id: SESSION, nickname: 'Ada' })
    const res = await tick(db)
    expect(res.statusCode).toBe(200)
    expect(res.body.advanced).toBe(1)
    const row = db.tables.quiz_sessions[0]
    expect(row.state).toBe('question')
    expect(row.current_question_index).toBe(0)
    expect(row.question_started_at).toBe(new Date(NOW).toISOString())
    expect(row.state_changed_at).toBe(new Date(NOW).toISOString())
  })

  it('does not step the same game twice on the next tick', async () => {
    const { db } = setup({ lobby_start_at: new Date(NOW - LOBBY_WAIT_MS).toISOString() })
    db.tables.quiz_players.push({ id: 'p1', session_id: SESSION, nickname: 'Ada' })
    await tick(db)
    const second = await tick(db)
    expect(second.body.advanced).toBe(0)
    expect(db.tables.quiz_sessions[0].state).toBe('question')
  })

  it('takes the bots’ turns on a question nobody is watching before closing it', async () => {
    const { db } = setup({
      state: 'question',
      current_question_index: 0,
      question_started_at: new Date(NOW - 5 * 60_000).toISOString(),
      state_changed_at: new Date(NOW - 5 * 60_000).toISOString(),
    })
    db.tables.quiz_players.push({ id: 'b1', session_id: SESSION, nickname: 'Bot_Prime', bot_skill: 'expert', streak: 0 })
    const res = await tick(db)
    expect(res.body.advanced).toBe(1)
    // The tick runs a minute late, so the answer is recorded against the question's deadline: an expert thinks inside
    // the first 35% of the limit, and the score is taken from that think time either way.
    const answers = db.tables.quiz_answers.filter((a) => a.question_id === Q1)
    expect(answers).toHaveLength(1)
    expect(answers[0].elapsed_ms).toBeLessThanOrEqual(20_000)
    expect(db.tables.quiz_sessions[0].state).toBe('reveal')
  })

  it('leaves a game the admin is driving alone', async () => {
    const { db } = setup({ autopilot: false, lobby_start_at: new Date(NOW - LOBBY_WAIT_MS).toISOString() })
    db.tables.quiz_players.push({ id: 'p1', session_id: SESSION, nickname: 'Ada' })
    const res = await tick(db)
    expect(res.body.advanced).toBe(0)
    expect(db.tables.quiz_sessions[0].state).toBe('lobby')
  })

  it('expires an open lobby nobody joined', async () => {
    const { db } = setup({ scheduled_at: new Date(NOW - EMPTY_LOBBY_EXPIRY_MS).toISOString() })
    const res = await tick(db)
    expect(res.body.advanced).toBe(1)
    expect(db.tables.quiz_sessions[0].state).toBe('finished')
    expect(db.tables.quiz_sessions[0].finished_at).toBe(new Date(NOW).toISOString())
  })
})
