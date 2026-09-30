import { describe, it, expect } from 'vitest'
import { pickFitZoom, autoScrollY, FIT_STEPS, AUTO_SCROLL } from './projectorFit'

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

describe('autoScrollY', () => {
  const max = 450
  const { pauseMs, downPxPerSec, upPxPerSec } = AUTO_SCROLL
  const down = (max / downPxPerSec) * 1000
  const up = (max / upPxPerSec) * 1000
  it('waits at the top, scrolls down, waits at the bottom, comes back', () => {
    expect(autoScrollY(0, max)).toBe(0)
    expect(autoScrollY(pauseMs - 1, max)).toBe(0)
    expect(autoScrollY(pauseMs + down / 2, max)).toBeCloseTo(max / 2)
    expect(autoScrollY(pauseMs + down + 1, max)).toBe(max)
    expect(autoScrollY(pauseMs + down + pauseMs - 1, max)).toBe(max)
    expect(autoScrollY(pauseMs + down + pauseMs + up / 2, max)).toBeCloseTo(max / 2)
  })
  it('repeats forever and stays inside the page', () => {
    const cycle = pauseMs + down + pauseMs + up
    expect(autoScrollY(cycle * 7 + pauseMs + down / 2, max)).toBeCloseTo(max / 2)
    for (let t = 0; t < cycle * 2; t += 137) {
      const y = autoScrollY(t, max)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(max)
    }
  })
  it('does nothing when there is nothing to scroll', () => {
    expect(autoScrollY(5000, 0)).toBe(0)
    expect(autoScrollY(5000, -20)).toBe(0)
  })
})
