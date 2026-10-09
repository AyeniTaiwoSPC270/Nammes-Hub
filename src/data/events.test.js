import { describe, it, expect } from 'vitest'
import { groupEventsByTime, getEventById } from './events'

const now = new Date('2026-06-15')

const fixture = [
  { id: 'a', title: 'Old workshop', date: '2026-01-10' },
  { id: 'b', title: 'Next seminar', date: '2026-07-01' },
  { id: 'c', title: 'Further out talk', date: '2026-09-20' },
  { id: 'd', title: 'Last year AGM', date: '2025-11-05' },
  { id: 'e', title: 'TBA meetup', date: 'TBA' },
]

describe('groupEventsByTime', () => {
  it('splits events into upcoming and past buckets', () => {
    const { upcoming, past } = groupEventsByTime(fixture, now)
    expect(upcoming.map((e) => e.id)).toEqual(['b', 'c'])
    expect(past.map((e) => e.id)).toEqual(['a', 'd'])
  })

  it('sorts upcoming events soonest-first', () => {
    const { upcoming } = groupEventsByTime(fixture, now)
    const dates = upcoming.map((e) => new Date(e.date).getTime())
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]).toBeGreaterThanOrEqual(dates[i - 1])
    }
  })

  it('sorts past events most-recent-first', () => {
    const { past } = groupEventsByTime(fixture, now)
    const dates = past.map((e) => new Date(e.date).getTime())
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]).toBeLessThanOrEqual(dates[i - 1])
    }
  })

  // Behaviour correction (spec §10.1). This test used to read "treats an unparseable date as upcoming rather
  // than dropping it", and it was pinning a bug: the old code sent anything it could not parse down the `else`
  // branch, so an event with `date = 'TBA'` stayed at the top of Home's upcoming list forever -- never becoming
  // past, never scrolling away. It is not dropped now either, it is bucketed as `tba` for the calendar's TBA
  // panel, which is where an undated senate row belongs. The assertion below is repointed deliberately, not
  // rewritten to fit: the old expectation and the fixed behaviour are mutually exclusive by design.
  it('buckets an event with no starts_at and no parseable date as TBA, not as upcoming', () => {
    const { upcoming, past, tba } = groupEventsByTime(fixture, now)
    expect(tba.map((e) => e.id)).toEqual(['e'])
    expect(upcoming.some((e) => e.id === 'e')).toBe(false)
    expect(past.some((e) => e.id === 'e')).toBe(false)
  })

  // `starts_at` wins over `date` (spec §2), so a row with a real timestamp is dated even when the free-text
  // column next to it is unreadable -- which is the normal state of a hand-typed date.
  it('uses starts_at when the legacy date cannot be parsed', () => {
    const rows = [{ id: 'g', title: 'Timed workshop', date: 'TBA', starts_at: '2026-07-20T09:00:00Z' }]
    const { upcoming, past, tba } = groupEventsByTime(rows, now)
    expect(upcoming.map((e) => e.id)).toEqual(['g'])
    expect(past).toEqual([])
    expect(tba).toEqual([])
  })

  // The fallback still works: a row written before the timestamp existed is dated off `date` alone.
  it('falls back to a parseable legacy date when starts_at is absent', () => {
    const rows = [{ id: 'h', title: 'Legacy seminar', date: '2026-08-01' }]
    const { upcoming, past, tba } = groupEventsByTime(rows, now)
    expect(upcoming.map((e) => e.id)).toEqual(['h'])
    expect(past).toEqual([])
    expect(tba).toEqual([])
  })

  it('buckets an event with neither column as TBA', () => {
    const rows = [{ id: 'i', title: 'Undated', date: null }]
    const { upcoming, past, tba } = groupEventsByTime(rows, now)
    expect(tba.map((e) => e.id)).toEqual(['i'])
    expect(upcoming).toEqual([])
    expect(past).toEqual([])
  })

  // A past `starts_at` beats a future `date`: the timestamp is the real column now.
  it('buckets by starts_at when the event has already happened', () => {
    const rows = [{ id: 'j', title: 'Already ran', date: '2027-01-01', starts_at: '2026-02-02T10:00:00Z' }]
    const { upcoming, past } = groupEventsByTime(rows, now)
    expect(past.map((e) => e.id)).toEqual(['j'])
    expect(upcoming).toEqual([])
  })

  it('does not mutate the input array', () => {
    const before = fixture.map((e) => e.id)
    groupEventsByTime(fixture, now)
    expect(fixture.map((e) => e.id)).toEqual(before)
  })

  it('parses ordinal-suffixed dates like "3rd August 2026" so they bucket correctly', () => {
    const laterNow = new Date('2026-09-03')
    const ordinalFixture = [{ id: 'f', title: 'Materials Horizon 3.0', date: '3rd August 2026' }]
    const { upcoming, past } = groupEventsByTime(ordinalFixture, laterNow)
    expect(past.map((e) => e.id)).toEqual(['f'])
    expect(upcoming).toEqual([])
  })
})

describe('getEventById', () => {
  it('finds an event by id', () => {
    expect(getEventById(fixture, 'b').title).toBe('Next seminar')
  })
  it('returns undefined for an unknown id', () => {
    expect(getEventById(fixture, 'does-not-exist')).toBeUndefined()
  })
})
