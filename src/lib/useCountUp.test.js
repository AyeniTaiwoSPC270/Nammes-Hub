import { describe, it, expect } from 'vitest'
import { countUpValue, easeOutCubic } from './useCountUp'

describe('countUpValue', () => {
  it('starts at the old score and ends exactly on the new one', () => {
    expect(countUpValue(1000, 1950, 0)).toBe(1000)
    expect(countUpValue(1000, 1950, 1)).toBe(1950)
  })
  it('covers most of the distance early, then slows down', () => {
    expect(countUpValue(0, 1000, 0.5)).toBeGreaterThan(800)
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5)
  })
  it('stays inside the range when progress overshoots or goes negative', () => {
    expect(countUpValue(0, 500, 3)).toBe(500)
    expect(countUpValue(0, 500, -1)).toBe(0)
  })
  it('counts down as well as up', () => {
    expect(countUpValue(900, 100, 1)).toBe(100)
    expect(countUpValue(900, 100, 0.5)).toBeLessThan(300)
  })
})
