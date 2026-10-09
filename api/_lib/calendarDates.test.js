import { describe, it, expect } from 'vitest'
import { toDayKey, fromDayKey, isSameDay, addDays, addMonths, eachDay, rangesOverlap, monthGrid } from './calendarDates.js'

// Every date in this file is built from explicit components. Nothing here parses a date string, so the
// assertions do not depend on the machine's UTC offset.
//
// That property cuts both ways and the offset tests at the bottom of this file exist because of it: an
// offset-*agnostic* suite is also offset-*blind*, and one built this way passes unchanged if fromDayKey
// regresses to `new Date(key)`. Under UTC — and under Nigeria, where this app is written and developed —
// a UTC-midnight parse reads back as the right day anyway, so only a forced negative offset catches it.
const d = (year, monthIndex, day) => new Date(year, monthIndex, day)
const keys = (dates) => dates.map(toDayKey)

// Mutating process.env.TZ inside a test moves V8's offset for code that runs afterwards, which is the only
// way to prove the guards below are real rather than incidental to this machine being in UTC+1.
const ZONES = ['America/New_York', 'Pacific/Kiritimati', 'UTC', 'Africa/Lagos']
const inZone = (tz, fn) => {
  const original = process.env.TZ
  try {
    process.env.TZ = tz
    return fn()
  } finally {
    process.env.TZ = original
  }
}

describe('toDayKey and fromDayKey', () => {
  it('round-trips a local day', () => {
    for (const [year, monthIndex, day] of [[2026, 9, 5], [2026, 0, 1], [2027, 11, 31], [2028, 1, 29]]) {
      expect(toDayKey(fromDayKey(toDayKey(d(year, monthIndex, day))))).toBe(toDayKey(d(year, monthIndex, day)))
    }
  })
  it('keeps the day it was given, rather than the day before it', () => {
    expect(toDayKey(d(2026, 9, 5))).toBe('2026-10-05')
    expect(toDayKey(fromDayKey('2026-10-05'))).toBe('2026-10-05')
    // A UTC-midnight parse would give 2026-10-04 here at any negative offset.
    expect(fromDayKey('2026-10-05').getDate()).toBe(5)
    expect(fromDayKey('2026-10-05').getMonth()).toBe(9)
    expect(fromDayKey('2026-10-05').getFullYear()).toBe(2026)
    // ... and the instant it builds must still be that same local wall-clock day.
    expect(toDayKey(new Date(2026, 9, 5))).toBe('2026-10-05')
  })
  it('zero-pads single-digit months and days', () => {
    expect(toDayKey(d(2027, 0, 1))).toBe('2027-01-01')
    expect(toDayKey(d(2026, 8, 9))).toBe('2026-09-09')
    expect(toDayKey(d(2026, 11, 5))).toBe('2026-12-05')
    expect(fromDayKey('2027-01-01').getDate()).toBe(1)
  })
})

describe('isSameDay', () => {
  it('ignores the time of day', () => {
    expect(isSameDay(d(2026, 9, 5), d(2026, 9, 5))).toBe(true)
    expect(isSameDay(new Date(2026, 9, 5, 0, 0), new Date(2026, 9, 5, 23, 59))).toBe(true)
    expect(isSameDay(d(2026, 9, 5), d(2026, 9, 6))).toBe(false)
    expect(isSameDay(d(2026, 9, 5), d(2027, 9, 5))).toBe(false)
  })
})

describe('addDays', () => {
  it('does not mutate the date it is given', () => {
    const from = d(2026, 9, 5)
    addDays(from, 3)
    expect(toDayKey(from)).toBe('2026-10-05')
  })
  it('crosses month and year boundaries', () => {
    expect(toDayKey(addDays(d(2026, 9, 30), 2))).toBe('2026-11-01')
    expect(toDayKey(addDays(d(2026, 11, 31), 1))).toBe('2027-01-01')
    expect(toDayKey(addDays(d(2027, 0, 1), -1))).toBe('2026-12-31')
  })
  it('steps across a leap day', () => {
    expect(toDayKey(addDays(d(2028, 1, 28), 1))).toBe('2028-02-29')
    expect(toDayKey(addDays(d(2028, 1, 29), 1))).toBe('2028-03-01')
    // 2027 is not a leap year, so the day after the 28th is the 1st of March.
    expect(toDayKey(addDays(d(2027, 1, 28), 1))).toBe('2027-03-01')
  })
})

