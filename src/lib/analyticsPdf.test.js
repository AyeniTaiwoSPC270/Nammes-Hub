import { describe, expect, it } from 'vitest'
import { analyticsPdfFilename, analyticsPdfSections } from './analyticsPdf'
import { sanitizeAnalytics } from './analytics'

const data = sanitizeAnalytics(
  {
    range: { days: 30, from: '2026-09-26', to: '2026-10-26' },
    kpis: {
      views: { current: 40, previous: 20 },
      visitors: { current: 12, previous: 8 },
      signups: { current: 3, previous: 1 },
      quizPlays: { current: 2, previous: 1, players: 14 },
      cbtAttempts: { current: 5, previous: 4, averageScore: 61 },
      formResponses: { current: 7, previous: 2 },
      optInRate: { optedIn: 9, total: 12 },
    },
    traffic: [{ day: '2026-10-01', views: 10, visitors: 4 }],
    topContent: [{ path: '/news/abc', label: 'A story', views: 7 }],
    awards: [{ category: 'Best Lecturer', votes: 22 }],
    attention: { pendingSubmissions: 2, unhandledMessages: 1 },
  },
  30
)

describe('analyticsPdfSections', () => {
  it('starts with the period it was generated for', () => {
    const sections = analyticsPdfSections(data, new Date('2026-10-26T10:00:00Z'))
    expect(sections[0].title).toContain('26 Sep')
    expect(sections[0].title).toContain('26 Oct')
    expect(sections[0].rows[0][1]).toBeTruthy()
  })

  it('carries every headline number the page shows', () => {
    const headline = analyticsPdfSections(data).find((section) => section.title === 'Headline')
    const labels = headline.rows.map(([label]) => label)
    expect(labels).toContain('Visitors (sessions)')
    expect(labels).toContain('CBT average score')
    expect(headline.rows).toContainEqual(['CBT average score', '61%'])
    expect(headline.rows).toContainEqual(['Email opt-in', '75% (9 of 12)'])
  })

  it('prints a readable row instead of an empty table', () => {
    const empty = sanitizeAnalytics(null, 30)
    const sections = analyticsPdfSections(empty)
    const views = sections.find((section) => section.title === 'Most viewed')
    expect(views.rows).toEqual([['No page views recorded', '0']])
  })

  it('names the file after the range and the day', () => {
    expect(analyticsPdfFilename('7d', new Date('2026-10-26T10:00:00Z'))).toBe(
      'nammes-analytics-7d-2026-10-26.pdf'
    )
  })
})
