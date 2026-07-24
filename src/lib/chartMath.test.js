import { describe, it, expect } from 'vitest'
import { buildChartPoints } from './chartMath'

describe('buildChartPoints', () => {
  it('returns an empty array for no data', () => {
    expect(buildChartPoints([], { width: 400, height: 200 })).toEqual([])
  })

  it('places a single point at the left padding edge', () => {
    const [point] = buildChartPoints([{ label: '100L S1', gpa: 5, cgpaSoFar: 5 }], {
      width: 400,
      height: 200,
      padding: 20,
    })
    expect(point.x).toBe(20)
    expect(point.gpaY).toBe(20)
  })

  it('spreads multiple points evenly across the inner width and maps GPA 0 to the bottom', () => {
    const points = buildChartPoints(
      [
        { label: '100L S1', gpa: 0, cgpaSoFar: 0 },
        { label: '100L S2', gpa: 5, cgpaSoFar: 5 },
      ],
      { width: 220, height: 120, padding: 10 }
    )

    expect(points[0].x).toBe(10)
    expect(points[1].x).toBe(210)
    expect(points[0].gpaY).toBe(110)
    expect(points[1].gpaY).toBe(10)
  })
})
