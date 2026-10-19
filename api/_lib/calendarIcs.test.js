import { describe, expect, it } from 'vitest'
import { buildCalendarIcs } from './calendarIcs.js'

// The format rules are the feature: a client that accepts the file is the only thing that makes subscribing work.
// Every fixture is built with a fixed `now`, because DTSTAMP is the one value that would otherwise make the output
// change between two identical runs.

const NOW = new Date('2026-10-19T12:00:00Z')

const unfold = (text) => text.replace(/\r\n /g, '')
const linesOf = (text) => unfold(text).split('\r\n')

const build = (rows) => buildCalendarIcs(rows, { now: NOW })

const senate = (overrides = {}) => ({
  id: 'sen-1',
  title: 'Second semester examinations',
  kind: 'exams',
  starts_at: '2026-10-05',
  ends_at: '2026-10-07',
  note: 'Bring your matriculation number.',
  updated_at: '2026-10-01T08:30:00Z',
  ...overrides,
})

const event = (overrides = {}) => ({
  id: 'evt-1',
  title: 'Departmental seminar',
  description: 'A talk.',
  meta: 'Main Auditorium',
  starts_at: '2026-10-05T09:00:00Z',
  ends_at: '2026-10-05T11:00:00Z',
  ...overrides,
})

describe('buildCalendarIcs', () => {
  it('keeps a senate date as the day string it was stored as', () => {
    const lines = linesOf(build({ academic: [senate()] }))
    expect(lines).toContain('DTSTART;VALUE=DATE:20261005')
    // No time and no Z: constructing a Date for a `date` column is how a day lands on the wrong side of midnight.
    const dtstart = lines.find((line) => line.startsWith('DTSTART'))
    expect(dtstart).not.toMatch(/T\d{6}/)
    expect(dtstart).not.toContain('Z')
  })

  it('omits a TBA row but still returns a valid calendar', () => {
    const text = build({ academic: [senate({ id: 'tba', starts_at: null })] })
    expect(text).toContain('BEGIN:VCALENDAR')
    expect(text).toContain('END:VCALENDAR')
    expect(text).not.toContain('BEGIN:VEVENT')
  })

  it('makes a multi-day DTEND exclusive', () => {
    // DTEND is exclusive in RFC 5545: a seminar on the 5th-7th ends on the 8th.
    const lines = linesOf(build({ academic: [senate()] }))
    expect(lines).toContain('DTEND;VALUE=DATE:20261008')
  })

  it('gives a single-day row the next day as its explicit end', () => {
    const lines = linesOf(build({ academic: [senate({ starts_at: '2026-10-05', ends_at: '2026-10-05' })] }))
    expect(lines).toContain('DTEND;VALUE=DATE:20261006')
  })

  it('writes a timed event in UTC, with its end or start plus one hour', () => {
    const withEnd = linesOf(build({ events: [event()] }))
    expect(withEnd).toContain('DTSTART:20261005T090000Z')
    expect(withEnd).toContain('DTEND:20261005T110000Z')

    const withoutEnd = linesOf(build({ events: [event({ ends_at: null })] }))
    expect(withoutEnd).toContain('DTEND:20261005T100000Z')
  })

  it('reads a legacy free-text date through the same parser the page uses', () => {
    const lines = linesOf(build({ events: [event({ starts_at: null, ends_at: null, date: '3rd August 2026' })] }))
    expect(lines).toContain('DTSTART;VALUE=DATE:20260803')
    expect(lines).toContain('DTEND;VALUE=DATE:20260804')
  })

  it('escapes comma, semicolon, backslash and newline in one SUMMARY line', () => {
    const title = 'Matriculation, Main Auditorium; C:\\room\nline 2'
    const lines = linesOf(build({ academic: [senate({ title })] }))
    expect(lines).toContain('SUMMARY:Matriculation\\, Main Auditorium\\; C:\\\\room\\nline 2')
  })

  it('folds at 75 octets without splitting a multi-byte character', () => {
    const title = 'é'.repeat(200)
    const text = build({ academic: [senate({ title })] })
    const physical = text.split('\r\n')
    const continuing = physical.filter((line) => line.startsWith(' '))
    expect(continuing.length).toBeGreaterThan(0)
    for (const line of physical) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    // Unfolding must give the property back exactly, which is the proof that no character was cut in half.
    expect(linesOf(text)).toContain(`SUMMARY:${title}`)
  })

  it('gives the same rows the same UIDs on every build', () => {
    const first = linesOf(build({ academic: [senate()], events: [event()] }))
    const second = linesOf(buildCalendarIcs({ academic: [senate()], events: [event()] }, { now: new Date('2027-01-01T00:00:00Z') }))
    const uids = (lines) => lines.filter((line) => line.startsWith('UID:'))
    expect(uids(first)).toEqual(uids(second))
    expect(uids(first)).toEqual([
      'UID:academic-sen-1@nammeshub.com.ng',
      'UID:event-evt-1@nammeshub.com.ng',
    ])
  })

  it('uses CRLF everywhere and ends on END:VCALENDAR', () => {
    const text = build({ academic: [senate()], events: [event()] })
    expect(text.endsWith('END:VCALENDAR\r\n')).toBe(true)
    // Strip the valid pairs; a bare LF left behind is a line some client will reject.
    expect(text.replace(/\r\n/g, '')).not.toContain('\n')
  })

  it('returns a valid empty calendar rather than an empty string', () => {
    const text = build({})
    expect(text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(text).toContain('VERSION:2.0')
    expect(text).not.toContain('BEGIN:VEVENT')
  })
})
