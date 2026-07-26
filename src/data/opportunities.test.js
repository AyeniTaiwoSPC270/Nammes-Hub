import { describe, it, expect } from 'vitest'
import { opportunities, getOpportunities } from './opportunities'

describe('getOpportunities', () => {
  it('sorts opportunities by soonest deadline first', () => {
    const result = getOpportunities()
    const deadlines = result.map((o) => new Date(o.deadline).getTime())
    for (let i = 1; i < deadlines.length; i++) {
      expect(deadlines[i]).toBeGreaterThanOrEqual(deadlines[i - 1])
    }
    expect(result[0].id).toBe('nlng-siwes-internship')
  })

  it('does not mutate the original opportunities array', () => {
    const before = opportunities.map((o) => o.id)
    getOpportunities()
    expect(opportunities.map((o) => o.id)).toEqual(before)
  })
})

describe('opportunities data integrity', () => {
  it('every deadline is a valid, parseable date', () => {
    opportunities.forEach((item) => {
      expect(Number.isNaN(new Date(item.deadline).getTime())).toBe(false)
    })
  })
})
