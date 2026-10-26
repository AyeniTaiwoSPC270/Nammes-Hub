import { lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import AdminResourceManager from '../../components/admin/AdminResourceManager'
import { CONTENT_TABS, contentTabIds, normalizeContentTab } from '../../lib/adminContentTabs'
import { newsAdminConfig } from './config/newsAdminConfig'
import { useNewsVideoFlag } from '../../data/news'
import { useAuth } from '../../lib/AuthContext'
import { useOwnAdminRowQuery } from '../../data/admins'

// The same lazy body AdminEvents.jsx loads, for the reason given there: the studio pulls a control panel and a
// live preview, and the tab an admin lands on is the content list.
const ContentDesignBody = lazy(() => import('./ContentDesign').then((m) => ({ default: m.ContentDesignBody })))

function ContentBody() {
  // Two gates, deliberately: the kill switch hides the control from everybody, and ownership keeps video
  // an owner-only authoring job (spec §Decisions). A non-owner admin still edits text and images through
  // the review queue -- and because `apply_change_request` guards each video column on the payload
  // carrying it, a queued edit made without these fields leaves an existing video untouched rather than
  // writing NULL over it.
  const { user } = useAuth()
  const adminRow = useOwnAdminRowQuery(user?.id)
  const isOwner = Boolean(adminRow.data?.is_owner)
  const videoEnabled = useNewsVideoFlag()
  const showVideo = videoEnabled && isOwner
  const config = showVideo
    ? newsAdminConfig
    : { ...newsAdminConfig, fields: newsAdminConfig.fields.filter((f) => f.type !== 'video') }
  return (
    <AdminResourceManager
      table="news"
      title="News"
      config={config}
      orderBy={{ column: 'date', ascending: false }}
      // This shell already provides the page container, so the manager's own would double every gutter.
      bare
    />
  )
}

const BODIES = { content: ContentBody, design: ContentDesignBody }

export default function AdminNews() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = normalizeContentTab(searchParams.get('tab'))
  const Body = BODIES[tab]
  const current = CONTENT_TABS.find((t) => t.id === tab)
  const ids = contentTabIds('news')

  const selectTab = (id) => setSearchParams({ tab: id }, { replace: true })

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-12 sm:px-6">
      {/* The content tab's heading comes from AdminResourceManager, which renders its own <h1>. Drawing one
          here too would give that tab two. */}
      {tab === 'design' && <h1 className="text-3xl font-bold text-ink-900">News</h1>}

      <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="News sections" id={ids.tablist}>
        {CONTENT_TABS.map((t) => {
          const active = t.id === tab
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`news-tab-${t.id}`}
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

      <div id={ids.panel} role="tabpanel" aria-labelledby={`news-tab-${tab}`} className="mt-6">
        <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
          {tab === 'design' ? <Body page="news" /> : <Body />}
        </Suspense>
      </div>
    </div>
  )
}
