import { describe, it, expect } from 'vitest'
import { getOpportunities } from './opportunities'

const fixture = [
  { id: 'mtn-foundation-scholarship', deadline: 'Sep 30, 2026' },
  { id: 'dangote-industrial-internship', deadline: 'Aug 15, 2026' },
  { id: 'petan-undergraduate-scholarship', deadline: 'Oct 20, 2026' },
  { id: 'nlng-siwes-internship', deadline: 'Jul 31, 2026' },
]

describe('getOpportunities', () => {
  it('sorts opportunities by soonest deadline first', () => {
    const result = getOpportunities(fixture)
    const deadlines = result.map((o) => new Date(o.deadline).getTime())
    for (let i = 1; i < deadlines.length; i++) {
      expect(deadlines[i]).toBeGreaterThanOrEqual(deadlines[i - 1])
    }
    expect(result[0].id).toBe('nlng-siwes-internship')
  })

  it('does not mutate the input array', () => {
    const before = fixture.map((o) => o.id)
    getOpportunities(fixture)
    expect(fixture.map((o) => o.id)).toEqual(before)
  })
})

describe('opportunities data integrity', () => {
  it('every deadline is a valid, parseable date', () => {
    fixture.forEach((item) => {
      expect(Number.isNaN(new Date(item.deadline).getTime())).toBe(false)
    })
  })
})
