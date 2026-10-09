// Reading a pasted academic calendar into rows an admin reviews before committing. Spec:
// docs/superpowers/specs/2026-10-08-academic-calendar-design.md §5.2
//
// The failure this module exists to avoid is a silent one. An admin pastes a page of senate calendar into a box and
// gets no account of what was missed, so a line that cannot be read has to come back as a warning carrying its line
// number and its raw text. Dropping it quietly is worse than refusing: 28 rows imported where the admin believed
// they imported 30, and the two missing dates surface weeks later as a student asking why nobody said exam week
// had started.
//
// It is deliberately incurious about meaning. `kind` is the admin's call in the review screen, because reading
// "Editing of Registered Courses" as a registration is a judgement call and a regex should not make it. What comes
// back is what the text says.
import { fromDayKey, toDayKey } from './calendarDates.js'

const pad2 = (n) => String(n).padStart(2, '0')

const MONTHS = [
  ['january', 1], ['february', 2], ['march', 3], ['april', 4], ['may', 5], ['june', 6],
  ['july', 7], ['august', 8], ['september', 9], ['october', 10], ['november', 11], ['december', 12],
]
const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

// The same document writes both the full and the three-letter form, sometimes of the same month, so both are read.
const MONTH_ALTERNATION = [...MONTHS.map(([name]) => name), ...MONTHS.map(([name]) => name.slice(0, 3))].join('|')
const WEEKDAY_ALTERNATION = [...WEEKDAYS, ...WEEKDAYS.map((name) => name.slice(0, 3))].join('|')
const MONTH_NUMBER = new Map()
for (const [name, number] of MONTHS) {
  MONTH_NUMBER.set(name, number)
  MONTH_NUMBER.set(name.slice(0, 3), number)
}
MONTH_NUMBER.set('sept', 9)

const ORDINAL = '(?:st|nd|rd|th)'
// A weekday, a month name and a day, with every piece of punctuation optional. The source writes 'Monday, October
// 5, 2026', 'Monday October 5 2026' and '*Monday, October 19, 2026' within the same page, and puts a footnote
// asterisk on either side of the date. `\b` after the month is what stops 'Octember' being read as October — a
// corrupted month name has to fail loudly, not import as the date the admin half-remembered.
const DATE = new RegExp(
  `^\\*?\\s*(?:(?:${WEEKDAY_ALTERNATION})\\b\\.?\\s*,?\\s*)?(${MONTH_ALTERNATION})\\b\\.?\\s+(\\d{1,2})${ORDINAL}?\\s*,?\\s*(\\d{4})?\\s*\\*?`,
  'i',
)
// 'Monday, February 22 - 26, 2027': the second half of a range drops the month and the weekday. It must still carry
// the year, otherwise '... - 57th Convocation Ceremonies' would parse as a one-day range ending on the 57th.
const SHORT_DATE = new RegExp(`^(\\d{1,2})${ORDINAL}?\\s*,\\s*(\\d{4})\\s*\\*?`, 'i')

// Hyphen, non-breaking hyphen, figure dash, en dash, em dash, horizontal bar, minus, and U+FFFD — which is what the
// PDF extractor leaves behind when it meets an en dash. All of them are the same word to this parser: a separator.
const DASHES = /[\u00AD\u2010-\u2015\u2212\uFFFD]/g
const TO_BE_DETERMINED = /^to be determined\b\s*/i
const DASH_AFTER = /^\s*-\s*/
const NOTE_ONLY = /^(?:\([^()]*\)\s*)+$/
const CONTINUATION = /^[A-Z]/
const TRAILING_NOTE = /((?:\s*\([^()]*\)\s*)+)$/
const WEEKDAY_HEAD = new RegExp(`^\\*?\\s*(?:${WEEKDAY_ALTERNATION})\\b`, 'i')

const NOISE = [
  /^please turn over$/i,
  /^turn over$/i,
  /^university of lagos$/i,
  /^page \d+ of \d+$/i,
  /^senate-proposed-academic-calendar/i,
]

// The extraction glues a slash to one word and spaces the other: 'week/ GST', 'Semester/', 'First Semester/'.
function tidyTitle(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/(\S)\s*\/\s*(\S)/g, (whole, before, after) =>
      // A slash between two digits is a year range, not a separator, so '2026/2027' is left exactly as written.
      /\d/.test(before) && /\d/.test(after) ? whole : `${before} / ${after}`,
    )
    // A title that ends on the slash — 'End of First Semester/' — has no right-hand word for the rule above to
    // work from, and the second title line is what follows it.
    .replace(/(\S)\s*\/$/, '$1 /')
    .trim()
}

// Section headings and page furniture carry nothing an admin could act on, so skipping them is safe. The test that
// matters is the one below it: content is only ever skipped when it produces a warning.
function isNoise(flat) {
  if (NOISE.some((pattern) => pattern.test(flat))) return true
  const words = flat.split(' ').filter(Boolean)
  return words.length > 1 && !/\d/.test(flat) && words.every((word) => /[A-Z]/.test(word) && word === word.toUpperCase())
}

// A day key, or null if the parts do not make a day that exists. The round trip through the dates module is the
// check: fromDayKey('2027-02-30') is the 2nd of March, so February the 30th can never be mistaken for a real day.
function dayKey(year, month, day) {
  const key = `${year}-${pad2(month)}-${pad2(day)}`
  return toDayKey(fromDayKey(key)) === key ? key : null
}

