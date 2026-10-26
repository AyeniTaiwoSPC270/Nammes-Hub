import { describe, expect, it, vi } from 'vitest'
import {
  analyticsCsv,
  csvFilename,
  downsample,
  emptyAnalytics,
  formatDelta,
  formatDay,
  hasTraffic,
  humanisePath,
  normalisePath,
  percentDelta,
  rangeDays,
  rangeFromSearch,
  sanitizeAnalytics,
  searchForRange,
  totalFor,
} from './analytics'

describe('range', () => {
  it('maps a URL value to days and back', () => {
    expect(rangeDays('7d')).toBe(7)
    expect(rangeDays('all')).toBe(0)
    expect(rangeDays('nonsense')).toBe(30)
  })

  it('falls back to 30 days for a missing or unknown value', () => {
    expect(rangeFromSearch('')).toBe('30d')
    expect(rangeFromSearch('?range=90d')).toBe('90d')
    expect(rangeFromSearch('?range=forever')).toBe('30d')
  })

  it('keeps unrelated query parameters when writing the range', () => {
    expect(searchForRange('?tab=reach', '7d')).toBe('?tab=reach&range=7d')
    expect(searchForRange('?range=bogus', '7d')).toBe('?range=7d')
  })
})

describe('percentDelta', () => {
  it('reports no previous period separately from no change', () => {
    expect(percentDelta(10, 0)).toBeNull()
    expect(percentDelta(0, 0)).toBe(0)
    // No sign for no change: "+0%" reads as growth that did not happen.
    expect(formatDelta(0)).toBe('0%')
    expect(formatDelta(null)).toBe('new')
  })

  it('handles growth and decline', () => {
    expect(percentDelta(150, 100)).toBe(0.5)
    expect(percentDelta(50, 100)).toBe(-0.5)
    expect(formatDelta(0.5)).toBe('+50%')
    expect(formatDelta(-0.5)).toBe('-50%')
  })
})

describe('paths', () => {
  it('strips query, hash and trailing slash', () => {
    expect(normalisePath('/news?utm_source=x')).toBe('/news')
    expect(normalisePath('/news/x/#top')).toBe('/news/x')
    expect(normalisePath('/')).toBe('/')
    expect(normalisePath('')).toBe('/')
  })

  it('reads a known page by name and a detail route by its section', () => {
    expect(humanisePath('/')).toBe('Home')
    expect(humanisePath('/news')).toBe('News')
    expect(humanisePath('/news/scholarship-night')).toBe('News · scholarship night')
    expect(humanisePath('/resources/300/1')).toBe('Resources · 300 · 1')
  })
})

describe('sanitizeAnalytics', () => {
  it('returns a complete empty shape for a missing payload', () => {
    expect(sanitizeAnalytics(null, 7)).toEqual(emptyAnalytics(7))
    expect(sanitizeAnalytics('nope', 7)).toEqual(emptyAnalytics(7))
    expect(hasTraffic(emptyAnalytics(7))).toBe(false)
  })

  it('coerces junk numbers instead of letting NaN reach a chart', () => {
    const data = sanitizeAnalytics(
      {
        range: { days: '30', from: '2026-09-26' },
        kpis: { views: { current: '41', previous: null }, signups: { current: -3 } },
      },
      30
    )
    expect(data.kpis.views.current).toBe(41)
    expect(data.kpis.views.previous).toBe(0)
    expect(data.kpis.signups.current).toBe(0)
  })

  it('drops series rows that are not dated and sorts the rest', () => {
    const data = sanitizeAnalytics(
      {
        traffic: [
          { day: '2026-10-02', views: 5, visitors: 2 },
          { day: 'not-a-day', views: 99 },
          { day: '2026-10-01', views: 1, visitors: 1 },
        ],
      },
      30
    )
    expect(data.traffic.map((row) => row.day)).toEqual(['2026-10-01', '2026-10-02'])
    expect(data.traffic[1]).toEqual({ day: '2026-10-02', views: 5, visitors: 2, signedIn: 0 })
  })

  it('recomputes the opt-in share from the counts it was given', () => {
    const data = sanitizeAnalytics({ kpis: { optInRate: { current: 0.99, optedIn: 3, total: 10 } } }, 30)
    expect(data.kpis.optInRate.current).toBeCloseTo(0.3)
    expect(data.kpis.optInRate.total).toBe(10)
  })

  it('never reports more opt-ins than members', () => {
    const data = sanitizeAnalytics({ kpis: { optInRate: { optedIn: 12, total: 10 } } }, 30)
    expect(data.kpis.optInRate.optedIn).toBe(10)
    expect(data.kpis.optInRate.current).toBe(1)
  })

  it('labels an unresolved path and drops a zero-view row', () => {
    const data = sanitizeAnalytics(
      {
        topContent: [
          { path: '/news/abc', label: 'A story', views: 9 },
          { path: '/events/xyz', label: '', views: 4 },
          { path: '/ghost', label: '', views: 0 },
        ],
      },
      30
    )
    expect(data.topContent).toEqual([
      { path: '/news/abc', label: 'A story', views: 9 },
      { path: '/events/xyz', label: 'Events · xyz', views: 4 },
    ])
  })

  it('caps the activity feed and drops rows with no timestamp', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      kind: 'signup',
      label: `event ${i}`,
      at: `2026-10-${String((i % 20) + 1).padStart(2, '0')}T10:00:00Z`,
    }))
    rows.push({ kind: 'signup', label: 'no timestamp', at: '' })
    const data = sanitizeAnalytics({ activity: rows }, 30)
    expect(data.activity).toHaveLength(12)
    expect(data.activity.some((row) => row.label === 'no timestamp')).toBe(false)
  })
})

