import { lazy, Suspense } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AdminResourceManager from '../../components/admin/AdminResourceManager'
import { CONTENT_TABS, contentTabIds, normalizeContentTab } from '../../lib/adminContentTabs'
import { eventsAdminConfig } from './config/eventsAdminConfig'

// Split by tab, for the reason AdminCalendar.jsx:8-10 gives: the design studio pulls the whole control set
// plus a live preview, and an admin who only ever adds an event should not pay for it. Content stays eager
// because it is the tab almost every visit lands on.
const ContentDesignBody = lazy(() => import('./ContentDesign').then((m) => ({ default: m.ContentDesignBody })))

function ContentBody() {
  return (
    <AdminResourceManager
      table="events"
      title="Events"
      config={eventsAdminConfig}
      orderBy={{ column: 'created_at', ascending: true }}
      // This shell already provides the page container, so the manager's own would double every gutter.
      bare
      renderRowExtra={(row) => (
        <Link
          to={`/admin/events/${row.id}/gallery`}
          title="Manage gallery"
          className="text-ink-muted transition-colors hover:text-brand"
        >
          <span className="material-symbols-outlined text-xl">photo_library</span>
        </Link>
      )}
    />
  )
}

const BODIES = { content: ContentBody, design: ContentDesignBody }

export default function AdminEvents() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = normalizeContentTab(searchParams.get('tab'))
  const Body = BODIES[tab]
  const current = CONTENT_TABS.find((t) => t.id === tab)
  const ids = contentTabIds('events')

  // replace, not push: a tab is a view of one page, so filling the history with two entries means Back walks
  // the tabs instead of leaving the page.
  const selectTab = (id) => setSearchParams({ tab: id }, { replace: true })

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-12 sm:px-6">
      {/* AdminResourceManager renders its own <h1> for the content tab, so the heading is only drawn here for
          the design tab. Putting one in the shell as well would give the content tab two h1s -- which is what
          /admin/calendar does today and is not a precedent to copy. */}
      {tab === 'design' && <h1 className="text-3xl font-bold text-ink-900">Events</h1>}

      <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Events sections" id={ids.tablist}>
        {CONTENT_TABS.map((t) => {
          const active = t.id === tab
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`events-tab-${t.id}`}
              aria-selected={active}
              aria-controls={ids.panel}
              onClick={() => selectTab(t.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                active ? 'bg-brand text-white' : 'bg-surface text-ink-muted ring-1 ring-hairline hover:text-ink-900'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <p className="mt-4 max-w-3xl text-ink-muted">{current.description}</p>

      <div id={ids.panel} role="tabpanel" aria-labelledby={`events-tab-${tab}`} className="mt-6">
        {/* The page is passed as a prop rather than read from the URL inside the studio, so the body cannot be
            pointed at the other page's table by a stale link. */}
        <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
          {tab === 'design' ? <Body page="events" /> : <Body />}
        </Suspense>
      </div>
    </div>
  )
}
