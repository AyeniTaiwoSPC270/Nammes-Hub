import { describe, it, expect } from 'vitest'
import { buildTally } from './awardVotes'

describe('buildTally', () => {
  it('counts votes per nominee and sorts descending', () => {
    const nominees = [
      { id: 'a', name: 'Ada' },
      { id: 'b', name: 'Bola' },
    ]
    const votes = [
      { nominee_id: 'a' },
      { nominee_id: 'a' },
      { nominee_id: 'b' },
    ]
    const tally = buildTally(votes, nominees)
    expect(tally).toEqual([
      { nominee: nominees[0], count: 2 },
      { nominee: nominees[1], count: 1 },
    ])
  })
  it('gives a zero-vote nominee a count of 0, not undefined', () => {
    const nominees = [{ id: 'a', name: 'Ada' }]
    expect(buildTally([], nominees)).toEqual([{ nominee: nominees[0], count: 0 }])
  })
})
