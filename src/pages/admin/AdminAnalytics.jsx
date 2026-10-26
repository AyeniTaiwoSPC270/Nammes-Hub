import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import StatCard from '../../components/admin/analytics/StatCard'
import {
  AwardChart,
  EmailReachChart,
  EngagementChart,
  SignupChart,
  TrafficChart,
} from '../../components/admin/analytics/AnalyticsCharts'
import {
  ActivityFeed,
  AttentionPanel,
  QuickActionsPanel,
  TopContentPanel,
} from '../../components/admin/analytics/AnalyticsPanels'
import Button from '../../components/ui/Button'
import ErrorState from '../../components/ui/ErrorState'
import { useAnalyticsQuery } from '../../data/analytics'
import { useOwnAdminRowQuery } from '../../data/admins'
import { useAuth } from '../../lib/AuthContext'
import {
  RANGE_OPTIONS,
  analyticsCsv,
  csvFilename,
  emptyAnalytics,
  formatDay,
  hasTraffic,
  percentLabel,
  rangeDays,
  rangeFromSearch,
} from '../../lib/analytics'
import { downloadTextFile } from '../../lib/downloadFile'
import { downloadAnalyticsPdf } from '../../lib/analyticsPdf'
import { useToast } from '../../lib/ToastContext'

function RangePicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-md border border-hairline bg-surface-low p-1" role="group" aria-label="Time range">
      {RANGE_OPTIONS.map((option) => {
        const active = option.key === value
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            aria-pressed={active}
            className={[
              'rounded-sm px-3 py-1.5 text-sm font-semibold transition-colors',
              active
                ? 'bg-green-900 text-white'
                : 'text-ink-muted hover:bg-surface hover:text-brand',
            ].join(' ')}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function LoadingGrid() {
  return (
    <div className="mt-8 flex flex-col gap-5" aria-busy="true" aria-label="Loading analytics">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg border border-hairline bg-surface" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-lg border border-hairline bg-surface lg:col-span-2" />
        <div className="h-64 animate-pulse rounded-lg border border-hairline bg-surface" />
        <div className="h-64 animate-pulse rounded-lg border border-hairline bg-surface" />
      </div>
    </div>
  )
}

export default function AdminAnalytics() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [pdfBusy, setPdfBusy] = useState(false)
  const { user } = useAuth()
  const toast = useToast()
  const range = rangeFromSearch(searchParams.toString())
  const days = rangeDays(range)
  const analyticsQuery = useAnalyticsQuery(days)
  const adminRowQuery = useOwnAdminRowQuery(user?.id)
  const isOwner = Boolean(adminRowQuery.data?.is_owner)
  const data = analyticsQuery.data ?? emptyAnalytics(days)

  function chooseRange(key) {
    const next = new URLSearchParams(searchParams)
    next.set('range', key)
    setSearchParams(next, { replace: true })
  }

  function handleCsv() {
    downloadTextFile(csvFilename(range), analyticsCsv(data))
  }

  async function handlePdf() {
    setPdfBusy(true)
    try {
      await downloadAnalyticsPdf(data, range)
    } catch {
      toast.error('The PDF could not be built. Try the CSV instead.')
    } finally {
      setPdfBusy(false)
    }
  }

  const traffic = data.traffic
  const rangeLabel =
    data.range.from && data.range.to
      ? `${formatDay(data.range.from)} – ${formatDay(data.range.to)}`
      : days === 0
        ? 'All time'
        : `Last ${days} days`

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-ink-900">Analytics</h1>
          <p className="max-w-2xl text-ink-muted">
            Who visited, what they used and what needs attention. Traffic is counted from the day
            tracking was switched on — there is no history before that.
          </p>
        </header>
        <div className="flex flex-wrap items-center gap-2">
          <RangePicker value={range} onChange={chooseRange} />
          <Button variant="secondary" size="sm" onClick={handleCsv} disabled={!analyticsQuery.data}>
            <span className="material-symbols-outlined text-base" aria-hidden="true">download</span>
            CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={handlePdf} loading={pdfBusy} disabled={!analyticsQuery.data}>
            <span className="material-symbols-outlined text-base" aria-hidden="true">download</span>
            PDF
          </Button>
        </div>
      </div>

      <p className="mt-2 text-xs text-ink-muted">{rangeLabel}</p>

      {analyticsQuery.isError && !analyticsQuery.data ? (
        <div className="mt-8">
          <ErrorState message="Couldn't load analytics right now." onRetry={analyticsQuery.refetch} />
        </div>
      ) : analyticsQuery.isLoading ? (
        <LoadingGrid />
      ) : (
        <div className="mt-6 flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label="Visitors (sessions)"
              value={data.kpis.visitors.current}
              previous={data.kpis.visitors.previous}
              icon="visibility"
              spark={traffic.map((row) => row.visitors)}
            />
            <StatCard
              label="Page views"
              value={data.kpis.views.current}
              previous={data.kpis.views.previous}
              icon="insights"
              spark={traffic.map((row) => row.views)}
            />
            <StatCard
              label="New members"
              value={data.kpis.signups.current}
              previous={data.kpis.signups.previous}
              icon="person"
              spark={data.signups.map((row) => row.count)}
            />
            <StatCard
              label="Quiz plays"
              value={data.kpis.quizPlays.current}
              previous={data.kpis.quizPlays.previous}
              icon="quiz"
              hint={`${data.kpis.quizPlays.players.toLocaleString()} players joined`}
              spark={data.engagement.map((row) => row.quiz)}
            />
            <StatCard
              label="CBT attempts"
              value={data.kpis.cbtAttempts.current}
              previous={data.kpis.cbtAttempts.previous}
              icon="assignment"
              hint={`Average score ${data.kpis.cbtAttempts.averageScore}%`}
              spark={data.engagement.map((row) => row.cbt)}
            />
            <StatCard
              label="Form responses"
              value={data.kpis.formResponses.current}
              previous={data.kpis.formResponses.previous}
              icon="checklist"
              spark={data.engagement.map((row) => row.forms)}
            />
            <StatCard
              label="Email opt-in"
              value={data.kpis.optInRate.optedIn}
              icon="campaign"
              format={(n) => n.toLocaleString()}
              showDelta={false}
              hint={`${percentLabel(data.kpis.optInRate.current)} of ${data.kpis.optInRate.total.toLocaleString()} members can be emailed`}
            />
          </div>

          {!hasTraffic(data) && (
            <div className="flex items-start gap-3 rounded-lg border border-hairline bg-surface-low p-4 text-sm text-ink-muted">
              <span className="material-symbols-outlined text-base text-brand" aria-hidden="true">info</span>
              <p>
                No page views are recorded for this period yet. Views start counting from the moment the
                tracker ships, which means an empty traffic chart here is expected rather than broken.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <TrafficChart rows={traffic} />
            </div>
            <SignupChart rows={data.signups} />
            <EngagementChart rows={data.engagement} />
            <TopContentPanel rows={data.topContent} />
            <AwardChart rows={data.awards} />
            <EmailReachChart optedIn={data.email.optedIn} optedOut={data.email.optedOut} />
            <div className="flex flex-col gap-5">
              <AttentionPanel attention={data.attention} isOwner={isOwner} />
              <QuickActionsPanel />
            </div>
            <div className="lg:col-span-2">
              <ActivityFeed rows={data.activity} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
