import { describe, expect, it } from 'vitest'
import { jsPDF } from 'jspdf'
import {
  analyticsPdfFilename,
  analyticsPdfModel,
  drawAnalyticsReport,
  formatNumber,
  formatStamp,
} from './analyticsPdf'
import { sanitizeAnalytics } from './analytics'

const data = sanitizeAnalytics(
  {
    range: { days: 30, from: '2026-09-26', to: '2026-10-26' },
    kpis: {
      views: { current: 1840, previous: 1200 },
      visitors: { current: 612, previous: 540 },
      signups: { current: 34, previous: 0 },
      quizPlays: { current: 12, previous: 4, players: 210 },
      cbtAttempts: { current: 57, previous: 61, averageScore: 62 },
      formResponses: { current: 88, previous: 40 },
      optInRate: { optedIn: 120, total: 129 },
    },
    traffic: [{ day: '2026-10-01', views: 10, visitors: 4 }],
    signups: [{ day: '2026-10-01', count: 2 }],
    engagement: [{ day: '2026-10-01', quiz: 1, practice: 2, cbt: 3, forms: 1, battles: 0 }],
    topContent: Array.from({ length: 9 }, (_, i) => ({ path: `/news/${i}`, label: `Story ${i}`, views: 9 - i })),
    awards: [{ category: 'Best Lecturer', votes: 22 }],
    email: {
      optedIn: 120,
      optedOut: 9,
      broadcasts: [{ subject: 'Week 3', recipients: 118, sentAt: '2026-10-12T09:00:00Z' }],
    },
    attention: { pendingSubmissions: 2, unhandledMessages: 1 },
    activity: Array.from({ length: 12 }, (_, i) => ({
      kind: 'signup',
      label: `Event ${i}`,
      at: '2026-10-25T09:00:00Z',
    })),
  },
  30
)

describe('numbers and stamps', () => {
  it('groups digits without the machine locale', () => {
    expect(formatNumber(1840)).toBe('1,840')
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(1234567)).toBe('1,234,567')
  })

  it('stamps a fixed format', () => {
    expect(formatStamp(new Date(2026, 9, 26, 15, 42))).toBe('26 Oct 2026, 15:42')
    expect(formatStamp(new Date(2026, 0, 1, 9, 5))).toBe('1 Jan 2026, 09:05')
    expect(formatStamp('nonsense')).toBe('')
  })
})

describe('analyticsPdfModel', () => {
  const model = analyticsPdfModel(data, new Date(2026, 9, 26, 15, 42))

  it('carries the period, the stamp and the footer note', () => {
    expect(model.title).toBe('NAMMES Hub — Analytics')
    expect(model.period).toBe('26 Sep – 26 Oct')
    expect(model.generatedAt).toBe('26 Oct 2026, 15:42')
    expect(model.footer).toContain('Private to admins')
  })

  it('turns the headline numbers into tiles, including the derived ones', () => {
    const byLabel = Object.fromEntries(model.tiles.map((tile) => [tile.label, tile]))
    expect(byLabel['Page views'].value).toBe('1,840')
    expect(byLabel['Page views'].delta).toBe('+53%')
    expect(byLabel['Visitors (sessions)'].value).toBe('612')
    expect(byLabel['Quiz plays'].note).toBe('210 players')
    expect(byLabel['CBT attempts'].note).toBe('avg 62%')
    expect(byLabel['Email opt-in'].value).toBe('93%')
    expect(byLabel['Email opt-in'].note).toBe('120 of 129')
  })

  it('says a first-ever period is new rather than +100%', () => {
    const signups = model.tiles.find((tile) => tile.label === 'New members')
    expect(signups.delta).toBe('new')
  })

  it('caps the lists so a panel cannot overflow its box', () => {
    expect(model.topContent).toHaveLength(6)
    expect(model.activity).toHaveLength(8)
  })

  it('flattens the queues into label/value rows', () => {
    expect(model.attention).toContainEqual(['Submissions waiting', 2])
    expect(model.attention).toHaveLength(6)
  })
})

describe('analyticsPdfFilename', () => {
  const day = new Date(2026, 9, 26, 15, 0)
  it('names the layout', () => {
    expect(analyticsPdfFilename('30d', 'landscape', day)).toBe('nammes-analytics-30d-summary-2026-10-26.pdf')
    expect(analyticsPdfFilename('30d', 'portrait', day)).toBe('nammes-analytics-30d-report-2026-10-26.pdf')
  })
})

describe('drawing', () => {
  it('draws both layouts into a real PDF without throwing', () => {
    // Font registration lives in the browser path; without it jsPDF falls back to Helvetica, which is
    // fine here because what is under test is geometry, not type.
    const model = analyticsPdfModel(data, new Date(2026, 9, 26, 15, 42))
    for (const orientation of ['portrait', 'landscape']) {
      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation })
      drawAnalyticsReport(doc, model, orientation)
      const bytes = doc.output('arraybuffer').byteLength
      expect(bytes, `${orientation} produced an empty document`).toBeGreaterThan(4000)
      expect(doc.getNumberOfPages()).toBe(orientation === 'portrait' ? 2 : 1)
    }
  })
})
