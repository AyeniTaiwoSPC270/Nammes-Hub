import { useState } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { useOwnAdminRowQuery } from '../../data/admins'
import { useAllUsersQuery } from '../../data/users'
import { useAuditLogQuery, useErrorLogQuery, useSentryIssuesQuery } from '../../data/systemLogs'
import Table from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonTable } from '../../components/ui/Skeleton'

const SECTIONS = [
  { id: 'activity', label: 'Activity' },
  { id: 'server', label: 'Server errors' },
  { id: 'app', label: 'App errors' },
]

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

export default function AdminSystem() {
  const { user } = useAuth()
  const adminRow = useOwnAdminRowQuery(user.id)
  const isOwner = Boolean(adminRow.data?.is_owner)
  const [section, setSection] = useState('activity')

  const usersQuery = useAllUsersQuery()
  const auditQuery = useAuditLogQuery(isOwner && section === 'activity')
  const errorQuery = useErrorLogQuery(isOwner && section === 'server')
  const sentryQuery = useSentryIssuesQuery(isOwner && section === 'app')

  const names = new Map((usersQuery.data ?? []).map((u) => [u.user_id, u.full_name || u.student_id]))
  const active = { activity: auditQuery, server: errorQuery, app: sentryQuery }[section]

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
