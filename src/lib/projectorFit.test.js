import { describe, it, expect } from 'vitest'
import { pickFitZoom, FIT_STEPS } from './projectorFit'

describe('pickFitZoom', () => {
  it('keeps full size when everything already fits', () => {
    expect(pickFitZoom(() => true)).toBe(1)
  })
  it('takes the biggest zoom that fits', () => {
    expect(pickFitZoom((z) => z <= 0.8)).toBe(0.8)
    expect(pickFitZoom((z) => z <= 0.93)).toBe(0.9)
  })
  it('never goes below the readable minimum, even if nothing fits', () => {
    expect(pickFitZoom(() => false)).toBe(Math.min(...FIT_STEPS))
    expect(Math.min(...FIT_STEPS)).toBeGreaterThanOrEqual(0.6)
  })
  it('tries the steps from large to small', () => {
    const tried = []
    pickFitZoom((z) => { tried.push(z); return false })
    expect(tried).toEqual([...FIT_STEPS])
    expect([...FIT_STEPS].sort((a, b) => b - a)).toEqual(FIT_STEPS)
  })
})
