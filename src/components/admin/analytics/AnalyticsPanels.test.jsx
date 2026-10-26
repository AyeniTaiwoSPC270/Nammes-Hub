import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import {
  ActivityFeed,
  AttentionPanel,
  QuickActionsPanel,
  TopContentPanel,
} from './AnalyticsPanels'
import { sanitizeAnalytics } from '../../../lib/analytics'

function render(element) {
  return renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>)
}

const attention = sanitizeAnalytics(
  {
    attention: {
      pendingSubmissions: 3,
      pendingReviews: 2,
      unhandledMessages: 1,
      calendarTba: 4,
      failedEmails: 0,
      errors24h: 5,
    },
  },
  30
).attention

describe('AttentionPanel', () => {
  it('shows an owner the owner-only queues', () => {
    const html = render(<AttentionPanel attention={attention} isOwner />)
    expect(html).toContain('edits awaiting approval')
    expect(html).toContain('server errors in 24h')
    expect(html).toContain('/admin/reviews')
  })

  it('does not offer a non-owner a screen they cannot open', () => {
    const html = render(<AttentionPanel attention={attention} isOwner={false} />)
    expect(html).not.toContain('edits awaiting approval')
    expect(html).not.toContain('/admin/system')
    expect(html).toContain('/admin/submissions')
    expect(html).toContain('messages unanswered')
  })

  it('still renders a zero, so the panel shows it checked', () => {
    const html = render(<AttentionPanel attention={{ ...attention, pendingSubmissions: 0 }} isOwner={false} />)
    expect(html).toContain('submissions waiting')
  })
})

describe('TopContentPanel', () => {
  it('renders a label and its count', () => {
    const html = render(<TopContentPanel rows={[{ path: '/news/abc', label: 'A story', views: 9 }]} />)
    expect(html).toContain('A story')
    expect(html).toContain('9')
  })

  it('explains an empty period instead of drawing nothing', () => {
    expect(render(<TopContentPanel rows={[]} />)).toContain('No page views in this period yet')
  })
})

describe('ActivityFeed', () => {
  it('renders a user-supplied title as text, never as markup', () => {
    const html = render(
      <ActivityFeed
        rows={[
          {
            kind: 'submission',
            label: '<script>alert(1)</script>',
            at: new Date().toISOString(),
          },
        ]}
      />
    )
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
  })
})

describe('QuickActionsPanel', () => {
  it('links the screens an admin usually needs next', () => {
    const html = render(<QuickActionsPanel />)
    expect(html).toContain('/admin/submissions')
    expect(html).toContain('/admin/broadcasts')
  })
})
