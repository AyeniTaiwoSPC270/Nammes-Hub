// Merging the senate's `academic_calendar` rows with the existing `events` table into the one list /calendar draws.
// Spec: docs/superpowers/specs/2026-10-08-academic-calendar-design.md §5, §6
//
// The two tables disagree about almost everything, and this is where that disagreement is settled. Senate dates are
// `date` columns — no timezone, no clock, always all-day. Departmental events are `timestamptz`, so one genuinely
// can have a time of day, and it also still carries the free-text `date` column every row was written with before
// the timestamps existed. Normalising both shapes here means the month grid, the agenda, the next-up strip and the
// reminder worker all read the same day key for the same item, whichever table it came from.
//
// `parseEventDate` is imported rather than reimplemented: it is the documented fallback for legacy rows (spec §2),
// and a second copy of "3rd August 2026" is a second thing that can drift from the one the events page still uses.
import { fromDayKey, toDayKey, rangesOverlap } from './calendarDates.js'
import { KIND_ORDER } from './calendarTheme.js'
import { parseEventDate } from '../../src/data/events.js'

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

// A paste can carry a whole academic year, so a cap keeps the page from being asked to render an unbounded list.
// A caller that genuinely wants more passes its own limit.
const DEFAULT_LIMIT = 500

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

// Every bound in this module is a day key, so a hand-edited 'starts_at', a reminder row with a truncated key and
// the string 'not-a-date' are one problem: they are not dates. fromDayKey does not throw on those — it builds an
// Invalid Date, which compares false against everything and would quietly empty a range — so they are rejected here.
function isDayKey(value) {
  if (typeof value !== 'string' || !DAY_KEY.test(value)) return false
  const day = fromDayKey(value)
  return toDayKey(day) === value
}

function dayKeyOf(value) {
  return isDayKey(value) ? value : null
}

function dateOfDayKey(value) {
  return isDayKey(value) ? fromDayKey(value) : null
}

// A `timestamptz` column arrives as an ISO string with an offset. Reading the local day off it rather than the
// UTC day is the whole reason an event reads on the day it was actually held for the reader sitting in front of it.
function parseTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

// The pre-timestamp column: human text, sometimes with an ordinal on it. parseEventDate answers an Invalid Date
// rather than throwing when it cannot read the string, and that answer is the only signal there is.
function dayKeyOfLegacy(value) {
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = parseEventDate(value)
  return Number.isNaN(parsed.getTime()) ? null : toDayKey(parsed)
}

// Midnight is not a time of day on a calendar. An event stored at exactly local midnight is an all-day marker, so
// it renders as a bar in the grid rather than as the only thing happening at 00:00.
function hasClockTime(date) {
  return date.getHours() !== 0 || date.getMinutes() !== 0 || date.getSeconds() !== 0 || date.getMilliseconds() !== 0
}

// The column is constrained to 0..30 and the reminder worker schedules off it, so a value outside that is no
// reminder rather than a reminder nobody asked for.
function cleanRemindDays(value) {
  return Number.isInteger(value) && value >= 0 && value <= 30 ? value : null
}

