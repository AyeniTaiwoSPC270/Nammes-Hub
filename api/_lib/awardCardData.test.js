import { describe, it, expect } from 'vitest'
import { determineWinner } from './awardCardData.js'

describe('determineWinner', () => {
  it('returns the nominee with the most votes', () => {
    const nominees = [
      { id: 'a', name: 'Ada' },
      { id: 'b', name: 'Bola' },
    ]
    const votes = [{ nominee_id: 'a' }, { nominee_id: 'a' }, { nominee_id: 'b' }]
    expect(determineWinner(votes, nominees)).toEqual({ nominee: nominees[0], count: 2 })
  })
  it('breaks ties by nominee array order', () => {
    const nominees = [
      { id: 'a', name: 'Ada' },
      { id: 'b', name: 'Bola' },
    ]
    const votes = [{ nominee_id: 'a' }, { nominee_id: 'b' }]
    expect(determineWinner(votes, nominees)).toEqual({ nominee: nominees[0], count: 1 })
  })
  it('returns null when there are no nominees', () => {
    expect(determineWinner([], [])).toBeNull()
  })
  it('returns null when no nominee has any votes', () => {
    const nominees = [{ id: 'a', name: 'Ada' }]
    expect(determineWinner([], nominees)).toBeNull()
  })
})

import { determineWinnerFromCounts } from './awardCardData.js'

describe('determineWinnerFromCounts', () => {
  const nominees = [
    { id: 'a', name: 'Ada' },
    { id: 'b', name: 'Bola' },
  ]
  it('picks the nominee with the highest aggregate count in this category only', () => {
    const rows = [
      { category_id: 'c1', nominee_id: 'a', votes: '2' },
      { category_id: 'c1', nominee_id: 'b', votes: 5 },
      { category_id: 'c2', nominee_id: 'a', votes: 99 },
    ]
    expect(determineWinnerFromCounts(rows, nominees, 'c1')).toEqual({ nominee: nominees[1], count: 5 })
  })
  it('returns null when nobody has votes', () => {
    expect(determineWinnerFromCounts([], nominees, 'c1')).toBeNull()
  })
})