describe('addMonths', () => {
  it('clamps to the end of a shorter month instead of spilling into the next one', () => {
    expect(toDayKey(addMonths(d(2026, 0, 31), 1))).toBe('2026-02-28')
    expect(toDayKey(addMonths(d(2028, 0, 31), 1))).toBe('2028-02-29') // February has 29 days in 2028
    expect(toDayKey(addMonths(d(2026, 0, 31), 2))).toBe('2026-03-31')
    expect(toDayKey(addMonths(d(2026, 2, 31), 1))).toBe('2026-04-30')
  })
  it('goes backwards as well as forwards, and across a year boundary', () => {
    expect(toDayKey(addMonths(d(2026, 2, 15), -2))).toBe('2026-01-15')
    expect(toDayKey(addMonths(d(2026, 0, 15), -1))).toBe('2025-12-15')
    expect(toDayKey(addMonths(d(2026, 11, 15), 1))).toBe('2027-01-15')
    expect(toDayKey(addMonths(d(2026, 6, 15), 12))).toBe('2027-07-15')
  })
  it('leaves a day that fits alone', () => {
    expect(toDayKey(addMonths(d(2026, 0, 5), 1))).toBe('2026-02-05')
    expect(addMonths(d(2026, 0, 5), 1)).toEqual(d(2026, 1, 5))
  })
})

describe('eachDay', () => {
  it('includes both ends', () => {
    expect(keys(eachDay(d(2026, 9, 5), d(2026, 9, 9)))).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'])
  })
  it('is a single day when both ends are the same', () => {
    expect(keys(eachDay(d(2026, 9, 5), d(2026, 9, 5)))).toEqual(['2026-10-05'])
  })
  it('is empty when the range is reversed', () => {
    expect(eachDay(d(2026, 9, 9), d(2026, 9, 5))).toEqual([])
    expect(eachDay(d(2026, 9, 5), d(2026, 9, 4))).toEqual([])
  })
  it('spans a month boundary', () => {
    expect(keys(eachDay(d(2026, 1, 27), d(2026, 2, 2)))).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02'])
  })
})

describe('rangesOverlap', () => {
  const range = (aFrom, aTo, bFrom, bTo) => rangesOverlap(d(...aFrom), d(...aTo), d(...bFrom), d(...bTo))
  const oct = (day) => [2026, 9, day]

  it('is true for identical and partially overlapping ranges', () => {
    expect(range(oct(5), oct(9), oct(5), oct(9))).toBe(true)
    expect(range(oct(5), oct(9), oct(7), oct(12))).toBe(true)
    expect(range(oct(7), oct(12), oct(5), oct(9))).toBe(true)
  })
  it('is true when one range sits inside the other', () => {
    expect(range(oct(1), oct(28), oct(5), oct(9))).toBe(true)
    expect(range(oct(5), oct(9), oct(1), oct(28))).toBe(true)
    expect(range(oct(5), oct(9), oct(5), oct(9))).toBe(true)
  })
  it('is false for ranges that merely touch, so they cannot both claim the day between them', () => {
    expect(range(oct(5), oct(9), oct(10), oct(14))).toBe(false)
    expect(range(oct(10), oct(14), oct(5), oct(9))).toBe(false)
    expect(range(oct(5), oct(9), oct(9), oct(14))).toBe(false)
  })
  it('is false for disjoint ranges', () => {
    expect(range(oct(5), oct(9), oct(20), oct(25))).toBe(false)
    expect(range(oct(20), oct(25), oct(5), oct(9))).toBe(false)
  })
  it('is symmetric', () => {
    const a = [d(2026, 9, 1), d(2026, 9, 20)]
    const b = [d(2026, 9, 10), d(2026, 9, 30)]
    expect(rangesOverlap(a[0], a[1], b[0], b[1])).toBe(rangesOverlap(b[0], b[1], a[0], a[1]))
  })
})

