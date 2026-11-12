import { describe, expect, it } from 'vitest'
import { createQuizOpenHandler } from './quiz-open.js'
import { QUIZ, fakeDb, fakeRes } from '../quizTestKit.js'

const NOW = Date.parse('2026-11-09T15:00:00.000Z')

function session(over = {}) {
  return {
    id: 's1',
    quiz_id: QUIZ,
    join_code: '123456',
    state: 'lobby',
    current_question_index: -1,
    max_players: 40,
    open_join: true,
    autopilot: true,
    scheduled_at: null,
    lobby_start_at: null,
    game_options: {},
    ...over,
  }
}

async function list(db) {
  const res = fakeRes()
  await createQuizOpenHandler(() => db, { now: () => NOW })({ method: 'GET', headers: {} }, res)
  return res
}

describe('the open list', () => {
  it('is public, and says nothing about who is in the room', async () => {
    const db = fakeDb({
      quizzes: [{ id: QUIZ, title: 'PHY 201 — Mid-semester' }],
      quiz_sessions: [session({ state: 'question', current_question_index: 0 })],
      quiz_players: [
        { id: 'p1', session_id: 's1', nickname: 'Ada' },
        { id: 'p2', session_id: 's1', nickname: 'Bola' },
      ],
    })
    const res = await list(db)
    expect(res.statusCode).toBe(200)
    expect(res.body.sessions).toHaveLength(1)
    expect(res.body.sessions[0]).toMatchObject({ title: 'PHY 201 — Mid-semester', joinCode: '123456', players: 2, state: 'question' })
    expect(JSON.stringify(res.body)).not.toContain('Ada')
    expect(JSON.stringify(res.body)).not.toContain('Bola')
  })

  it('leaves out closed rooms and games nobody opened', async () => {
    const db = fakeDb({
      quizzes: [{ id: QUIZ, title: 'Quiz' }],
      quiz_sessions: [
        session({ id: 'finished', state: 'finished' }),
        session({ id: 'private', open_join: false }),
        // Beyond the listing horizon: scheduled, but not for a week yet.
        session({ id: 'far', scheduled_at: new Date(NOW + 8 * 24 * 3_600_000).toISOString() }),
      ],
    })
    const res = await list(db)
    expect(res.body.sessions).toEqual([])
  })

  it('carries a countdown the phone can run on its own clock', async () => {
    const db = fakeDb({
      quizzes: [{ id: QUIZ, title: 'Quiz' }],
      quiz_sessions: [session({ lobby_start_at: new Date(NOW).toISOString() })],
    })
    const res = await list(db)
    expect(res.body.serverNow).toBe(NOW)
    expect(res.body.sessions[0].startsInMs).toBe(60_000)
  })

  it('reports a quiz that closed its doors at the first question', async () => {
    const db = fakeDb({
      quizzes: [{ id: QUIZ, title: 'Quiz' }],
      quiz_sessions: [session({ state: 'question', current_question_index: 0, game_options: { late_join: false } })],
    })
    const res = await list(db)
    expect(res.body.sessions[0].lateJoin).toBe(false)
  })
})
