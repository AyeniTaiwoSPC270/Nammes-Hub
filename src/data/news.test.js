import { describe, it, expect } from 'vitest'
import { getNews, getNewsById, filterNewsByCategory, NEWS_CATEGORIES } from './news'

const fixture = [
  { id: 'a', category: 'Academics', date: 'Jul 20, 2026', title: 'A' },
  { id: 'b', category: 'Welfare', date: 'Jul 15, 2026', title: 'B' },
  { id: 'c', category: 'Academics', date: 'Jul 25, 2026', title: 'C' },
]

describe('getNewsById', () => {
  it('finds a news item by id', () => {
    expect(getNewsById(fixture, 'b').title).toBe('B')
  })
  it('returns undefined for an unknown id', () => {
    expect(getNewsById(fixture, 'does-not-exist')).toBeUndefined()
  })
})

describe('getNews', () => {
  it('returns items in descending date order', () => {
    const result = getNews(fixture)
    const dates = result.map((n) => new Date(n.date).getTime())
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]).toBeLessThanOrEqual(dates[i - 1])
    }
  })
  it('does not mutate the input array', () => {
    const before = fixture.map((n) => n.id)
    getNews(fixture)
    expect(fixture.map((n) => n.id)).toEqual(before)
  })
})

describe('news data integrity', () => {
  it('every fixture item has a category in NEWS_CATEGORIES', () => {
    fixture.forEach((item) => {
      expect(NEWS_CATEGORIES).toContain(item.category)
    })
  })
})

describe('filterNewsByCategory', () => {
  it('filters the list down to a single category', () => {
    const result = filterNewsByCategory(fixture, 'Welfare')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('b')
  })
  it('returns the full list for "All"', () => {
    expect(filterNewsByCategory(fixture, 'All')).toEqual(fixture)
  })
  it('returns the full list when no category is given', () => {
    expect(filterNewsByCategory(fixture, undefined)).toEqual(fixture)
  })
  it('returns the full list for an unrecognized category instead of an empty result', () => {
    expect(filterNewsByCategory(fixture, 'Bogus')).toEqual(fixture)
  })
})
