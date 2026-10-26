import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

// No jsdom in this suite, so the page is composed and rendered to a string. That is enough to catch the
// failure this test exists for: a hook, import or prop shape that throws before anything is drawn.
// The numbers themselves are covered by analytics.test.js.
vi.mock('../../data/analytics', async () => {
  const { sanitizeAnalytics } = await import('../../lib/analytics')
  const data = sanitizeAnalytics(
    {
      range: { days: 7, from: '2026-10-20', to: '2026-10-26' },
      kpis: {
        views: { current: 30, previous: 12 },
        visitors: { current: 9, previous: 4 },
        signups: { current: 2, previous: 1 },
        quizPlays: { current: 1, previous: 0, players: 6 },
        cbtAttempts: { current: 3, previous: 2, averageScore: 58 },
        formResponses: { current: 4, previous: 0 },
        optInRate: { optedIn: 8, total: 10 },
      },
      traffic: [{ day: '2026-10-25', views: 12, visitors: 5, signedIn: 2 }],
      signups: [{ day: '2026-10-25', count: 1 }],
      engagement: [{ day: '2026-10-25', quiz: 1, cbt: 2, forms: 1 }],
      topContent: [{ path: '/news/abc', label: 'A story', views: 12 }],
      awards: [{ category: 'Best Lecturer', votes: 5 }],
      email: { optedIn: 8, optedOut: 2, broadcasts: [{ subject: 'Week 3', recipients: 8, sentAt: '2026-10-24T09:00:00Z' }] },
      attention: { pendingSubmissions: 2, pendingReviews: 1, unhandledMessages: 0, calendarTba: 3 },
      activity: [{ kind: 'signup', label: 'A new member joined', at: '2026-10-25T09:00:00Z' }],
    },
    7
  )
  return {
    useAnalyticsQuery: () => ({ data, isLoading: false, isError: false, refetch: () => {} }),
    useAnalyticsFlag: () => true,
  }
})

vi.mock('../../data/admins', () => ({ useOwnAdminRowQuery: () => ({ data: { is_owner: true } }) }))
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }))
vi.mock('../../lib/ToastContext', () => ({ useToast: () => ({ error: () => {}, success: () => {} }) }))

const { default: AdminAnalytics } = await import('./AdminAnalytics')

function renderPage(path = '/admin/analytics?range=7d') {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <AdminAnalytics />
    </MemoryRouter>
  )
}

describe('AdminAnalytics', () => {
  it('composes the whole dashboard from one sanitised payload', () => {
    const html = renderPage()
    expect(html).toContain('Analytics')
    expect(html).toContain('Visitors (sessions)')
    expect(html).toContain('Needs attention')
    expect(html).toContain('Top content')
    expect(html).toContain('A story')
  })

  it('keeps the owner-only queues for an owner', () => {
    expect(renderPage()).toContain('edits awaiting approval')
  })

  it('shows the selected range, not the fallback', () => {
    expect(renderPage('/admin/analytics?range=7d')).toContain('20 Oct')
  })

  it('does not claim there is no traffic when there is', () => {
    expect(renderPage()).not.toContain('No page views are recorded for this period yet')
  })
})
