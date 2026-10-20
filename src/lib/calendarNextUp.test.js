import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { selectNextUp } from './calendarNextUp.js'

// The rule used to live inline in Calendar.jsx and again in AdminCalendarDesign.jsx. Home makes three, so it moved
// here: one place for "what is next", and one place a test can pin it down.

const TODAY = '2026-10-19'
const item = (id, startsAt, endsAt = startsAt) => ({ id, startsAt, endsAt })

describe('selectNextUp', () => {
  it('keeps what is still running or still to come, in merge order', () => {
    const items = [item('now', '2026-10-17', '2026-10-25'), item('soon', '2026-10-22'), item('later', '2026-11-01')]
    expect(selectNextUp(items, TODAY).map((one) => one.id)).toEqual(['now', 'soon', 'later'])
  })

  it('keeps an item that ends today and drops one that ended yesterday', () => {
    // A block whose last day is today is still happening; the day after is history.
    const items = [item('yesterday', '2026-10-15', '2026-10-18'), item('today', '2026-10-10', TODAY)]
    expect(selectNextUp(items, TODAY).map((one) => one.id)).toEqual(['today'])
  })

  it('applies the limit after filtering, so ended items do not spend it', () => {
    const items = [item('old', '2026-10-01'), item('a', '2026-10-20'), item('b', '2026-10-21'), item('c', '2026-10-22')]
    expect(selectNextUp(items, TODAY, { limit: 2 }).map((one) => one.id)).toEqual(['a', 'b'])
  })

  it('returns nothing when the caller has not switched the strip on', () => {
    expect(selectNextUp([item('a', '2026-10-20')], TODAY, { enabled: false })).toEqual([])
  })
})

// Source scans, in the style of playSeatResume.test.js. A pure test cannot prove two conditions are both wired into a
// page, and a missing one is exactly the failure mode: a strip that ignores the kill switch, or a request nobody
// opted into.
const home = readFileSync('src/pages/Home.jsx', 'utf8').replace(/\r\n/g, '\n')
const calendar = readFileSync('src/pages/Calendar.jsx', 'utf8').replace(/\r\n/g, '\n')
const studio = readFileSync('src/pages/admin/AdminCalendarDesign.jsx', 'utf8').replace(/\r\n/g, '\n')
const calendarData = readFileSync('src/data/calendar.js', 'utf8').replace(/\r\n/g, '\n')

describe('Home renders the calendar strip through the shared components', () => {
  it('imports NextUpStrip and mergeCalendarSources rather than copying either', () => {
    expect(home).toContain("from '../components/calendar/NextUpStrip'")
    expect(home).toContain("from '../../api/_lib/calendarMerge.js'")
    // A second card renderer is the regression the content studio already paid for once.
    expect(home).not.toContain('--cal-')
  })

  it('requires both the kill switch and the per-block opt-in', () => {
    expect(home).toContain('useCalendarFlag()')
    expect(home).toMatch(/showNextUp = calendarEnabled && Boolean\(calendarSettingsQuery\.data\?\.next_up_on_home\)/)
  })

  it('passes enabled to the academic query, so an opt-out visitor issues no request', () => {
    expect(home).toMatch(/useAcademicCalendarQuery\([^)]*showNextUp\)/)
  })

  it('adds the setting to the save allow-list', () => {
    // A field missing from SETTINGS_FIELDS is dropped by cleanPatch, so the toggle would look saved and change nothing.
    expect(calendarData).toMatch(/SETTINGS_FIELDS = \[[\s\S]*?'next_up_on_home'[\s\S]*?\]/)
  })

  it('leaves /calendar and the studio on the same rule', () => {
    expect(calendar).toContain('selectNextUp(')
    expect(studio).toContain('selectNextUp(')
  })
})