// Returns a row, a `problem` explaining why not, or null when the line carries no date at all (which is the
// caller's cue to try folding it into the row above).
function readEntry(flat) {
  const undated = TO_BE_DETERMINED.exec(flat)
  if (undated) return { startsAt: null, endsAt: null, title: flat.slice(undated[0].length) }

  const start = DATE.exec(flat)
  if (!start) return null
  const from = { month: MONTH_NUMBER.get(start[1].toLowerCase()), day: Number(start[2]), year: start[3] ? Number(start[3]) : null }
  let rest = flat.slice(start[0].length)

  const dash = DASH_AFTER.exec(rest)
  if (dash) {
    const tail = rest.slice(dash[0].length)
    const end = DATE.exec(tail)
    const short = end ? null : SHORT_DATE.exec(tail)
    if (end) {
      const to = { month: MONTH_NUMBER.get(end[1].toLowerCase()), day: Number(end[2]), year: end[3] ? Number(end[3]) : null }
      return rangeRow(from, to, tail.slice(end[0].length))
    }
    if (short) {
      // The shortened end inherits the start's month: 'February 22 - 26, 2027' is the 22nd to the 26th of February.
      return rangeRow(from, { month: from.month, day: Number(short[1]), year: Number(short[2]) }, tail.slice(short[0].length))
    }
    return { problem: 'the range has no end date I can read' }
  }

  if (from.year === null) return { problem: 'the date has no year' }
  const startsAt = dayKey(from.year, from.month, from.day)
  if (!startsAt) return { problem: 'not a real calendar date' }
  return { startsAt, endsAt: null, title: rest }
}

function rangeRow(from, to, rest) {
  // Whichever end states the year lends it to the other. When both do, the range may cross a year, which is normal.
  const startYear = from.year ?? to.year
  const endYear = to.year ?? startYear
  if (startYear === null) return { problem: 'the dates have no year' }
  const startsAt = dayKey(startYear, from.month, from.day)
  const endsAt = dayKey(endYear, to.month, to.day)
  if (!startsAt || !endsAt) return { problem: 'not a real calendar date' }
  // Reported, never swapped: silently reordering the ends of a range turns an exam week into a fourteen-week
  // holiday, and a message the admin can read beats a guess they cannot see.
  if (endsAt < startsAt) return { problem: 'the range ends before it starts' }
  return { startsAt, endsAt, title: rest }
}

function failureReason(flat) {
  // "This looked like a date and is not one" is a more useful message than "no date here", which is what an admin
  // who mistyped October needs to hear.
  return WEEKDAY_HEAD.test(flat) || /\b\d{4}\b/.test(flat) ? 'the date could not be parsed' : 'no date found'
}

// Lifts a trailing '(2 weeks)' or '(4 weeks) (Lectures Continue)' off the end of a title and into the note. Done
// after the second title line is folded in as well, since the footnote can land on either.
function liftNote(title, carried) {
  const trailing = TRAILING_NOTE.exec(title)
  if (!trailing) return { title, note: carried || null }
  return {
    title: title.slice(0, trailing.index).trim(),
    note: [title.slice(trailing.index).trim(), carried].filter(Boolean).join(' ') || null,
  }
}

/**
 * Pasted calendar text in, reviewable rows and warnings out. Nothing is decided here that the text does not state:
 * no `kind`, no reminder lead time. `startsAt`/`endsAt` are 'YYYY-MM-DD' local day keys, or null for a date the
 * senate left open and for a single day that has no separate end.
 */
export function parseCalendarPaste(text, { session, semester = 1 } = {}) {
  const rows = []
  const warnings = []
  const term = semester === 2 ? 2 : 1
  const label = typeof session === 'string' ? session : ''

  for (const [index, line] of String(typeof text === 'string' ? text : '').split(/\r\n|\r|\n/).entries()) {
    const flat = flatten(line)
    if (!flat || isNoise(flat)) continue
    const at = index + 1
    const warn = (reason) => warnings.push({ line: at, text: line.trimEnd(), reason })

    try {
      // A bare parenthetical is a footnote to the entry above it, not a date of its own.
      if (NOTE_ONLY.test(flat)) {
        const previous = rows[rows.length - 1]
        if (!previous) {
          warn('a footnote with no entry above it')
        } else {
          previous.note = [previous.note, flat].filter(Boolean).join(' ')
        }
        continue
      }

      const entry = readEntry(flat)
      if (entry) {
        if (entry.problem) {
          warn(entry.problem)
          continue
        }
        const lifted = liftNote(tidyTitle(entry.title), null)
        // An entry with no title is not an entry: the calendar would show a date and nothing to read.
        if (!lifted.title) {
          warn('no title after the date')
          continue
        }
        rows.push({ title: lifted.title, startsAt: entry.startsAt, endsAt: entry.endsAt, note: lifted.note, semester: term, session: label })
        continue
      }

      // A title that runs onto the next line keeps its capital and has no date of its own. A line that opens with a
      // weekday never counts as one: 'Sunday, Mxrch 28, 2027 End of Registration' is a date the parser failed on,
      // and folding it into the entry above would swallow it — which is the one outcome this module must not have.
      if (rows.length && CONTINUATION.test(flat) && !WEEKDAY_HEAD.test(flat)) {
        const previous = rows[rows.length - 1]
        const joined = liftNote(tidyTitle(`${previous.title} ${flat}`), previous.note)
        previous.title = joined.title
        previous.note = joined.note
        continue
      }

      warn(failureReason(flat))
    } catch {
      warn('the line could not be read')
    }
  }

  return { rows, warnings }
}

function flatten(line) {
  return String(line).replace(DASHES, '-').replace(/\s+/g, ' ').trim()
}