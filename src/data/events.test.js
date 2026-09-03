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
    expect(upcoming.map((e) => e.id)).toEqual(['b', 'c', 'e'])
    expect(past.map((e) => e.id)).toEqual(['a', 'd'])
  })

  it('sorts upcoming events soonest-first', () => {
    const { upcoming } = groupEventsByTime(fixture, now)
    const dates = upcoming.filter((e) => e.id !== 'e').map((e) => new Date(e.date).getTime())
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

  it('treats an unparseable date as upcoming rather than dropping it', () => {
    const { upcoming, past } = groupEventsByTime(fixture, now)
    expect(upcoming.some((e) => e.id === 'e')).toBe(true)
    expect(past.some((e) => e.id === 'e')).toBe(false)
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
