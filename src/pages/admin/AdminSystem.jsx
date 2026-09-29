import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../lib/AuthContext'
import { useOwnAdminRowQuery } from '../../data/admins'
import { useAllUsersQuery } from '../../data/users'
import {
  useAuditLogQuery,
  useErrorLogQuery,
  useSentryIssuesQuery,
  fetchErrorLog,
  fetchSentryIssues,
  runServerTest,
  useFeatureFlagsQuery,
  setFeatureFlag,
} from '../../data/systemLogs'
import { sendTestError } from '../../lib/errorTracking'
import Table from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonTable } from '../../components/ui/Skeleton'

const SECTIONS = [
  { id: 'switches', label: 'Switches' },
  { id: 'activity', label: 'Activity' },
  { id: 'server', label: 'Server errors' },
  { id: 'app', label: 'App errors' },
]

const SWITCH_INFO = {
  voting: 'Award voting',
  nominations: 'Award nominations',
  uploads: 'Member file uploads (admins are not affected)',
  broadcasts: 'Email broadcasts',
  public_forms: 'Contact form and public form responses',
  require_admin_mfa: 'Require two-factor login for admin powers',
}

function SwitchesPanel({ query }) {
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(null)
  const [busyKey, setBusyKey] = useState(null)
  const [error, setError] = useState('')

  async function change(key, enabled) {
    setBusyKey(key)
    setError('')
    try {
      await setFeatureFlag(key, enabled)
      await queryClient.invalidateQueries({ queryKey: ['system', 'flags'] })
    } catch (e) {
      setError(e.message || 'Could not change that switch')
    } finally {
      setBusyKey(null)
      setConfirming(null)
    }
  }

  if (query.isLoading) return <SkeletonTable columns={3} rows={4} />
  if (query.isError) return <ErrorState message={query.error?.message || 'Could not load the switches.'} onRetry={query.refetch} />

  return (
    <div className="max-w-[720px]">
      <p className="text-ink-muted">
        Pause a feature for everyone if something goes wrong. Turning a switch back on restores it immediately.
      </p>
      {error && <p className="mt-3 rounded-sm bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}
      <ul className="mt-4 divide-y divide-hairline rounded-md border border-hairline">
        {(query.data ?? []).map((flag) => (
          <li key={flag.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium text-ink">{SWITCH_INFO[flag.key] || flag.key}</p>
              <p className="text-sm text-ink-muted">Changed {formatDateTime(flag.updated_at)}</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge tone={flag.enabled ? 'new' : 'restricted'}>{flag.enabled ? 'On' : 'Paused'}</Badge>
              {flag.enabled && confirming !== flag.key && (
                <Button variant="secondary" size="sm" onClick={() => setConfirming(flag.key)}>
                  Pause
                </Button>
              )}
              {flag.enabled && confirming === flag.key && (
                <>
                  <Button variant="primary" size="sm" loading={busyKey === flag.key} onClick={() => change(flag.key, false)}>
                    Confirm pause
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>
                    Cancel
                  </Button>
                </>
              )}
              {!flag.enabled && (
                <Button variant="primary" size="sm" loading={busyKey === flag.key} onClick={() => change(flag.key, true)}>
                  Turn on
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : '—'
}

// Shows a skeleton while loading, an error state on failure, and the empty message when there is nothing to list.
function Section({ query, rows, empty, children }) {
  if (query.isLoading) return <SkeletonTable columns={4} rows={4} />
  if (query.isError && !query.data) {
    return <ErrorState message={query.error?.message || 'Could not load this right now.'} onRetry={query.refetch} />
  }
  if (rows.length === 0) return <p className="text-ink-muted">{empty}</p>
  return <div className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-md">{children}</div>
}

// One click checks the whole chain: server can write the error log, the owner can read it back,
// the browser can deliver an error to Sentry, and the server can read Sentry's issue list.
function TestPanel() {
  const queryClient = useQueryClient()
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState([])

  async function run() {
    setRunning(true)
    const out = []
    const push = (ok, label) => {
      out.push({ ok, label })
      setResults([...out])
    }
    setResults([])

    try {
      await runServerTest()
      push(true, 'The server wrote a test entry to the error log.')
    } catch (error) {
      push(false, `Server error log: ${error.message}`)
    }

    try {
      const rows = await fetchErrorLog()
      const found = rows.some((r) => r.route === 'system-test')
      push(found, found ? 'The Server errors tab can read that entry back.' : 'The test entry was not found when reading the log back.')
    } catch (error) {
      push(false, `Could not read the server error log: ${error.message}`)
    }

    const sentry = await sendTestError()
    push(
      sentry.sent,
      sentry.sent
        ? `A test crash reached Sentry (event ${String(sentry.eventId).slice(0, 8)}). It can take up to a minute to appear under App errors.`
        : `Sentry did not receive the test crash. ${sentry.reason}`,
    )

    try {
      const result = await fetchSentryIssues()
      const count = result.issues.length
      push(
        result.configured,
        result.configured
          ? `The connection to Sentry works (${count} unresolved issue${count === 1 ? '' : 's'} in the last 14 days).`
          : 'The connection to Sentry is not set up. Add SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT in Vercel and redeploy.',
      )
    } catch (error) {
      push(false, `Sentry connection: ${error.message}`)
    }

    setRunning(false)
    queryClient.invalidateQueries({ queryKey: ['system'] })
  }

  return (
    <div className="mt-6 rounded-lg border border-hairline bg-surface p-4 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">Test the system</h2>
          <p className="text-sm text-ink-muted">
            Sends one harmless test error through the server log and Sentry, then reports what worked.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={run} disabled={running}>
          {running ? 'Testing…' : 'Send test error'}
        </Button>
      </div>
      {results.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {results.map((r, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-ink">
              <Badge tone={r.ok ? 'updated' : 'restricted'}>{r.ok ? 'Passed' : 'Failed'}</Badge>
              <span>{r.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function AdminSystem() {
  const { user } = useAuth()
  const adminRow = useOwnAdminRowQuery(user.id)
  const isOwner = Boolean(adminRow.data?.is_owner)
  const [section, setSection] = useState('switches')
  const flagsQuery = useFeatureFlagsQuery(isOwner && section === 'switches')

  const usersQuery = useAllUsersQuery()
  const auditQuery = useAuditLogQuery(isOwner && section === 'activity')
  const errorQuery = useErrorLogQuery(isOwner && section === 'server')
  const sentryQuery = useSentryIssuesQuery(isOwner && section === 'app')

  const names = new Map((usersQuery.data ?? []).map((u) => [u.user_id, u.full_name || u.student_id]))
  const active = { switches: flagsQuery, activity: auditQuery, server: errorQuery, app: sentryQuery }[section]

  if (adminRow.isLoading) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <SkeletonTable columns={4} rows={4} />
      </div>
    )
  }

  if (!isOwner) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-ink-900">System</h1>
        <p className="mt-2 text-ink-muted">Only the owner can view system logs.</p>
      </div>
    )
  }

  const auditRows = auditQuery.data ?? []
  const errorRows = errorQuery.data ?? []
  const issues = sentryQuery.data?.issues ?? []
  const sentryNotConfigured = sentryQuery.data && !sentryQuery.data.configured

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-ink-900">System</h1>
          <p className="mt-1 text-ink-muted">
            What admins changed, and what has gone wrong on the server and in the app.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => active.refetch()}>
          Refresh
        </Button>
      </div>

      <TestPanel />

      <div className="mt-6 flex flex-wrap gap-2" role="tablist">
        {SECTIONS.map((s) => (
          <Button
            key={s.id}
            role="tab"
            aria-selected={section === s.id}
            variant={section === s.id ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setSection(s.id)}
          >
            {s.label}
          </Button>
        ))}
      </div>

      <div className="mt-6">
        {section === 'switches' && <SwitchesPanel query={flagsQuery} />}

        {section === 'activity' && (
          <Section query={auditQuery} rows={auditRows} empty="No activity recorded yet.">
            <Table
              columns={['When', 'Who', 'Action', 'What']}
              rows={auditRows.map((r) => [
                formatDateTime(r.at),
                r.actor ? names.get(r.actor) || 'Unknown user' : 'System / server',
                <Badge key="a" tone={r.action === 'DELETE' ? 'restricted' : 'new'}>
                  {r.action}
                </Badge>,
                `${r.entity}${r.entity_id ? ` · ${r.entity_id}` : ''}`,
              ])}
            />
          </Section>
        )}

        {section === 'server' && (
          <Section query={errorQuery} rows={errorRows} empty="No server errors recorded. That is good news.">
            <Table
              columns={['When', 'Route', 'Status', 'Message']}
              rows={errorRows.map((r) => [
                formatDateTime(r.at),
                `/api/${r.route}`,
                r.status ?? '—',
                <p key="m" className="max-w-[520px] break-words">
                  {r.message}
                </p>,
              ])}
            />
          </Section>
        )}

        {section === 'app' &&
          (sentryNotConfigured ? (
            <p className="max-w-[640px] text-ink-muted">
              App errors come from Sentry, and the connection is not set up yet. Add SENTRY_AUTH_TOKEN, SENTRY_ORG and
              SENTRY_PROJECT in Vercel to see them here.
            </p>
          ) : (
            <Section query={sentryQuery} rows={issues} empty="No unresolved app errors in the last 14 days.">
              <Table
                columns={['Last seen', 'Error', 'Where', 'Times', 'People', 'Details']}
                rows={issues.map((i) => [
                  formatDateTime(i.lastSeen),
                  <p key="t" className="max-w-[360px] break-words">
                    {i.title}
                  </p>,
                  i.culprit || '—',
                  i.count,
                  i.userCount,
                  <a
                    key="l"
                    className="font-semibold text-orange-600 hover:underline"
                    href={i.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open
                  </a>,
                ])}
              />
            </Section>
          ))}
      </div>
    </div>
  )
}
