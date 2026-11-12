import { describe, expect, it } from 'vitest'
import { ANSWER_GRACE_MS } from './quiz.js'
import {
  LOBBY_WAIT_MS,
  REVEAL_HOLD_MS,
  LEADERBOARD_HOLD_MS,
  EMPTY_LOBBY_EXPIRY_MS,
  OPEN_LOBBY_IDLE_MS,
  LIST_HORIZON_MS,
  MAX_SCHEDULE_AHEAD_MS,
  isScheduledAt,
  lobbyStartAtMs,
  startsInMs,
  dueStep,
  nextStepInMs,
  isListed,
  compareListed,
  lateJoinAllowed,
} from './quizSchedule.js'

const NOW = Date.parse('2026-11-09T15:00:00.000Z')
const QUESTION = { time_limit_seconds: 20 }

function session(over = {}) {
  return {
    id: 's1',
    state: 'lobby',
    current_question_index: -1,
    autopilot: true,
    open_join: true,
    scheduled_at: null,
    lobby_start_at: null,
    state_changed_at: new Date(NOW).toISOString(),
    created_at: new Date(NOW).toISOString(),
    question_started_at: null,
    paused_at: null,
    paused_total_ms: 0,
    time_bonus_ms: 0,
    ...over,
  }
}

describe('when a scheduled lobby starts', () => {
  it('has no clock until the first person arrives', () => {
    expect(lobbyStartAtMs({ scheduledAt: null, firstJoinAt: null })).toBe(null)
    expect(session().lobby_start_at).toBe(null)
    expect(startsInMs(session(), NOW)).toBe(null)
  })

  it('waits for the scheduled time even when the room fills early', () => {
    const scheduled = new Date(NOW + 10 * 60_000).toISOString()
    const first = lobbyStartAtMs({ scheduledAt: scheduled, firstJoinAt: new Date(NOW) })
    expect(first).toBe(NOW + 10 * 60_000)
  })

  it('starts the wait at the first arrival when the schedule has already passed', () => {
    const scheduled = new Date(NOW - 60_000).toISOString()
    const first = lobbyStartAtMs({ scheduledAt: scheduled, firstJoinAt: new Date(NOW) })
    expect(first).toBe(NOW)
    expect(startsInMs(session({ lobby_start_at: new Date(first).toISOString() }), NOW)).toBe(LOBBY_WAIT_MS)
  })
})

describe('isScheduledAt', () => {
  it('accepts nothing and a near future, and nothing else', () => {
    expect(isScheduledAt(null, NOW)).toBe(true)
    expect(isScheduledAt('', NOW)).toBe(true)
    expect(isScheduledAt(new Date(NOW + 60_000).toISOString(), NOW)).toBe(true)
  })

  it('refuses the past, junk and a year away', () => {
    expect(isScheduledAt(new Date(NOW - 10 * 60_000).toISOString(), NOW)).toBe(false)
    expect(isScheduledAt('tomorrow', NOW)).toBe(false)
    expect(isScheduledAt(new Date(NOW + MAX_SCHEDULE_AHEAD_MS + 1).toISOString(), NOW)).toBe(false)
  })
})

