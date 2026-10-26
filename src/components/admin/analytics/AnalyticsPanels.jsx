import { Link } from 'react-router-dom'
import { humanisePath, relativeWhen } from '../../../lib/analytics'

function Panel({ title, description, children, className = '' }) {
  return (
    <section className={['rounded-lg border border-hairline bg-surface p-5 shadow-md', className].join(' ')}>
      <header className="mb-3">
        <h2 className="text-base font-bold text-ink-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-ink-muted">{description}</p>}
      </header>
      {children}
    </section>
  )
}

export function TopContentPanel({ rows }) {
  const max = rows[0]?.views ?? 0

  return (
    <Panel title="Top content" description="Most-viewed pages this period">
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-muted">
          No page views in this period yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.path} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm font-semibold text-ink-900" title={row.label}>
                  {row.label}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-ink-muted">{row.views.toLocaleString()}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-low">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${max > 0 ? Math.max(4, (row.views / max) * 100) : 0}%` }}
                />
              </div>
              {row.label !== humanisePath(row.path) && (
                <span className="truncate text-xs text-ink-muted">{row.path}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

const ATTENTION_ITEMS = [
  { key: 'pendingSubmissions', label: 'submissions waiting', href: '/admin/submissions', icon: 'fact_check' },
  { key: 'pendingReviews', label: 'edits awaiting approval', href: '/admin/reviews', icon: 'how_to_reg', ownerOnly: true },
  { key: 'unhandledMessages', label: 'messages unanswered', href: '/admin/messages', icon: 'mail' },
  { key: 'calendarTba', label: 'calendar dates TBA', href: '/admin/calendar', icon: 'event_busy' },
  { key: 'failedEmails', label: 'emails failed to send', href: '/admin/system', icon: 'error', ownerOnly: true },
  { key: 'errors24h', label: 'server errors in 24h', href: '/admin/system', icon: 'monitor_heart', ownerOnly: true },
]

// A queue that is empty is good news, so a zero is muted rather than hidden: the admin still needs to
// know the panel checked. Owner-only sources are omitted for a non-owner, the way the inbox omits them,
// instead of offering a link to a screen they cannot open.
export function AttentionPanel({ attention, isOwner }) {
  const items = ATTENTION_ITEMS.filter((item) => !item.ownerOnly || isOwner)

  return (
    <Panel title="Needs attention" description="Right now, not this period">
      <ul className="flex flex-col divide-y divide-hairline">
        {items.map((item) => {
          const count = attention[item.key] ?? 0
          return (
            <li key={item.key}>
              <Link
                to={item.href}
                className="flex items-center justify-between gap-3 py-2.5 no-underline hover:text-brand"
              >
                <span className="flex items-center gap-2 text-sm text-ink">
                  <span className="material-symbols-outlined text-base text-ink-muted" aria-hidden="true">
                    {item.icon}
                  </span>
                  {item.label}
                </span>
                <span
                  className={[
                    'inline-flex min-w-7 justify-center rounded-full px-2 py-0.5 text-xs font-bold tabular-nums',
                    count > 0 ? 'bg-warning-bg text-warning' : 'bg-surface-low text-ink-muted',
                  ].join(' ')}
                >
                  {count}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

const ACTIVITY_ICONS = {
  signup: 'person',
  submission: 'upload_file',
  response: 'checklist',
  message: 'mail',
  quiz: 'quiz',
  news: 'article',
}

export function ActivityFeed({ rows }) {
  return (
    <Panel title="Recent activity" description="The last few things that happened">
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-muted">Nothing has happened in this period.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-hairline">
          {rows.map((row, index) => (
            <li key={`${row.kind}-${row.at}-${index}`} className="flex items-start gap-3 py-2.5">
              <span className="material-symbols-outlined mt-0.5 text-base text-brand" aria-hidden="true">
                {ACTIVITY_ICONS[row.kind] ?? 'bolt'}
              </span>
              <span className="flex-1 text-sm text-ink">{row.label}</span>
              <span className="shrink-0 text-xs text-ink-muted">{relativeWhen(row.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

const QUICK_ACTIONS = [
  { label: 'Submissions', href: '/admin/submissions', icon: 'fact_check' },
  { label: 'Messages', href: '/admin/messages', icon: 'mail' },
  { label: 'News', href: '/admin/news', icon: 'article' },
  { label: 'Events', href: '/admin/events', icon: 'event' },
  { label: 'Forms', href: '/admin/forms', icon: 'checklist' },
  { label: 'Broadcasts', href: '/admin/broadcasts', icon: 'campaign' },
]

export function QuickActionsPanel() {
  return (
    <Panel title="Quick actions" description="The screens this dashboard usually sends you to">
      <div className="grid grid-cols-2 gap-2">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.href}
            to={action.href}
            className="flex items-center gap-2 rounded-md border border-hairline px-3 py-2 text-sm font-semibold text-brand no-underline transition-colors hover:border-brand hover:bg-surface-low"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              {action.icon}
            </span>
            {action.label}
          </Link>
        ))}
      </div>
    </Panel>
  )
}
