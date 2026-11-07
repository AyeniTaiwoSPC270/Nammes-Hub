// Shape, sanity and formatting for the admin analytics dashboard.
//
// Everything here is pure: the admin_analytics RPC returns jsonb, and a database function is the one
// place in this repo no unit test can reach. So the payload is treated as untrusted input and rebuilt
// field by field -- a missing key, a null, a string where a number belongs, or a series of the wrong
// length all become a defined value rather than a `NaN` on a chart.

export const RANGE_OPTIONS = [
  { key: '7d', days: 7, label: '7 days' },
  { key: '30d', days: 30, label: '30 days' },
  { key: '90d', days: 90, label: '90 days' },
  { key: 'all', days: 0, label: 'All time' },
]

export const DEFAULT_RANGE = '30d'

// A range that names both ends instead of a number of days. It is not one of RANGE_OPTIONS because it
// is not a preset: it carries two dates, so it travels as ?range=custom&from=&to=.
export const CUSTOM_RANGE_KEY = 'custom'

// Mirrors the clamp inside admin_analytics. A client that allowed more would draw a label for a window
// the database quietly shortened underneath it.
export const MAX_RANGE_DAYS = 730

const DAY_MS = 24 * 60 * 60 * 1000

export function rangeDays(key) {
  return RANGE_OPTIONS.find((o) => o.key === key)?.days ?? 30
}

export function rangeKey(days) {
  return RANGE_OPTIONS.find((o) => o.days === Number(days))?.key ?? DEFAULT_RANGE
}

// A day key that is a real calendar date, not merely the right shape. `2026-02-31` matches
// /\d{4}-\d{2}-\d{2}/ and is a day nobody can look at, so it is refused here rather than handed to a
// query that returns seven empty charts. Built from its own parts, never `new Date('2026-02-31')` --
// that parse is UTC midnight, the trap api/_lib/calendarDates.js exists to close.
export function normaliseDay(value) {
  if (!isDay(value)) return ''
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const real = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  return real ? value : ''
}

// A day *count*, so Date.UTC is arithmetic here and deliberately not a wall-clock day.
function dayNumber(key) {
  const [year, month, day] = key.split('-').map(Number)
  return Date.UTC(year, month - 1, day) / DAY_MS
}

// Inclusive at both ends: one day is 1, not 0.
export function spanDays(from, to) {
  return Math.abs(dayNumber(to) - dayNumber(from)) + 1
}

