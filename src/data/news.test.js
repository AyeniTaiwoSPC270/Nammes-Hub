import { describe, it, expect } from 'vitest'
import { news, getNews, getNewsById, filterNewsByCategory, NEWS_CATEGORIES } from './news'

describe('getNewsById', () => {
  it('finds a news item by id', () => {
    const item = getNewsById('dangote-site-visit')
    expect(item.title).toBe('Site Visit to Dangote Cement Slated for August')
  })

  it('returns undefined for an unknown id', () => {
    expect(getNewsById('does-not-exist')).toBeUndefined()
  })
})

describe('getNews', () => {
  it('returns items in descending date order', () => {
    const result = getNews()
    const dates = result.map((n) => new Date(n.date).getTime())
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]).toBeLessThanOrEqual(dates[i - 1])
    }
  })

  it('does not mutate the original news array', () => {
    const before = news.map((n) => n.id)
    getNews()
    expect(news.map((n) => n.id)).toEqual(before)
  })
})

describe('news data integrity', () => {
  it('every item has a category in NEWS_CATEGORIES', () => {
    news.forEach((item) => {
      expect(NEWS_CATEGORIES).toContain(item.category)
    })
  })
})

describe('filterNewsByCategory', () => {
  it('filters the list down to a single category', () => {
    const result = filterNewsByCategory(news, 'Welfare')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('textbook-donation-drive')
  })

  it('returns the full list for "All"', () => {
    expect(filterNewsByCategory(news, 'All')).toEqual(news)
  })

  it('returns the full list when no category is given', () => {
    expect(filterNewsByCategory(news, undefined)).toEqual(news)
  })

  it('returns the full list for an unrecognized category instead of an empty result', () => {
    expect(filterNewsByCategory(news, 'Bogus')).toEqual(news)
  })
})
