import { describe, it, expect } from 'vitest'
import { news, getNewsById, filterNewsByCategory } from './news'

describe('getNewsById', () => {
  it('finds a news item by id', () => {
    const item = getNewsById('dangote-site-visit')
    expect(item.title).toBe('Site Visit to Dangote Cement Slated for August')
  })

  it('returns undefined for an unknown id', () => {
    expect(getNewsById('does-not-exist')).toBeUndefined()
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
