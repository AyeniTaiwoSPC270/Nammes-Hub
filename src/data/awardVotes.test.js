import { describe, it, expect } from 'vitest'
import { buildTallyFromCounts, sumVotes } from './awardVotes'

describe('buildTallyFromCounts', () => {
  const nominees = [
    { id: 'a', name: 'Ada' },
    { id: 'b', name: 'Bola' },
  ]

  it('maps aggregate rows to nominee tallies sorted by count, highest first', () => {
    const rows = [
      { category_id: 'c1', nominee_id: 'a', votes: 2 },
      { category_id: 'c1', nominee_id: 'b', votes: 5 },
    ]
    expect(buildTallyFromCounts(rows, nominees)).toEqual([
      { nominee: nominees[1], count: 5 },
      { nominee: nominees[0], count: 2 },
    ])
  })

  it('gives a nominee with no row a count of 0, not undefined', () => {
    const rows = [{ category_id: 'c1', nominee_id: 'a', votes: 3 }]
    expect(buildTallyFromCounts(rows, nominees)).toEqual([
      { nominee: nominees[0], count: 3 },
      { nominee: nominees[1], count: 0 },
    ])
  })

  it('accepts counts delivered as strings (bigint from the database)', () => {
    const rows = [{ category_id: 'c1', nominee_id: 'a', votes: '7' }]
    expect(buildTallyFromCounts(rows, nominees)[0]).toEqual({ nominee: nominees[0], count: 7 })
  })

  it('ignores rows for nominees that are not in this category', () => {
    const rows = [{ category_id: 'c2', nominee_id: 'zzz', votes: 9 }]
    expect(buildTallyFromCounts(rows, nominees).map((t) => t.count)).toEqual([0, 0])
  })
})

describe('sumVotes', () => {
  it('adds up votes across all rows', () => {
    expect(sumVotes([{ votes: 2 }, { votes: '3' }, { votes: 1 }])).toBe(6)
  })
  it('is 0 for no rows', () => {
    expect(sumVotes([])).toBe(0)
  })
})
