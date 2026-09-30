import { createHash, randomBytes, randomInt } from 'node:crypto'

// Pure game rules for the live quiz. No database access here so every rule can be tested on its own.
// Spec: docs/superpowers/specs/2026-09-30-live-quiz-design.md

export const MAX_PLAYERS = 150
export const DEFAULT_MAX_PLAYERS = 50
export const MIN_PLAYERS_LIMIT = 2
// How long a full lobby waits before the game starts by itself (the host can start it sooner).
export const FULL_LOBBY_COUNTDOWN_MS = 10_000
export const AVATAR_COUNT = 50

// The limit an admin sets for a game: a whole number from 2 up to the hard ceiling.
export function isMaxPlayers(value) {
  return Number.isInteger(value) && value >= MIN_PLAYERS_LIMIT && value <= MAX_PLAYERS
}

export function isAvatarId(value) {
  return Number.isInteger(value) && value >= 0 && value < AVATAR_COUNT
}
// Phones have network delay, so an answer is still accepted this long after the timer hits zero.
export const ANSWER_GRACE_MS = 1500

export function generateJoinCode(rand = randomInt) {
  return String(rand(0, 1_000_000)).padStart(6, '0')
}

export function newPlayerToken() {
  return randomBytes(24).toString('base64url')
}

export function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex')
}

export { hasBlockedWord } from './quizText.js'
import { hasBlockedWord } from './quizText.js'

// Nicknames are shown on a projector to a room, so keep them short, plain and free of the obvious rude words.
export function validateNickname(raw) {
  if (typeof raw !== 'string') return { ok: false, error: 'Enter a nickname' }
  // eslint-disable-next-line no-control-regex
  const nickname = raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim()
  if (nickname.length < 1) return { ok: false, error: 'Enter a nickname' }
  if (nickname.length > 20) return { ok: false, error: 'Nicknames can be at most 20 characters' }
  if (hasBlockedWord(nickname)) return { ok: false, error: 'Please pick a different nickname' }
  return { ok: true, value: nickname }
}

export function isJoinCode(value) {
  return typeof value === 'string' && /^\d{6}$/.test(value)
}

// Faster correct answers earn more: full points at once, half points on the last second. Wrong or late earns 0.
export function scoreAnswer({ correct, points, timeLimitSeconds, elapsedMs }) {
  if (!correct) return 0
  const limitMs = timeLimitSeconds * 1000
  if (elapsedMs > limitMs + ANSWER_GRACE_MS) return 0
  const fraction = Math.min(Math.max(elapsedMs, 0), limitMs) / limitMs
  return Math.round(points * (1 - fraction / 2))
}

export * from './quizGrading.js'

// The two wrong options a 50/50 hides for one player on one question. Stable: asking again gives the same two.
export function fiftyFiftyHidden({ playerId, questionId, optionCount, correctIndex }) {
  if (optionCount !== 4) return []
  const wrong = [0, 1, 2, 3].filter((i) => i !== correctIndex)
  const weight = (i) => createHash('sha256').update(`${playerId}:${questionId}:${i}`).digest().readUInt32BE(0)
  return wrong.sort((a, b) => weight(a) - weight(b)).slice(0, 2).sort((a, b) => a - b)
}

// ---- Timing with pause and extra time (all from server timestamps) ----
export const EXTEND_STEP_MS = 10_000
export const MAX_EXTEND_MS = 60_000

function ms(value) {
  const t = new Date(value).getTime()
  return Number.isFinite(t) ? t : 0
}

// Time a question has actually been running: not counting time the host had it paused.
export function effectiveElapsedMs(session, nowMs) {
  const started = ms(session.question_started_at)
  const pausedTotal = session.paused_total_ms ?? 0
  if (session.paused_at) return Math.max(0, ms(session.paused_at) - started - pausedTotal)
  return Math.max(0, nowMs - started - pausedTotal)
}

// The question's full allowance in milliseconds, including any time the host added.
export function questionLimitMs(session, question) {
  return question.time_limit_seconds * 1000 + (session.time_bonus_ms ?? 0)
}

// lobby -> question -> reveal -> leaderboard -> question ... -> finished
export function nextState(session, questionCount) {
  switch (session.state) {
    case 'lobby':
      return questionCount > 0 ? { state: 'question', current_question_index: 0, startsQuestion: true } : null
    case 'question':
      return { state: 'reveal', current_question_index: session.current_question_index }
    case 'reveal':
      return { state: 'leaderboard', current_question_index: session.current_question_index }
    case 'leaderboard': {
      const next = session.current_question_index + 1
      return next < questionCount
        ? { state: 'question', current_question_index: next, startsQuestion: true }
        : { state: 'finished', current_question_index: session.current_question_index }
    }
    default:
      return null
  }
}

// The columns to write when a game moves to `next` (see nextState). Every step starts with a clean clock.
export function stepUpdate(next, nowIso) {
  const update = { state: next.state, current_question_index: next.current_question_index, paused_at: null }
  if (next.startsQuestion) Object.assign(update, { question_started_at: nowIso, time_bonus_ms: 0, paused_total_ms: 0 })
  if (next.state === 'finished') update.finished_at = nowIso
  return update
}

// Rank players by score (ties share the better rank). Used for leaderboards and each player's own position.
export function rankPlayers(players) {
  const sorted = [...players].sort((a, b) => b.total_score - a.total_score || a.nickname.localeCompare(b.nickname))
  let lastScore = null
  let lastRank = 0
  return sorted.map((p, i) => {
    const rank = p.total_score === lastScore ? lastRank : i + 1
    lastScore = p.total_score
    lastRank = rank
    return { id: p.id, nickname: p.nickname, total_score: p.total_score, avatar_id: p.avatar_id ?? 0, rank }
  })
}

// Best-effort limiter for one server instance. Serverless instances do not share memory, so this only
// slows down a single noisy client; it is not a hard guarantee.
export function createRateLimiter({ max, windowMs, now = Date.now }) {
  const hits = new Map()
  return function allow(key) {
    const t = now()
    const recent = (hits.get(key) ?? []).filter((time) => t - time < windowMs)
    if (recent.length >= max) {
      hits.set(key, recent)
      return false
    }
    recent.push(t)
    hits.set(key, recent)
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (v.every((time) => t - time >= windowMs)) hits.delete(k)
    }
    return true
  }
}

export function clientIp(req) {
  return String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown'
}