// "Is today" read out of a Lagos calendar, because that is the day admin_analytics buckets in. An
// admin on a machine west of Greenwich would otherwise be offered a date the database has no rows for
// yet, and one east of it a date it already has.
export function todayDayKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type) => parts.find((p) => p.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

// Reads ?range= (and ?from=/?to=) from the URL. An unknown or missing value falls back to 30 days
// rather than throwing: a shared link with a typo should still open the page.
export function analyticsRangeFromSearch(search) {
  const params = new URLSearchParams(search)
  const key = params.get('range')

  if (key === CUSTOM_RANGE_KEY) {
    const a = normaliseDay(params.get('from'))
    const b = normaliseDay(params.get('to'))
    // A half-written custom range is not a range. Falling back to the preset beats answering with an
    // empty window the admin did not ask for and cannot see the edges of.
    if (a && b) {
      const from = a <= b ? a : b
      const to = a <= b ? b : a
      return { key: CUSTOM_RANGE_KEY, days: Math.min(spanDays(from, to), MAX_RANGE_DAYS), from, to }
    }
  }

  const preset = RANGE_OPTIONS.find((o) => o.key === key)
  const chosen = preset ?? RANGE_OPTIONS.find((o) => o.key === DEFAULT_RANGE)
  return { key: chosen.key, days: chosen.days, from: '', to: '' }
}

export function rangeFromSearch(search) {
  return analyticsRangeFromSearch(search).key
}

export function searchForRange(search, key) {
  const params = new URLSearchParams(search)
  params.set('range', RANGE_OPTIONS.some((o) => o.key === key) ? key : DEFAULT_RANGE)
  // Choosing a preset leaves a custom range behind, and leaving the dates in the URL would put the
  // page in two states at once on a refresh.
  params.delete('from')
  params.delete('to')
  const next = params.toString()
  return next ? `?${next}` : ''
}

export function searchForCustomRange(search, from, to) {
  const a = normaliseDay(from)
  const b = normaliseDay(to)
  if (!a || !b) return searchForRange(search, DEFAULT_RANGE)
  const params = new URLSearchParams(search)
  params.set('range', CUSTOM_RANGE_KEY)
  params.set('from', a <= b ? a : b)
  params.set('to', a <= b ? b : a)
  return `?${params.toString()}`
}

// What the CSV and PDF filenames call the window. A preset keeps its short key; a custom range names
// its own two days, because two exports of different weeks otherwise land in the same folder as
// nammes-analytics-custom.pdf twice.
export function rangeFileLabel(range) {
  if (range?.key === CUSTOM_RANGE_KEY && range.from && range.to) return `custom-${range.from}-to-${range.to}`
  return range?.key ?? DEFAULT_RANGE
}

export function percentDelta(current, previous) {
  const now = Number(current) || 0
  const before = Number(previous) || 0
  if (before === 0) return now === 0 ? 0 : null
  return (now - before) / before
}

export function formatDelta(delta) {
  if (delta === null) return 'new'
  return `${delta > 0 ? '+' : ''}${Math.round(delta * 100)}%`
}

// '/news/scholarship-night' -> 'News · scholarship night'. Used where a title could not be resolved, so
// a raw id-looking path still reads as a place rather than as a database value.
const PATH_LABELS = {
  '/': 'Home',
  '/about': 'About',
  '/contact': 'Contact',
  '/events': 'Events',
  '/news': 'News',
  '/resources': 'Resources',
  '/outlines': 'Outlines',
  '/curriculum': 'Curriculum',
  '/timetable': 'Timetable',
  '/calendar': 'Calendar',
  '/cgpa': 'CGPA calculator',
  '/awards': 'Awards',
  '/forms': 'Forms',
  '/opportunities': 'Opportunities',
  '/quiz': 'Quizzes',
  '/excos': 'Excos',
  '/login': 'Sign in',
  '/signup': 'Sign up',
}

export function humanisePath(path) {
  const clean = normalisePath(path)
  if (PATH_LABELS[clean]) return PATH_LABELS[clean]
  const [, section, ...rest] = clean.split('/')
  if (!section) return 'Home'
  const name = PATH_LABELS[`/${section}`] ?? section.charAt(0).toUpperCase() + section.slice(1)
  if (!rest.length) return name
  const detail = rest.join(' · ').replace(/[-_]+/g, ' ')
  return `${name} · ${detail}`
}

export function normalisePath(path) {
  const value = typeof path === 'string' ? path : ''
  if (!value) return '/'
  let clean = value.split('?')[0].split('#')[0]
  if (!clean.startsWith('/')) clean = `/${clean}`
  if (clean.length > 1) clean = clean.replace(/\/+$/, '')
  return clean || '/'
}

function toNumber(value) {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function toInt(value) {
  return Math.round(toNumber(value))
}

function toText(value, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function isDay(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function list(value, cap) {
  return Array.isArray(value) ? value.slice(0, cap) : []
}

export function emptyAnalytics(days = 30) {
  return {
    range: { days, from: '', to: '', previousFrom: '', previousTo: '' },
    kpis: {
      views: { current: 0, previous: 0 },
      visitors: { current: 0, previous: 0 },
      signups: { current: 0, previous: 0 },
      quizPlays: { current: 0, previous: 0, players: 0 },
      cbtAttempts: { current: 0, previous: 0, averageScore: 0 },
      formResponses: { current: 0, previous: 0 },
      reports: { current: 0, previous: 0 },
      feedback: { current: 0, previous: 0, average: 0, total: 0 },
      optInRate: { current: 0, previous: 0, optedIn: 0, total: 0 },
    },
    traffic: [],
    signups: [],
    engagement: [],
    topContent: [],
    awards: [],
    email: { optedIn: 0, optedOut: 0, broadcasts: [] },
    attention: {
      pendingSubmissions: 0,
      pendingReviews: 0,
      unhandledMessages: 0,
      unhandledReports: 0,
      calendarTba: 0,
      failedEmails: 0,
      errors24h: 0,
    },
    activity: [],
  }
}

const TRAFFIC_KEYS = ['views', 'visitors', 'signedIn']
const ENGAGEMENT_KEYS = ['quiz', 'practice', 'battles', 'cbt', 'forms']

function series(value, keys, cap) {
  return list(value, cap)
    .filter((row) => isDay(record(row).day))
    .map((row) => {
      const entry = { day: row.day }
      for (const key of keys) entry[key] = toInt(row[key])
      return entry
    })
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
}

export function sanitizeAnalytics(raw, days = 30) {
  const base = emptyAnalytics(days)
  if (!raw || typeof raw !== 'object') return base

  const range = record(raw.range)
  const kpis = record(raw.kpis)
  const kpi = (key) => record(kpis[key])
  const optIn = kpi('optInRate')
  const total = toInt(optIn.total)
  const optedIn = Math.min(toInt(optIn.optedIn), total)
  const email = record(raw.email)
  const attention = record(raw.attention)
  const cap = Math.max(1, Math.min(3660, toInt(range.days) || days || 30))

  return {
    range: {
      days: toInt(range.days) || days,
      from: toText(range.from),
      to: toText(range.to),
      previousFrom: toText(range.previousFrom),
      previousTo: toText(range.previousTo),
    },
    kpis: {
      views: { current: toInt(kpi('views').current), previous: toInt(kpi('views').previous) },
      visitors: {
        current: toInt(kpi('visitors').current),
        previous: toInt(kpi('visitors').previous),
      },
      signups: { current: toInt(kpi('signups').current), previous: toInt(kpi('signups').previous) },
      quizPlays: {
        current: toInt(kpi('quizPlays').current),
        previous: toInt(kpi('quizPlays').previous),
        players: toInt(kpi('quizPlays').players),
      },
      cbtAttempts: {
        current: toInt(kpi('cbtAttempts').current),
        previous: toInt(kpi('cbtAttempts').previous),
        averageScore: Math.min(100, toInt(kpi('cbtAttempts').averageScore)),
      },
      formResponses: {
        current: toInt(kpi('formResponses').current),
        previous: toInt(kpi('formResponses').previous),
      },
      reports: {
        current: toInt(kpi('reports').current),
        previous: toInt(kpi('reports').previous),
      },
      // The count is the window; the average and total are all time, which is how the database
      // builds it -- a rating table has too few rows for a thirty-day mean to say anything. The
      // average is clamped rather than trusted, because it is the one number drawn to one decimal
      // and a hand-edited row could otherwise print 9.7 out of 5.
      feedback: {
        current: toInt(kpi('feedback').current),
        previous: toInt(kpi('feedback').previous),
        average: Math.min(5, Math.max(0, toNumber(kpi('feedback').average))),
        total: toInt(kpi('feedback').total),
      },
      // Recomputed from the counts rather than trusting the ratio: a row edited by hand between the two
      // numbers would otherwise show a share that matches neither of them.
      optInRate: {
        current: total === 0 ? 0 : optedIn / total,
        previous: toNumber(optIn.previous),
        optedIn,
        total,
      },
    },
    traffic: series(raw.traffic, TRAFFIC_KEYS, cap),
    signups: series(raw.signups, ['count'], cap),
    engagement: series(raw.engagement, ENGAGEMENT_KEYS, cap),
    topContent: list(raw.topContent, 8)
      .map((row) => ({
        path: normalisePath(record(row).path),
        label: toText(record(row).label) || humanisePath(record(row).path),
        views: toInt(record(row).views),
      }))
      .filter((row) => row.views > 0)
      .sort((a, b) => b.views - a.views),
    awards: list(raw.awards, 8)
      .map((row) => ({ category: toText(record(row).category), votes: toInt(record(row).votes) }))
      .filter((row) => row.category && row.votes > 0)
      .sort((a, b) => b.votes - a.votes),
    email: {
      optedIn: Math.max(0, toInt(email.optedIn)),
      optedOut: Math.max(0, toInt(email.optedOut)),
      broadcasts: list(email.broadcasts, 6).map((row) => ({
        subject: toText(record(row).subject, 'Untitled'),
        recipients: toInt(record(row).recipients),
        sentAt: toText(record(row).sentAt),
      })),
    },
    attention: {
      pendingSubmissions: toInt(attention.pendingSubmissions),
      pendingReviews: toInt(attention.pendingReviews),
      unhandledMessages: toInt(attention.unhandledMessages),
      unhandledReports: toInt(attention.unhandledReports),
      calendarTba: toInt(attention.calendarTba),
      failedEmails: toInt(attention.failedEmails),
      errors24h: toInt(attention.errors24h),
    },
    // Labels come back as plain text and are always rendered as text nodes; nothing here is ever
    // injected as HTML, so a submission title containing markup is shown literally.
    activity: list(raw.activity, 12)
      .map((row) => ({
        kind: toText(record(row).kind, 'activity'),
        label: toText(record(row).label),
        at: toText(record(row).at),
      }))
      .filter((row) => row.label && row.at),
  }
}

// Nothing is recorded until the tracker ships, so a working dashboard can legitimately look broken.
// The page says so instead of drawing an empty axis with no explanation.
export function hasTraffic(data) {
  return (data?.kpis?.views?.current ?? 0) > 0
}

export function totalFor(rows, keys) {
  return rows.reduce((sum, row) => sum + keys.reduce((inner, key) => inner + toNumber(row[key]), 0), 0)
}

// Skinny bars are wasteful once there are more than ~90 points, and unreadable past a year. Weekly
// buckets keep the shape of a long series while staying under the point budget.
export function downsample(rows, maxPoints = 90) {
  if (!Array.isArray(rows) || rows.length <= maxPoints) return Array.isArray(rows) ? rows : []
  const bucketSize = Math.ceil(rows.length / maxPoints)
  const out = []
  for (let i = 0; i < rows.length; i += bucketSize) {
    const slice = rows.slice(i, i + bucketSize)
    const merged = { ...slice[0], day: slice[0].day }
    for (const key of Object.keys(slice[0])) {
      if (key === 'day') continue
      merged[key] = slice.reduce((sum, row) => sum + toNumber(row[key]), 0)
    }
    out.push(merged)
  }
  return out
}

const CSV_COLUMNS = ['section', 'day', 'label', 'value']

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function analyticsCsv(data) {
  const d = sanitizeAnalytics(data, data?.range?.days ?? 30)
  const rows = []

  for (const [key, kpi] of Object.entries(d.kpis)) {
    if (key === 'optInRate') {
      rows.push({ section: 'kpi', day: '', label: 'optInRate', value: d.kpis.optInRate.current })
      rows.push({ section: 'kpi', day: '', label: 'optedIn', value: d.kpis.optInRate.optedIn })
      rows.push({ section: 'kpi', day: '', label: 'members', value: d.kpis.optInRate.total })
    } else {
      rows.push({ section: 'kpi', day: '', label: key, value: kpi.current })
    }
  }
  for (const row of d.traffic) {
    for (const key of TRAFFIC_KEYS) rows.push({ section: 'traffic', day: row.day, label: key, value: row[key] })
  }
  for (const row of d.signups) rows.push({ section: 'signups', day: row.day, label: 'signups', value: row.count })
  for (const row of d.engagement) {
    for (const key of ENGAGEMENT_KEYS) rows.push({ section: 'engagement', day: row.day, label: key, value: row[key] })
  }
  for (const row of d.topContent) rows.push({ section: 'top_content', day: '', label: row.label, value: row.views })
  for (const row of d.awards) rows.push({ section: 'awards', day: '', label: row.category, value: row.votes })
  for (const [key, value] of Object.entries(d.attention)) {
    rows.push({ section: 'attention', day: '', label: key, value })
  }

  const lines = [CSV_COLUMNS.join(',')]
  for (const row of rows) lines.push(CSV_COLUMNS.map((column) => csvCell(row[column])).join(','))
  // A trailing newline keeps the file from looking truncated to tools that expect one.
  return `${lines.join('\n')}\n`
}

export function csvFilename(rangeKeyValue) {
  const stamp = new Date().toISOString().slice(0, 10)
  return `nammes-analytics-${rangeKeyValue}-${stamp}.csv`
}

// Exported so the PDF report prints months the same way the charts do.
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// "2026-10-05" -> "5 Oct", from the string's own parts.
//
// Two traps avoided here. `new Date('2026-10-05')` is UTC midnight and reads back as the 4th west of
// Greenwich (the rule in api/_lib/calendarDates.js), and `toLocaleDateString` renders "Sep 26" on an
// en-US machine and "26 Sep" on an en-GB one -- which is how this passed locally and failed CI. The
// app is English-only and a chart axis cannot reflow per viewer, so the format is fixed.
export function formatDay(day) {
  if (!isDay(day)) return ''
  const [, month, date] = day.split('-').map(Number)
  return `${date} ${MONTHS[month - 1] ?? ''}`.trim()
}

export function relativeWhen(value) {
  const at = new Date(value).getTime()
  if (!Number.isFinite(at)) return ''
  const diff = Date.now() - at
  if (diff < DAY_MS) {
    const minutes = Math.max(1, Math.round(diff / 60_000))
    if (minutes < 60) return `${minutes}m ago`
    return `${Math.round(minutes / 60)}h ago`
  }
  const days = Math.round(diff / DAY_MS)
  if (days < 30) return `${days}d ago`
  const then = new Date(at)
  return `${then.getDate()} ${MONTHS[then.getMonth()]}`
}

export function percentLabel(value) {
  return `${Math.round(toNumber(value) * 100)}%`
}
