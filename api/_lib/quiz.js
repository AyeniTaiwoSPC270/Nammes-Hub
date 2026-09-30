import { createHash, randomBytes, randomInt } from 'node:crypto'

// Pure game rules for the live quiz. No database access here so every rule can be tested on its own.
// Spec: docs/superpowers/specs/2026-09-30-live-quiz-design.md

export const MAX_PLAYERS = 150
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

// Nicknames are shown on a projector to a room, so keep them short, plain and free of the obvious rude words.
const BLOCKED = ['fuck', 'shit', 'bitch', 'cunt', 'nigg', 'dick', 'pussy', 'whore', 'slut', 'rape', 'asshole']

export function validateNickname(raw) {
  if (typeof raw !== 'string') return { ok: false, error: 'Enter a nickname' }
  // eslint-disable-next-line no-control-regex
  const nickname = raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim()
  if (nickname.length < 1) return { ok: false, error: 'Enter a nickname' }
  if (nickname.length > 20) return { ok: false, error: 'Nicknames can be at most 20 characters' }
  const squashed = nickname.toLowerCase().replace(/[^a-z]/g, '')
  if (BLOCKED.some((word) => squashed.includes(word))) return { ok: false, error: 'Please pick a different nickname' }
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

// Rank players by score (ties share the better rank). Used for leaderboards and each player's own position.
export function rankPlayers(players) {
  const sorted = [...players].sort((a, b) => b.total_score - a.total_score || a.nickname.localeCompare(b.nickname))
  let lastScore = null
  let lastRank = 0
  return sorted.map((p, i) => {
    const rank = p.total_score === lastScore ? lastRank : i + 1
    lastScore = p.total_score
    lastRank = rank
    return { id: p.id, nickname: p.nickname, total_score: p.total_score, rank }
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
