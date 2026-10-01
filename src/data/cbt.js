import { callQuiz } from './quiz'

// CBT practice: the small client for /api/quiz?action=cbt, the clock helpers and what a device remembers
// (the attempt in progress, and past scores). Spec: docs/superpowers/specs/2026-10-01-cbt-exam-mode.md

export const callCbt = (op, body = {}) => callQuiz('cbt', { op, ...body })

export const LEVEL_LABEL = { 100: '100 Level', 200: '200 Level', 300: '300 Level', 400: '400 Level', 500: '500 Level', other: 'Other' }

// ---- the clock ----
// The server owns the deadline. The browser only shows it, using the server's clock reading to correct for a wrong phone clock.
export function clockOffset(serverNow, deviceNow = Date.now()) {
  return Number.isFinite(serverNow) ? serverNow - deviceNow : 0
}

export function msLeft(deadlineAt, offset, deviceNow = Date.now()) {
  if (!deadlineAt) return null
  return new Date(deadlineAt).getTime() - (deviceNow + offset)
}

// 3725000 -> "1:02:05", 65000 -> "1:05", never negative.
export function formatClock(ms) {
  const total = Math.max(0, Math.ceil((ms ?? 0) / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const two = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`
}

// "calm" until 10 minutes are left, then "warn", then "danger" in the last minute.
export function clockTone(ms) {
  if (ms === null || ms === undefined) return 'calm'
  if (ms <= 60_000) return 'danger'
  if (ms <= 10 * 60_000) return 'warn'
  return 'calm'
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(seconds))
  const m = Math.floor(s / 60)
  if (m >= 60) return `${Math.floor(m / 60)} h ${m % 60} min`
  return m > 0 ? `${m} min ${s % 60} s` : `${s} s`
}

// ---- counting for the navigator and the submit box ----
export function answeredCount(answers, questions) {
  return questions.filter((q) => {
    const a = answers[q.id]
    return a && (Number.isInteger(a.choice) || (typeof a.text === 'string' && a.text.trim() !== ''))
  }).length
}

export function questionState(question, answers, flagged) {
  const a = answers[question.id]
  const answered = Boolean(a) && (Number.isInteger(a.choice) || (typeof a.text === 'string' && a.text.trim() !== ''))
  return { answered, flagged: flagged.includes(question.id) }
}

// ---- what this device remembers ----
const ACTIVE_KEY = 'nammes-cbt-active'
const HISTORY_KEY = 'nammes-cbt-history'
const HISTORY_MAX = 50

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key))
    return value ?? fallback
  } catch {
    return fallback
  }
}
function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // private mode: the exam still works, it just cannot be resumed after a refresh
  }
}

// The attempt in progress for each exam code (so a refresh or a closed tab can pick up where it was).
export function loadActive(code) {
  const all = readJson(ACTIVE_KEY, {})
  const entry = all && typeof all === 'object' ? all[code] : null
  return entry && typeof entry.token === 'string' ? entry : null
}
export function saveActive(code, entry) {
  const all = readJson(ACTIVE_KEY, {})
  writeJson(ACTIVE_KEY, { ...(all && typeof all === 'object' ? all : {}), [code]: entry })
}
export function clearActive(code) {
  const all = readJson(ACTIVE_KEY, {})
  if (all && typeof all === 'object') {
    delete all[code]
    writeJson(ACTIVE_KEY, all)
  }
}

export function loadHistory() {
  const list = readJson(HISTORY_KEY, [])
  return Array.isArray(list) ? list.filter((h) => h && typeof h.code === 'string' && Number.isFinite(h.total)) : []
}

// Adds a finished attempt to the history (once: `id` tells a repeat from a new attempt).
export function saveHistory(entry) {
  const list = loadHistory()
  if (list.some((h) => h.id === entry.id)) return list
  const next = [entry, ...list].slice(0, HISTORY_MAX)
  writeJson(HISTORY_KEY, next)
  return next
}

export function historyFor(code, list = loadHistory()) {
  return list.filter((h) => h.code === code)
}

// Best and latest percentage for an exam, from the exam-mode attempts (study attempts are listed but not counted).
export function progressFor(code, list = loadHistory()) {
  const exams = historyFor(code, list).filter((h) => h.mode === 'exam')
  if (exams.length === 0) return null
  return { attempts: exams.length, best: Math.max(...exams.map((h) => h.percent)), latest: exams[0].percent }
}

// One line per exam taken, for the "my progress" panel.
export function progressSummary(list = loadHistory()) {
  const seen = new Map()
  for (const h of list) {
    if (h.mode !== 'exam') continue
    const entry = seen.get(h.code) ?? { code: h.code, title: h.title, courseCode: h.courseCode ?? null, attempts: 0, best: 0, latest: h.percent, at: h.at }
    entry.attempts += 1
    entry.best = Math.max(entry.best, h.percent)
    seen.set(h.code, entry)
  }
  return [...seen.values()]
}

export function shareText({ title, courseCode, score, total, percent, url }) {
  const what = courseCode ? `${courseCode} ${title}` : title
  return `I scored ${score}/${total} (${percent}%) on ${what} CBT practice. Try it yourself: ${url}`
}