describe('dueStep', () => {
  it('never moves a game the admin is driving', () => {
    expect(dueStep(session({ autopilot: false }), { nowMs: NOW + 3_600_000, playerCount: 4 })).toBe(null)
  })

  it('does not start an empty room, however late it is', () => {
    const late = session({ lobby_start_at: new Date(NOW - 60_000).toISOString() })
    expect(dueStep(late, { nowMs: NOW, playerCount: 0, questionCount: 3 })).toBe(null)
  })

  it('starts a waiting room once the minute is up', () => {
    const ready = session({ lobby_start_at: new Date(NOW - LOBBY_WAIT_MS).toISOString() })
    const due = dueStep(ready, { nowMs: NOW, playerCount: 2, questionCount: 3 })
    expect(due?.reason).toBe('start')
    expect(due.next).toMatchObject({ state: 'question', current_question_index: 0 })
  })

  it('waits out the last millisecond of the minute', () => {
    const ready = session({ lobby_start_at: new Date(NOW - LOBBY_WAIT_MS + 1).toISOString() })
    expect(dueStep(ready, { nowMs: NOW, playerCount: 2, questionCount: 3 })).toBe(null)
  })

  it('starts a full room after its ten seconds, sooner than the minute', () => {
    const full = session({ lobby_start_at: new Date(NOW).toISOString(), full_at: new Date(NOW - 10_000).toISOString() })
    expect(dueStep(full, { nowMs: NOW, playerCount: 40, questionCount: 3 })?.reason).toBe('start')
  })

  it('closes a question on its own clock, grace included', () => {
    const open = session({
      state: 'question',
      current_question_index: 0,
      question_started_at: new Date(NOW - 20_000 - 1_500).toISOString(),
    })
    expect(dueStep(open, { nowMs: NOW, questionCount: 3, question: QUESTION })).toBe(null)
    const closed = session({
      state: 'question',
      current_question_index: 0,
      question_started_at: new Date(NOW - 20_000 - 1_501).toISOString(),
    })
    expect(dueStep(closed, { nowMs: NOW, questionCount: 3, question: QUESTION })?.reason).toBe('question-ended')
  })

  it('will not close a paused question', () => {
    const paused = session({
      state: 'question',
      question_started_at: new Date(NOW - 60_000).toISOString(),
      paused_at: new Date(NOW - 10_000).toISOString(),
    })
    expect(dueStep(paused, { nowMs: NOW, questionCount: 3, question: QUESTION })).toBe(null)
  })

  it('holds the reveal and the leaderboard for their own windows', () => {
    const reveal = session({ state: 'reveal', current_question_index: 0, state_changed_at: new Date(NOW - REVEAL_HOLD_MS).toISOString() })
    expect(dueStep(reveal, { nowMs: NOW, questionCount: 3 })?.reason).toBe('reveal-held')
    const early = session({ state: 'reveal', current_question_index: 0, state_changed_at: new Date(NOW - REVEAL_HOLD_MS + 1).toISOString() })
    expect(dueStep(early, { nowMs: NOW, questionCount: 3 })).toBe(null)

    const board = session({ state: 'leaderboard', current_question_index: 0, state_changed_at: new Date(NOW - LEADERBOARD_HOLD_MS).toISOString() })
    expect(dueStep(board, { nowMs: NOW, questionCount: 3 })?.reason).toBe('leaderboard-held')
  })

  it('finishes after the last leaderboard and never steps a finished game', () => {
    const board = session({ state: 'leaderboard', current_question_index: 2, state_changed_at: new Date(NOW - LEADERBOARD_HOLD_MS).toISOString() })
    expect(dueStep(board, { nowMs: NOW, questionCount: 3 })?.next.state).toBe('finished')
    expect(dueStep(session({ state: 'finished' }), { nowMs: NOW, questionCount: 3 })).toBe(null)
  })

  it('expires a lobby nobody joined, from the moment it became relevant', () => {
    const stale = session({ scheduled_at: new Date(NOW - EMPTY_LOBBY_EXPIRY_MS).toISOString() })
    expect(dueStep(stale, { nowMs: NOW, playerCount: 0 })?.reason).toBe('expired')
    const fresh = session({ scheduled_at: new Date(NOW - EMPTY_LOBBY_EXPIRY_MS + 1).toISOString() })
    expect(dueStep(fresh, { nowMs: NOW, playerCount: 0 })).toBe(null)
  })

  it('gives an unscheduled lobby hours, not minutes, to be joined', () => {
    // Opened before a class: fifteen minutes would have made a finished game out of one nobody had reached yet.
    const opened = session({ created_at: new Date(NOW - 60 * 60_000).toISOString() })
    expect(dueStep(opened, { nowMs: NOW, playerCount: 0 })).toBe(null)
    const abandoned = session({ created_at: new Date(NOW - OPEN_LOBBY_IDLE_MS).toISOString() })
    expect(dueStep(abandoned, { nowMs: NOW, playerCount: 0 })?.reason).toBe('expired')
  })

  it('leaves a bracket game to the host screen', () => {
    const bracket = session({ bracket_mode: true, lobby_start_at: new Date(NOW - 60_000).toISOString() })
    expect(dueStep(bracket, { nowMs: NOW, playerCount: 4, questionCount: 3 })).toBe(null)
  })
})