describe('monthGrid', () => {
  const flatten = (grid) => grid.flat()
  const weeks = (grid) => grid.flatMap((week) => week.map(toDayKey))

  it('is always whole weeks, and every week has seven days', () => {
    for (let year = 2026; year <= 2030; year++) {
      for (let month = 0; month < 12; month++) {
        for (const weekStart of [0, 1]) {
          const grid = monthGrid(year, month, { weekStart })
          expect(grid.every((week) => week.length === 7)).toBe(true)
          expect(flatten(grid).length % 7).toBe(0)
        }
      }
    }
  })

  it('starts every week on the day the calendar says it does', () => {
    // October 2026 starts on a Thursday: the Monday grid opens on the 28th of September, the Sunday one on the 27th.
    expect(toDayKey(monthGrid(2026, 9, { weekStart: 1 })[0][0])).toBe('2026-09-28')
    expect(toDayKey(monthGrid(2026, 9, { weekStart: 0 })[0][0])).toBe('2026-09-27')
    for (const weekStart of [0, 1]) {
      const grid = monthGrid(2026, 9, { weekStart })
      expect(grid[0][0].getDay()).toBe(weekStart)
      expect(weeks(grid).every((key, i) => key === toDayKey(addDays(grid[0][0], i)))).toBe(true) // no gaps or repeats
    }
    // February 2027 starts on a Monday, so a Monday grid needs no leading padding at all.
    expect(toDayKey(monthGrid(2027, 1, { weekStart: 1 })[0][0])).toBe('2027-02-01')
    expect(toDayKey(monthGrid(2027, 1, { weekStart: 0 })[0][0])).toBe('2027-01-31')
  })

  it('defaults to Monday when no week start is given', () => {
    expect(toDayKey(monthGrid(2026, 9)[0][0])).toBe('2026-09-28')
    expect(toDayKey(monthGrid(2026, 9, {})[0][0])).toBe('2026-09-28')
  })

  it('pads the first and last weeks and holds the whole month', () => {
    const flat = flatten(monthGrid(2026, 9, { weekStart: 1 }))
    expect(toDayKey(flat[0])).toBe('2026-09-28') // leading days from September
    expect(toDayKey(flat[flat.length - 1])).toBe('2026-11-01') // trailing days from November
    expect(flat.filter((day) => day.getMonth() === 9)).toHaveLength(31)
    expect(toDayKey(flat.find((day) => day.getMonth() === 9 && day.getDate() === 1))).toBe('2026-10-01')
    expect(toDayKey(flat.find((day) => day.getMonth() === 9 && day.getDate() === 31))).toBe('2026-10-31')
  })

  it('is four weeks for a 28-day month that starts on a Monday, six for a month that needs them', () => {
    expect(monthGrid(2027, 1, { weekStart: 1 })).toHaveLength(4)
    expect(monthGrid(2027, 1, { weekStart: 1 }).flat()).toHaveLength(28)
    // March 2026 starts on a Sunday and has 31 days, so a Monday grid needs two weeks of padding and runs to six.
    expect(monthGrid(2026, 2, { weekStart: 1 })).toHaveLength(6)
    expect(monthGrid(2026, 2, { weekStart: 1 }).flat()).toHaveLength(42)
    expect(toDayKey(monthGrid(2026, 2, { weekStart: 1 })[0][0])).toBe('2026-02-23')
  })

  it('handles a leap February and an ordinary one', () => {
    const leapGrid = monthGrid(2028, 1, { weekStart: 1 })
    const leap = flatten(leapGrid)
    expect(leap.filter((day) => day.getMonth() === 1)).toHaveLength(29)
    expect(weeks(leapGrid)).toContain('2028-02-29')
    expect(toDayKey(leap[leap.length - 1])).toBe('2028-03-05')

    const ordinaryGrid = monthGrid(2027, 1, { weekStart: 1 })
    const ordinary = flatten(ordinaryGrid)
    expect(ordinary.filter((day) => day.getMonth() === 1)).toHaveLength(28)
    expect(weeks(ordinaryGrid)).not.toContain('2027-02-29')
    expect(toDayKey(ordinary[ordinary.length - 1])).toBe('2027-02-28')
  })
})