// `events.kind` is deliberately not held to the academic vocabulary (spec §3.2) — an event is not a senate date.
// Every colour, icon and label on the calendar is keyed by a KIND_ORDER kind though, so a kind the theme cannot
// paint becomes 'other' rather than an item the legend has no swatch for.
function cleanKind(value) {
  return KIND_ORDER.includes(value) ? value : 'other'
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

// Both tables key on `id`. A row without one is not a row, and inventing an identifier for it would give the
// reminder worker a dedupe key it could collide on.
function baseId(row) {
  const raw = row.id
  if (raw === null || raw === undefined) return null
  const id = String(raw).trim()
  return id || null
}

// `ends_at` null means one day. A stored end before the start is impossible — the schema rejects it and the paste
// parser refuses it first — but a row that reached here another way still gets a bar that runs forwards.
function laterEnd(startsAt, endsAt) {
  if (!startsAt) return null
  if (!endsAt || endsAt < startsAt) return startsAt
  return endsAt
}

function buildItem({ id, source, title, kind, startsAt, endsAt, allDay, note, href, remindDays }) {
  return { id, source, title, kind, startsAt, endsAt, allDay, note, href, remindDays, isMultiDay: endsAt !== startsAt }
}

// Namespaced so an `academic_calendar` row and an `events` row sharing a literal id stay two items: the source
// filter, the reminder dedupe key and any future per-item edit all address an id, and 'ac-1' in both tables is
// not one thing.
function academicItem(row) {
  const id = baseId(row)
  if (!id) return null

  const startsAt = dayKeyOf(row.starts_at)
  const endsAt = laterEnd(startsAt, dayKeyOf(row.ends_at))

  return buildItem({
    id: `academic:${id}`,
    source: 'academic',
    title: cleanText(row.title),
    kind: cleanKind(row.kind),
    startsAt,
    // Every senate item is all-day (spec §2). That is why the column is a `date` and not a `timestamptz`.
    endsAt,
    allDay: true,
    note: cleanText(row.note) || null,
    // v1 has no academic detail page to link to (spec §6), so an academic item is not clickable.
    href: null,
    remindDays: cleanRemindDays(row.remind_days),
  })
}

function eventItem(row) {
  const id = baseId(row)
  if (!id) return null

  // `starts_at` wins when it is there. The free-text `date` is only read when it is not, so migrating a row to a
  // real timestamp can never be silently undone by the column that predates it.
  const startInstant = parseTimestamp(row.starts_at)
  const startsAt = (startInstant && toDayKey(startInstant)) ?? dayKeyOfLegacy(row.date)
  // An `ends_at` with no time on it cannot make an all-day row timed, and an event with a start time and no end
  // time is a single day on the grid rather than a bar running to the end of time.
  const endInstant = parseTimestamp(row.ends_at)
  const endsAt = laterEnd(startsAt, endInstant && toDayKey(endInstant))

  return buildItem({
    id: `event:${id}`,
    source: 'event',
    title: cleanText(row.title),
    kind: cleanKind(row.kind),
    startsAt,
    endsAt,
    // Read off the instant, not off a date rebuilt from the day key: fromDayKey gives local midnight every time,
    // so asking it would call every event all-day. A legacy free-text date has no clock on it at all, which is
    // the same answer for a different reason.
    allDay: startInstant ? !hasClockTime(startInstant) : true,
    // `events` has no `note` column — the free text on an event row is `description`, and reading it under the
    // academic name would have handed the grid an empty note for every departmental event.
    note: cleanText(row.description) || null,
    href: `/events/${id}`,
    remindDays: cleanRemindDays(row.remind_days),
  })
}

// Total and input-order independent: two rows agreeing on date and title still have an id to be ordered by, so the
// grid never reshuffles between renders because two queries returned in a different order.
function byOrder(a, b) {
  return (
    compare(a.startsAt, b.startsAt) ||
    compare(a.endsAt, b.endsAt) ||
    compare(a.title, b.title) ||
    compare(a.id, b.id)
  )
}

function rowsOf(value) {
  return Array.isArray(value) ? value : []
}

// A bound that is not a day key is ignored rather than read as the year 1. Dropping the bad bound keeps the
// calendar rendering everything; honouring it would blank it.
function inRange(item, fromDate, toDate) {
  const start = fromDayKey(item.startsAt)
  const end = fromDayKey(item.endsAt)
  // rangesOverlap is half-open at both ends, which is what makes `to` exclusive: an item running up to `to` is on
  // screen right up to the boundary and not past it. Adding a day here to treat the stored end as inclusive would
  // be reinterpreting the module rather than using it.
  if (fromDate && toDate) return rangesOverlap(fromDate, toDate, start, end)
  if (fromDate) return fromDate < end
  if (toDate) return start < toDate
  return true
}

/**
 * Both sources in, one list out, plus the undated rows and whether the cap bit.
 *
 * `from` and `to` are optional 'YYYY-MM-DD' day keys bounding the window; `to` is exclusive, matching
 * `rangesOverlap`. Omit either (or both) and every dated item comes back. `limit` caps the dated list only —
 * the TBA panel is a fixed panel, not a grid, and truncating it would hide the rows it exists to keep visible.
 */
export function mergeCalendarSources({ academic = [], events = [] } = {}, { from, to, limit = DEFAULT_LIMIT } = {}) {
  const dated = []
  const undated = []

  // A malformed row is skipped rather than thrown from: this runs against two tables a dashboard can edit by hand,
  // and one hand-edited row must not take the calendar down with it.
  const take = (row, build) => {
    try {
      const item = row && typeof row === 'object' ? build(row) : null
      if (item) (item.startsAt ? dated : undated).push(item)
    } catch {
      // Nothing to salvage from a row that cannot be read at all.
    }
  }

  for (const row of rowsOf(academic)) take(row, academicItem)
  for (const row of rowsOf(events)) take(row, eventItem)

  const fromDate = dateOfDayKey(from)
  const toDate = dateOfDayKey(to)
  const ordered = dated.filter((item) => inRange(item, fromDate, toDate)).sort(byOrder)
  undated.sort(byOrder)

  const cap = Number.isFinite(limit) && limit >= 0 ? Math.floor(limit) : DEFAULT_LIMIT

  return { items: ordered.slice(0, cap), tba: undated, hasMore: ordered.length > cap }
}