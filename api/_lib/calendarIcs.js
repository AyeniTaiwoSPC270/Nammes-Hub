// A VCALENDAR built from the two calendar tables. Pure: no Supabase, no window, no Node built-ins, so the handler
// and a future client-side export button can share it. Spec: docs/superpowers/specs/2026-10-17-calendar-ics-feed-design.md
//
// The rules below are the difference between a file a client accepts and one it silently drops: CRLF everywhere,
// folding at 75 octets on a character boundary, text escaping, and all-day values kept as the date string they were
// stored as. `academic_calendar.starts_at` is a `date`, so it is never turned into a Date here -- that is how a day
// lands on the wrong side of midnight.
import { parseEventDate, toDayKey } from './calendarDates.js'

const DOMAIN = 'nammeshub.com.ng'
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

const escapeText = (value) =>
  String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')

const recordId = (row) => {
  const id = row?.id
  return typeof id === 'string' || typeof id === 'number' ? String(id).trim() : ''
}

const dayKeyOf = (value) => (typeof value === 'string' && DAY_KEY.test(value) ? value : null)

// The day after a stored day key, textually. Built in UTC so no local timezone can turn 2026-10-31 + 1 into a
// different day, and formatted back from UTC parts for the same reason.
function nextDayKey(key) {
  const [year, month, day] = key.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + 1))
  const pad = (n) => String(n).padStart(2, '0')
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`
}

const compactDay = (key) => key.replace(/-/g, '')

// UTC `YYYYMMDDTHHMMSSZ`, the one form every client agrees on without a VTIMEZONE block.
const utcStamp = (date) => date.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[-:]/g, '')

const parseInstant = (value) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const stampOrNull = (value) => {
  const date = parseInstant(value)
  return date ? utcStamp(date) : null
}

// Folding is by octets, not characters: the summaries are UTF-8 (`·`, `–`, `’`), and splitting one in half leaves
// a byte sequence no client can decode. Continuation lines start with a space, and that space counts towards the
// 75-octet budget, so later chunks get 74.
function foldLine(line) {
  const encoder = new TextEncoder()
  const parts = []
  let chunk = ''
  let budget = 75
  for (const char of line) {
    if (chunk && encoder.encode(chunk + char).length > budget) {
      parts.push(chunk)
      chunk = char
      budget = 74
    } else {
      chunk += char
    }
  }
  parts.push(chunk)
  return parts.map((part, index) => (index === 0 ? part : ` ${part}`)).join('\r\n')
}

function academicEvent(row, stamp) {
  const id = recordId(row)
  const start = dayKeyOf(row?.starts_at)
  // `starts_at IS NULL` means "to be determined". An invented date is a lie that stays in someone's phone.
  if (!id || !start) return null

  const storedEnd = dayKeyOf(row?.ends_at)
  // A reversed range cannot reach here (the table's check), and the builder still does not trust it.
  const last = storedEnd && storedEnd >= start ? storedEnd : start

  const lines = ['BEGIN:VEVENT', `UID:academic-${id}@${DOMAIN}`, `DTSTAMP:${stamp}`]
  const modified = stampOrNull(row?.updated_at)
  if (modified) lines.push(`LAST-MODIFIED:${modified}`)
  lines.push(
    `SUMMARY:${escapeText(row?.title)}`,
    `DTSTART;VALUE=DATE:${compactDay(start)}`,
    `DTEND;VALUE=DATE:${compactDay(nextDayKey(last))}`,
    // A lecture is not a meeting that blocks a room.
    'TRANSP:TRANSPARENT',
  )
  if (row?.note) lines.push(`DESCRIPTION:${escapeText(row.note)}`)
  if (row?.kind) lines.push(`CATEGORIES:${escapeText(row.kind)}`)
  lines.push('END:VEVENT')
  return lines
}

function eventEntry(row, stamp) {
  const id = recordId(row)
  if (!id) return null

  const timedStart = parseInstant(row?.starts_at)
  const lines = ['BEGIN:VEVENT', `UID:event-${id}@${DOMAIN}`, `DTSTAMP:${stamp}`]
  lines.push(`SUMMARY:${escapeText(row?.title)}`)

  if (timedStart) {
    // `starts_at` is a timestamptz, a real instant. UTC is the one representation every client reads the same.
    // A client that dislikes a zero-length timed event gets one hour, which is a display default, not a claim.
    const storedEnd = parseInstant(row?.ends_at)
    const end = storedEnd && storedEnd > timedStart ? storedEnd : new Date(timedStart.getTime() + 60 * 60 * 1000)
    lines.push(`DTSTART:${utcStamp(timedStart)}`, `DTEND:${utcStamp(end)}`)
  } else {
    // The legacy free-text column, read through the one parser the page also uses.
    const legacy = parseEventDate(row?.date)
    if (Number.isNaN(legacy.getTime())) return null
    const day = toDayKey(legacy)
    lines.push(
      `DTSTART;VALUE=DATE:${compactDay(day)}`,
      `DTEND;VALUE=DATE:${compactDay(nextDayKey(day))}`,
    )
  }

  if (row?.description) lines.push(`DESCRIPTION:${escapeText(row.description)}`)
  // The event cards put the venue in `meta`.
  if (row?.meta) lines.push(`LOCATION:${escapeText(row.meta)}`)
  lines.push('END:VEVENT')
  return lines
}

const asArray = (rows) => (Array.isArray(rows) ? rows : [])

/**
 * Rows in, one VCALENDAR out.
 *
 * `now` is the DTSTAMP for every event. It is a parameter rather than a clock read so the output is deterministic
 * in a test; nothing in the feed claims a revision from it.
 */
export function buildCalendarIcs({ academic = [], events = [] } = {}, { now = new Date() } = {}) {
  const stamp = utcStamp(now)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NAMMES Hub//Academic Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:NAMMES Hub — Academic Calendar',
    'X-WR-TIMEZONE:Africa/Lagos',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
  ]

  for (const row of asArray(academic)) {
    const entry = academicEvent(row, stamp)
    if (entry) lines.push(...entry)
  }
  for (const row of asArray(events)) {
    const entry = eventEntry(row, stamp)
    if (entry) lines.push(...entry)
  }

  lines.push('END:VCALENDAR')
  return `${lines.map(foldLine).join('\r\n')}\r\n`
}
