import { describe, expect, it } from 'vitest'
import { playBots } from './quizBotPlay.js'
import { QUIZ, SESSION, fakeDb } from '../quizTestKit.js'

const NOW = Date.parse('2026-11-10T10:00:00.000Z')
const Q1 = '55555555-5555-4555-8555-555555555555'

// A twenty-second question, so "the bot has finished thinking" can be decided by the clock rather than by the bot's
// own seeded pace: every skill finishes inside 80% of the limit, and none before 12% of it.
function setup({ startedAgoMs = 19_000, state = 'question', session = {} } = {}) {
  return fakeDb({
    quiz_questions: [
      { id: Q1, quiz_id: QUIZ, position: 0, text: 'Q1?', options: ['a', 'b', 'c'], correct_index: 1, time_limit_seconds: 20, points: 1000 },
    ],
    quiz_sessions: [
      {
        id: SESSION,
        quiz_id: QUIZ,
        state,
        current_question_index: 0,
        question_ids: [Q1],
        question_started_at: new Date(NOW - startedAgoMs).toISOString(),
        ...session,
      },
    ],
    quiz_players: [
      { id: 'bot1', session_id: SESSION, nickname: 'Bot one', total_score: 0, streak: 0, bot_skill: 'expert' },
      { id: 'p1', session_id: SESSION, nickname: 'Ada', total_score: 0, streak: 0 },
    ],
    quiz_answers: [],
  })
}

const session = (db) => db.tables.quiz_sessions[0]

describe('playBots', () => {
  it('answers for a bot whose thinking time has passed, and only for the bot', async () => {
    const db = setup()
    const result = await playBots(db, session(db), { nowMs: NOW })
    expect(result.answered).toBe(1)
    expect(db.tables.quiz_answers.map((a) => a.player_id)).toEqual(['bot1'])
    expect(db.tables.quiz_answers[0].question_id).toBe(Q1)
  })

  // This is the open-quiz case: there is no host screen to ask, so the phone's own poll plays the bots' turns.
  it('is a no-op while every bot is still thinking', async () => {
    const db = setup({ startedAgoMs: 1_000 })
    const result = await playBots(db, session(db), { nowMs: NOW })
    expect(result.answered).toBe(0)
    expect(db.tables.quiz_answers).toHaveLength(0)
  })

  // Every phone in the room polls, so the same bot is asked about many times a second. The second answer is refused by
  // the record RPC rather than counted twice.
  it('never scores a bot twice', async () => {
    const db = setup()
    expect((await playBots(db, session(db), { nowMs: NOW })).answered).toBe(1)
    expect((await playBots(db, session(db), { nowMs: NOW })).answered).toBe(0)
    expect(db.tables.quiz_answers).toHaveLength(1)
  })

  it('does nothing once the question has closed', async () => {
    const db = setup({ state: 'reveal' })
    const result = await playBots(db, session(db), { nowMs: NOW })
    expect(result.answered).toBe(0)
    expect(db.tables.quiz_answers).toHaveLength(0)
  })

  it('does nothing while the game is paused', async () => {
    const db = setup({ session: { paused_at: new Date(NOW - 5_000).toISOString() } })
    const result = await playBots(db, session(db), { nowMs: NOW })
    expect(result.answered).toBe(0)
  })

  it('leaves a game with no bots alone', async () => {
    const db = setup()
    db.tables.quiz_players = db.tables.quiz_players.filter((p) => !p.bot_skill)
    const result = await playBots(db, session(db), { nowMs: NOW })
    expect(result.answered).toBe(0)
    expect(db.tables.quiz_answers).toHaveLength(0)
  })
})
