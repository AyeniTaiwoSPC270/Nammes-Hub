import { describe, it, expect } from 'vitest'
import { splitFeaturedExcos } from './excos'

describe('splitFeaturedExcos', () => {
  it('splits the first 3 into featured by default', () => {
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]
    const { featured, rest } = splitFeaturedExcos(rows)
    expect(featured).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
    expect(rest).toEqual([{ id: 4 }, { id: 5 }])
  })

  it('puts everything in featured when there are fewer rows than the count', () => {
    const rows = [{ id: 1 }, { id: 2 }]
    const { featured, rest } = splitFeaturedExcos(rows)
    expect(featured).toEqual([{ id: 1 }, { id: 2 }])
    expect(rest).toEqual([])
  })

  it('handles an empty or undefined list', () => {
    expect(splitFeaturedExcos([])).toEqual({ featured: [], rest: [] })
    expect(splitFeaturedExcos(undefined)).toEqual({ featured: [], rest: [] })
  })

  it('respects a custom featuredCount', () => {
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }]
    const { featured, rest } = splitFeaturedExcos(rows, 1)
    expect(featured).toEqual([{ id: 1 }])
    expect(rest).toEqual([{ id: 2 }, { id: 3 }])
  })
})
