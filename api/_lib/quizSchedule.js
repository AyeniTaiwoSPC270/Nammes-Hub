import { ANSWER_GRACE_MS, FULL_LOBBY_COUNTDOWN_MS, effectiveElapsedMs, nextState, questionLimitMs } from './quiz.js'

// When an open quiz starts, when it moves on, and when it is over. Every rule here is a decision, not a write:
// the tick and the player poll both ask this module what is due and then apply it with the same compare-and-swap
// `quiz-advance` uses, so two engines can never skip a step.
//
// Server-only, like quiz.js and for the same reason (node:crypto): it reuses the one definition of how long a
// question has run (`effectiveElapsedMs`) and the one state machine (`nextState`) rather than copying either.
// Spec: docs/superpowers/specs/2026-11-09-open-quizzes-design.md

// The room opens at `scheduled_at` and the game begins this long after the first person walks in. Sixty seconds is
// the only knob between "waits for the room" and the literal 4:00 start: set it to 0 and the first arrival starts
// it, at any scheduled time, with nobody punished for being forty seconds late.
export const LOBBY_WAIT_MS = 60_000
// How long the answer stays up before the leaderboard. Long enough for the drum roll the projector may be playing;
// the host screen's own 5-second timer is not the authority once the server owns the clock.
export const REVEAL_HOLD_MS = 8_000
export const LEADERBOARD_HOLD_MS = 5_000
// An open lobby nobody joined is not a game, it is a row that would sit on /play for ever.
export const EMPTY_LOBBY_EXPIRY_MS = 15 * 60_000
// A scheduled lobby is not listed until it is close enough to be useful.
export const LIST_HORIZON_MS = 24 * 60 * 60_000
export const LIST_LIMIT = 12
export const MAX_SCHEDULE_AHEAD_MS = 90 * 24 * 60 * 60_000

const LIVE_STATES = new Set(['question', 'reveal', 'leaderboard'])

function instant(value) {
  if (value == null) return null
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const t = new Date(value).getTime()
  return Number.isFinite(t) ? t : null
}

// A schedule an admin can set: absent, or an instant that has not passed and is not years away. A negative offset
// (four minutes ago) is tolerated because the dialog's clock and the server's are not the same clock.
export function isScheduledAt(value, nowMs = Date.now()) {
  if (value == null || value === '') return true
  const t = instant(value)
  if (t == null) return false
  return t >= nowMs - 5 * 60_000 && t <= nowMs + MAX_SCHEDULE_AHEAD_MS
}

// The instant the 60-second wait starts: the scheduled time, or the first arrival if that is later. A waiting room
// that fills at 3:50 still starts after 4:00, which is the whole point of scheduling.
export function lobbyStartAtMs({ scheduledAt, firstJoinAt } = {}) {
  const scheduled = instant(scheduledAt)
  const joined = instant(firstJoinAt)
  if (joined == null) return scheduled
  if (scheduled == null) return joined
  return Math.max(scheduled, joined)
}

// Milliseconds until the game starts, or null when this room has no clock yet (nobody joined).
export function startsInMs(session, nowMs = Date.now()) {
  const start = instant(session?.lobby_start_at)
  if (start == null) return null
  return start + LOBBY_WAIT_MS - nowMs
}

function stateChangedMs(session) {
  return instant(session?.state_changed_at) ?? instant(session?.created_at) ?? 0
}

// The earliest thing that can make an empty room old: when its wait began, when it was scheduled, or when it was
// created. A scheduled game therefore expires fifteen minutes after 4:00, not fifteen minutes after it was made.
function emptyAnchorMs(session) {
  return instant(session?.lobby_start_at) ?? instant(session?.scheduled_at) ?? instant(session?.created_at) ?? 0
}

function finished(session) {
  return { state: 'finished', current_question_index: session.current_question_index ?? -1 }
}

/**
 * What this session should do right now, or null if it should keep doing what it is doing.
 *
 * Returns `{ next, reason }` where `next` is a `nextState` shape the caller applies with `stepUpdate`. Never
 * decides anything for a game with `autopilot` off: a hosted game is driven by the person in the room.
 */
export function dueStep(session, { nowMs = Date.now(), questionCount = 0, question = null, playerCount = 0 } = {}) {
  if (!session || session.autopilot !== true) return null
  if (session.state === 'finished') return null
  // A bracket game settles a round when it leaves a reveal (`quiz-advance.js`), and that settle is not a pure
  // decision this module can make. Brackets are a room format; the host screen keeps owning them.
  if (session.bracket_mode) return null

  if (session.state === 'lobby') {
    if (playerCount < 1) {
      return nowMs - emptyAnchorMs(session) >= EMPTY_LOBBY_EXPIRY_MS ? { next: finished(session), reason: 'expired' } : null
    }
    // A full room keeps the 10-second count that a hosted game has always had; the 60-second wait is for a room that
    // is still filling. Whichever comes first.
    const fullAt = instant(session.full_at)
    const full = fullAt != null && nowMs - fullAt >= FULL_LOBBY_COUNTDOWN_MS
    const left = startsInMs(session, nowMs)
    if (!full && (left == null || left > 0)) return null
    const next = nextState(session, questionCount)
    return next ? { next, reason: 'start' } : null
  }

  if (session.state === 'question') {
    // A paused question is a human decision and no clock can overrule it.
    if (session.paused_at) return null
    if (!question || !session.question_started_at) return null
    // The same grace `quiz-answer` gives a slow phone, so the answer that lands a second after the bar empties is
    // still in the question when it closes.
    if (effectiveElapsedMs(session, nowMs) <= questionLimitMs(session, question) + ANSWER_GRACE_MS) return null
    const next = nextState(session, questionCount)
    return next ? { next, reason: 'question-ended' } : null
  }

  if (session.state === 'reveal') {
    if (nowMs - stateChangedMs(session) < REVEAL_HOLD_MS) return null
    const next = nextState(session, questionCount)
    return next ? { next, reason: 'reveal-held' } : null
  }

  if (session.state === 'leaderboard') {
    if (nowMs - stateChangedMs(session) < LEADERBOARD_HOLD_MS) return null
    const next = nextState(session, questionCount)
    return next ? { next, reason: 'leaderboard-held' } : null
  }

  return null
}

// Listed on /play: open, unfinished, and either already live or close enough to its start to be worth showing.
export function isListed(session, nowMs = Date.now()) {
  if (!session?.open_join) return false
  if (session.state === 'finished') return false
  if (session.state !== 'lobby') return true
  const at = instant(session.scheduled_at)
  if (at == null) return true
  if (session.lobby_start_at != null) return true
  return at - nowMs <= LIST_HORIZON_MS
}

// Live games first (someone can join them right now), then the soonest lobby. A lobby with no clock sorts last.
export function compareListed(a, b) {
  const rank = (s) => (LIVE_STATES.has(s.state) ? 0 : s.state === 'lobby' ? 1 : 2)
  const byState = rank(a) - rank(b)
  if (byState !== 0) return byState
  const left = instant(a.lobby_start_at)
  const right = instant(b.lobby_start_at)
  if (left == null && right == null) return 0
  if (left == null) return 1
  if (right == null) return -1
  return left - right
}

// A quiz that closed its doors at the first question says so with `game_options.late_join = false`; the default is
// open, because the person who is two minutes late is still in the class.
export function lateJoinAllowed(session, options) {
  if (session?.state === 'lobby') return true
  return options?.late_join !== false
}