describe('series maths', () => {
  it('totals the requested keys', () => {
    const rows = [
      { day: '2026-10-01', quiz: 1, forms: 2 },
      { day: '2026-10-02', quiz: 3, forms: 0 },
    ]
    expect(totalFor(rows, ['quiz', 'forms'])).toBe(6)
  })

  it('leaves a short series alone', () => {
    const rows = [{ day: '2026-10-01', views: 1 }]
    expect(downsample(rows, 90)).toEqual(rows)
  })

  it('buckets a long series and keeps the total', () => {
    const rows = Array.from({ length: 300 }, (_, i) => ({
      day: `2026-${String(Math.floor(i / 28) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
      views: 2,
    }))
    const out = downsample(rows, 90)
    expect(out.length).toBeLessThanOrEqual(91)
    expect(totalFor(out, ['views'])).toBe(600)
  })
})

describe('analyticsCsv', () => {
  const data = sanitizeAnalytics(
    {
      kpis: { views: { current: 12 }, optInRate: { optedIn: 2, total: 4 } },
      traffic: [{ day: '2026-10-01', views: 4, visitors: 3, signedIn: 1 }],
      topContent: [{ path: '/news/abc', label: 'Story, with a comma', views: 2 }],
      attention: { pendingSubmissions: 1 },
    },
    7
  )

  it('writes one header and one long-format table', () => {
    const csv = analyticsCsv(data)
    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe('section,day,label,value')
    expect(csv.endsWith('\n')).toBe(true)
    expect(lines).toContain('traffic,2026-10-01,views,4')
    expect(lines).toContain('kpi,,optedIn,2')
    expect(lines).toContain('attention,,pendingSubmissions,1')
  })

  it('quotes a label that contains a comma', () => {
    expect(analyticsCsv(data)).toContain('top_content,,"Story, with a comma",2')
  })

  it('names the file after the range and the day', () => {
    expect(csvFilename('30d')).toMatch(/^nammes-analytics-30d-\d{4}-\d{2}-\d{2}\.csv$/)
  })
})

describe('formatDay', () => {
  // Exact, not `toContain('Oct')`: the loose version passed on both "5 Oct" and "Oct 5", which is how
  // a toLocaleDateString formatter reached CI and rendered differently on an en-US runner.
  it('formats a day from its own parts and does not depend on the machine locale', () => {
    expect(formatDay('2026-10-05')).toBe('5 Oct')
    expect(formatDay('2026-01-31')).toBe('31 Jan')
    expect(formatDay('nope')).toBe('')
  })

  it('never reaches for a locale API, which is what made CI disagree with a local run', () => {
    // If a formatter is ever reintroduced, this throws instead of silently passing on an en-GB machine.
    const spy = vi.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(() => {
      throw new Error('formatDay must not depend on the machine locale')
    })
    try {
      expect(formatDay('2026-10-05')).toBe('5 Oct')
    } finally {
      spy.mockRestore()
    }
  })
})