// The phone's poll is timed to this number, so a wrong one shows up as a step that lands early, late or never.
describe('nextStepInMs', () => {
  it('is the time left on an open question', () => {
    const row = session({ state: 'question', question_started_at: new Date(NOW - 5_000).toISOString() })
    // Twenty-second limit, five seconds gone, plus the same grace quiz-answer gives a slow phone.
    expect(nextStepInMs(row, { nowMs: NOW, question: QUESTION })).toBe(15_000 + ANSWER_GRACE_MS)
  })

  it('is zero once the question is past its grace, so the phone asks again at once', () => {
    const row = session({ state: 'question', question_started_at: new Date(NOW - 60_000).toISOString() })
    expect(nextStepInMs(row, { nowMs: NOW, question: QUESTION })).toBe(0)
  })

  it('counts down the reveal and leaderboard holds', () => {
    const reveal = session({ state: 'reveal', state_changed_at: new Date(NOW - 3_000).toISOString() })
    expect(nextStepInMs(reveal, { nowMs: NOW })).toBe(REVEAL_HOLD_MS - 3_000)
    const board = session({ state: 'leaderboard', state_changed_at: new Date(NOW - 2_000).toISOString() })
    expect(nextStepInMs(board, { nowMs: NOW })).toBe(LEADERBOARD_HOLD_MS - 2_000)
  })

  it('is the lobby countdown once somebody is in the room', () => {
    const row = session({ lobby_start_at: new Date(NOW - 15_000).toISOString() })
    expect(nextStepInMs(row, { nowMs: NOW, playerCount: 1 })).toBe(LOBBY_WAIT_MS - 15_000)
    // An empty room has no clock to wake for; the tick expires it on its own schedule.
    expect(nextStepInMs(row, { nowMs: NOW, playerCount: 0 })).toBe(null)
  })

  it('is null for a hosted game, a paused question and a finished one', () => {
    expect(nextStepInMs(session({ autopilot: false }), { nowMs: NOW, playerCount: 1 })).toBe(null)
    expect(nextStepInMs(session({ state: 'question', paused_at: new Date(NOW).toISOString() }), { nowMs: NOW, question: QUESTION })).toBe(null)
    expect(nextStepInMs(session({ state: 'finished' }), { nowMs: NOW })).toBe(null)
  })
})

describe('the /play list', () => {
  it('lists open games that are live, and hides finished ones', () => {
    expect(isListed(session({ state: 'question', current_question_index: 0 }), NOW)).toBe(true)
    expect(isListed(session({ state: 'finished' }), NOW)).toBe(false)
    expect(isListed(session({ open_join: false }), NOW)).toBe(false)
  })

  it('shows a lobby scheduled later in the week, and hides one past the horizon', () => {
    const soon = session({ scheduled_at: new Date(NOW + 3_600_000).toISOString() })
    expect(isListed(soon, NOW)).toBe(true)
    // A quiz scheduled on Monday for Friday is a real room: it has to be findable before the day it runs.
    const laterInWeek = session({ scheduled_at: new Date(NOW + 3 * 24 * 3_600_000).toISOString() })
    expect(isListed(laterInWeek, NOW)).toBe(true)
    const beyond = session({ scheduled_at: new Date(NOW + LIST_HORIZON_MS + 3_600_000).toISOString() })
    expect(isListed(beyond, NOW)).toBe(false)
    const waiting = session({ scheduled_at: new Date(NOW + 8 * 24 * 3_600_000).toISOString(), lobby_start_at: new Date(NOW).toISOString() })
    expect(isListed(waiting, NOW)).toBe(true)
  })

  it('puts live games first, then the soonest waiting room', () => {
    const live = session({ id: 'live', state: 'question' })
    const later = session({ id: 'later', lobby_start_at: new Date(NOW + 600_000).toISOString() })
    const sooner = session({ id: 'sooner', lobby_start_at: new Date(NOW + 60_000).toISOString() })
    expect([later, live, sooner].sort(compareListed).map((s) => s.id)).toEqual(['live', 'sooner', 'later'])
  })
})

describe('late join', () => {
  it('is open by default and only once the quiz has opted out', () => {
    expect(lateJoinAllowed({ state: 'question' }, {})).toBe(true)
    expect(lateJoinAllowed({ state: 'question' }, { late_join: true })).toBe(true)
    expect(lateJoinAllowed({ state: 'question' }, { late_join: false })).toBe(false)
  })

  it('never refuses the lobby itself', () => {
    expect(lateJoinAllowed({ state: 'lobby' }, { late_join: false })).toBe(true)
  })
})
