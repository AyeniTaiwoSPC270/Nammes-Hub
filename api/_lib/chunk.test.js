import { describe, it, expect } from 'vitest'
import { chunk } from './chunk.js'

describe('chunk', () => {
  it('splits an array into groups of the given size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
  it('returns one group when the array is smaller than the size', () => {
    expect(chunk(['a', 'b'], 100)).toEqual([['a', 'b']])
  })
  it('returns an empty array for an empty input', () => {
    expect(chunk([], 10)).toEqual([])
  })
})
