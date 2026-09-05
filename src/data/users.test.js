import { describe, it, expect } from 'vitest'
import { isActive } from './users'

describe('isActive', () => {
  const now = new Date('2026-09-05T00:00:00Z')

  it('is false when never seen', () => {
    expect(isActive(null, now)).toBe(false)
  })
  it('is true when seen today', () => {
    expect(isActive('2026-09-05T00:00:00Z', now)).toBe(true)
  })
  it('is true exactly at the 14-day boundary', () => {
    expect(isActive('2026-08-22T00:00:00Z', now)).toBe(true)
  })
  it('is false just past the 14-day boundary', () => {
    expect(isActive('2026-08-21T23:59:59Z', now)).toBe(false)
  })
})