// These two describe blocks are the ones that fail if the timezone safety regresses. Everything above
// happens to hold at UTC+1 as well as at UTC, so on their own they would not notice.
describe('timezone safety', () => {
  it('reads a day key back as the same day at any offset', () => {
    for (const tz of ZONES) {
      inZone(tz, () => {
        expect(toDayKey(fromDayKey('2026-10-05'))).toBe('2026-10-05')
        expect(toDayKey(fromDayKey('2027-01-01'))).toBe('2027-01-01')
        expect(fromDayKey('2026-10-05').getDate()).toBe(5)
      })
    }
  })

  it('writes the local day as the key at any offset, rather than the UTC one', () => {
    // 23:30 local on the 5th is already the 6th in UTC, so a toISOString implementation leaks a day
    // eastward and loses one westward.
    for (const tz of ZONES) {
      inZone(tz, () => {
        expect(toDayKey(new Date(2026, 9, 5, 23, 30))).toBe('2026-10-05')
        expect(toDayKey(new Date(2026, 9, 5, 0, 30))).toBe('2026-10-05')
      })
    }
  })

  it('keeps a month grid intact across every offset', () => {
    for (const tz of ZONES) {
      inZone(tz, () => {
        const grid = monthGrid(2026, 9, { weekStart: 1 }).flat()
        expect(grid).toHaveLength(35)
        expect(toDayKey(grid[0])).toBe('2026-09-28')
        expect(toDayKey(grid[34])).toBe('2026-11-01')
        expect(keys(grid)).toEqual([...keys(grid)].sort())
      })
    }
  })
})

describe('daylight saving transitions', () => {
  // Havana, Beirut and Santiago all spring forward at local midnight, which is the case that breaks an
  // instant-based loop: the cursor keeps a wall clock one hour ahead of a `to` built at 00:00, so the
  // final day of the range gets dropped.
  const MIDNIGHT_DST_ZONES = ['America/Havana', 'Asia/Beirut', 'America/Santiago']

  it('eachDay reaches the last day of a range that spans a midnight DST change', () => {
    for (const tz of MIDNIGHT_DST_ZONES) {
      inZone(tz, () => {
        const days = eachDay(d(2026, 1, 20), d(2026, 2, 10))
        expect(keys(days)).toHaveLength(19)
        expect(toDayKey(days[days.length - 1])).toBe('2026-03-10')
        expect(toDayKey(days[0])).toBe('2026-02-20')
      })
    }
  })

  it('eachDay still ends exactly on its bound outside a transition', () => {
    inZone('America/Havana', () => {
      const days = eachDay(d(2026, 5, 1), d(2026, 5, 30))
      expect(toDayKey(days[days.length - 1])).toBe('2026-06-30')
    })
  })

  it('addDays lands on the right day across a transition, even though local midnight is skipped', () => {
    inZone('America/Havana', () => {
      // Cuba springs forward at 00:00, so 00:00 does not exist on 2026-03-08 and Date normalises it to 01:00.
      // What has to hold is the day, not the hour: a calendar that counted hours here would be wrong.
      const next = addDays(d(2026, 2, 7), 1)
      expect(toDayKey(next)).toBe('2026-03-08')
      expect(next.getHours()).toBeLessThanOrEqual(1)
    })
  })
})