// Local-time date maths shared by the calendar handlers and the calendar pages. Spec: docs/superpowers/specs/2026-10-08-academic-calendar-design.md
//
// Everything here works in the reader's own timezone. A calendar day is a wall-clock day, not an instant, so the
// only safe way to build one from a day key is `new Date(year, monthIndex, day)`.
const pad2 = (n) => String(n).padStart(2, '0')

// A day key is the local calendar day as 'YYYY-MM-DD'. Read the parts off the Date rather than using
// toISOString(), which would give the UTC day and shift every event by a day west of Greenwich.
export function toDayKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

// Never `new Date('2026-10-05')`: that is UTC midnight, so it reads back as the 4th anywhere with a negative
// offset. Nigeria is UTC+1 and would never notice, which is exactly why the bug survives to production.
export function fromDayKey(key) {
  const [year, monthIndex, day] = String(key).split('-').map(Number)
  return new Date(year, monthIndex - 1, day)
}

export function isSameDay(a, b) {
  return toDayKey(a) === toDayKey(b)
}

export function addDays(date, n) {
  const next = new Date(date.getTime())
  next.setDate(next.getDate() + n)
  return next
}

// Clamp to the target month's length so 31 Jan plus a month lands on the last day of February, not in March.
export function addMonths(date, n) {
  const target = new Date(date.getFullYear(), date.getMonth() + n, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(date.getDate(), lastDay))
  return target
}

export function eachDay(from, to) {
  const days = []
  const endKey = toDayKey(to)
  // The bound is compared as day keys rather than as instants. addDays preserves the wall clock, so in a
  // zone that springs forward at local midnight (Havana, Beirut, Santiago) the cursor ends up an hour
  // ahead of a `to` built at 00:00, and an instant comparison drops the final day of the range.
  for (let cursor = new Date(from.getTime()); toDayKey(cursor) <= endKey; cursor = addDays(cursor, 1)) {
    days.push(cursor)
  }
  return days
}

// Half-open at both ends, so a class ending the day a revision starts does not claim that day twice.
export function rangesOverlap(aFrom, aTo, bFrom, bTo) {
  return aFrom < bTo && bFrom < aTo
}

// Takes a year and a 0-based month index rather than a Date, so a caller cannot pass a day that has already
// been shifted by an earlier UTC parse.
export function monthGrid(year, monthIndex, { weekStart = 1 } = {}) {
  const first = new Date(year, monthIndex, 1)
  const last = new Date(year, monthIndex + 1, 0)
  const lead = (first.getDay() - weekStart + 7) % 7
  const grid = []
  let cursor = addDays(first, -lead)
  const total = Math.ceil((lead + last.getDate()) / 7) * 7
  for (let i = 0; i < total; i += 7) {
    grid.push(Array.from({ length: 7 }, (_, d) => addDays(cursor, i + d)))
  }
  return grid
}