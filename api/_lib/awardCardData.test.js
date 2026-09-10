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
