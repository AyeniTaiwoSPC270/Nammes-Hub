import { lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import AdminResourceManager from '../../components/admin/AdminResourceManager'
import Breadcrumbs from '../../components/Breadcrumbs'
import { CALENDAR_TABS, normalizeCalendarTab } from '../../lib/adminCalendarTabs'
import { academicCalendarConfig } from './config/academicCalendarConfig'

// Split by tab rather than imported together: the design studio pulls the whole control
// set plus a live MonthGrid, and an admin who only ever edits dates should not pay for it.
// Dates stays eager because it is the tab almost every visit lands on.
const CalendarPasteBody = lazy(() =>
  import('./AdminCalendarPaste').then((m) => ({ default: m.CalendarPasteBody })),
)
const CalendarDesignBody = lazy(() =>
  import('./AdminCalendarDesign').then((m) => ({ default: m.CalendarDesignBody })),
)
const CalendarSessionBody = lazy(() =>
  import('./AdminCalendarSession').then((m) => ({ default: m.CalendarSessionBody })),
)

function DatesBody() {
  return (
    <AdminResourceManager
      table="academic_calendar"
      title="Calendar Dates"
      config={academicCalendarConfig}
      orderBy={[
        { column: 'session', ascending: true },
        { column: 'starts_at', ascending: true },
      ]}
    />
  )
}

const BODIES = {
  dates: DatesBody,
  paste: CalendarPasteBody,
  design: CalendarDesignBody,
  session: CalendarSessionBody,
}

export default function AdminCalendar() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = normalizeCalendarTab(searchParams.get('tab'))
  const Body = BODIES[tab]
  const current = CALENDAR_TABS.find((t) => t.id === tab)

  // replace, not push: a tab is a view of one page, so filling the history with four
  // entries means Back walks the tabs instead of leaving the page.
  const selectTab = (id) => setSearchParams({ tab: id }, { replace: true })

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-12 sm:px-6">
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Academic Calendar' }]} />
      <h1 className="text-3xl font-bold text-ink-900">Academic Calendar</h1>

      <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Calendar sections">
        {CALENDAR_TABS.map((t) => {
          const active = t.id === tab
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`calendar-tab-${t.id}`}
              aria-selected={active}
              aria-controls="calendar-tabpanel"
              onClick={() => selectTab(t.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                active
                  ? 'bg-brand text-white'
                  : 'bg-surface text-ink-muted ring-1 ring-hairline hover:text-ink-900'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <p className="mt-4 max-w-3xl text-ink-muted">{current.description}</p>

      <div id="calendar-tabpanel" role="tabpanel" aria-labelledby={`calendar-tab-${tab}`} className="mt-6">
        <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
          <Body />
        </Suspense>
      </div>
    </div>
  )
}
