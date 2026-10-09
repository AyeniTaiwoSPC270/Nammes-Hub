import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useAcademicCalendarQuery,
  useCalendarSettingsQuery,
  useUpdateCalendarSettingsMutation,
} from '../../data/calendar'
import { useAuth } from '../../lib/AuthContext'
import { useOwnAdminRowQuery } from '../../data/admins'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import ErrorState from '../../components/ui/ErrorState'
import FormField from '../../components/ui/FormField'
import { SkeletonText } from '../../components/ui/Skeleton'
import { useToast } from '../../lib/ToastContext'

// The seeded session writes its label with a slash ("2026/2027", 20261009090000_calendar.sql:77). `session`
// is unconstrained free text in the database, so this only normalises the shape the admin is nudged into
// rather than validating anything -- rejecting a label the database would have accepted would be a worse
// bug than accepting an odd one.
function normalizeSession(value) {
  return (value || '').trim().replace(/\s*\/\s*/g, '/')
}

// Every distinct session in the table, with how many rows carry it. This is what makes "archive" honest:
// the screen can say how many dates are about to drop off the public page, and can offer a previous session
// as a one-click way back, instead of describing an archive it cannot name.
function useSessionCounts() {
  const entriesQuery = useAcademicCalendarQuery()
  const counts = useMemo(() => {
    const map = new Map()
    for (const row of entriesQuery.data ?? []) {
      map.set(row.session, (map.get(row.session) ?? 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [entriesQuery.data])
  return { counts, isLoading: entriesQuery.isLoading, isError: entriesQuery.isError, refetch: entriesQuery.refetch }
}

export default function AdminCalendarSession() {
  const toast = useToast()
  const { user } = useAuth()
  const adminRowQuery = useOwnAdminRowQuery(user?.id)
  const isOwner = Boolean(adminRowQuery.data?.is_owner)
  const settingsQuery = useCalendarSettingsQuery()
  const { counts, isLoading: countsLoading, isError: countsError, refetch } = useSessionCounts()

  const activeSession = settingsQuery.data?.active_session ?? ''
  const [draft, setDraft] = useState('')
  // null means nothing is being confirmed; a string is the session whose activation is one click away.
  const [confirming, setConfirming] = useState(null)

  const saveMutation = useUpdateCalendarSettingsMutation()

  const nextSession = normalizeSession(draft)
  const knownSessions = counts.map(([session]) => session)
  const trimmed = draft.trim()

  function activate(session) {
    saveMutation.mutate(
      { active_session: session },
      {
        onSuccess: () => {
          toast.success(`${session} is now the active session.`)
          setConfirming(null)
          setDraft('')
        },
        onError: (error) => toast.error(error.message),
      },
    )
  }

  if (settingsQuery.isError && !settingsQuery.data) {
    return (
      <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load the calendar settings right now." onRetry={settingsQuery.refetch} />
      </div>
    )
  }

  const pending = saveMutation.isPending

  return (
    <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-ink-900">Calendar Session</h1>
      <p className="mt-1 text-ink-muted">
        The public calendar shows one session at a time. Change which one, and the previous session's dates
        come off the public page.
      </p>

      {settingsQuery.isLoading ? (
        <div className="mt-6">
          <SkeletonText lines={5} />
        </div>
      ) : (
        <>
          <section className="mt-6 rounded-lg border border-hairline bg-surface p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-ink-900">Active session</h2>
            <p className="mt-1 text-sm text-ink-muted">
              This is the session <code className="font-mono">{activeSession || '—'}</code>. The public
              calendar reads only its rows.
            </p>
              </div>
              <Badge tone="updated">{activeSession || 'Not set'}</Badge>
            </div>
            {/* calendar_settings is owner-write and has no review-queue path of its own: submit_change_request
                only understands news, events and award_season (awards_and_roles.sql:279, :347-379), so there
                is nowhere for a non-owner's request to queue. Saying so up front beats letting them press the
                button and read "No changes were saved" as a broken screen. */}
            {!isOwner && (
              <p className="mt-3 text-sm text-ink-muted">
                Only the owner can change the active session. Ask them to switch it here — a non-owner pressing
                the button would be refused by the database.
              </p>
            )}
          </section>

          {/* What "archive" does here, said out loud. There is no archived flag on academic_calendar
              (20261009090000_calendar.sql:15-33) and none was invented: archiving means pointing
              calendar_settings.active_session somewhere else. The previous session's rows are untouched and
              still editable in the entries screen -- they simply stop being the ones the public page shows. */}
          <section className="mt-6 rounded-lg border border-hairline bg-surface-low p-5">
            <h2 className="text-lg font-bold text-ink-900">Archiving the previous session</h2>
            <p className="mt-2 text-sm text-ink-muted">
              There is no archived flag on a calendar date, so nothing is hidden or deleted when you archive.
              Setting a new active session simply moves the public calendar to it. Every date in the previous
              session stays in the table and stays editable on the{' '}
              <Link to="/admin/calendar" className="font-semibold text-brand hover:underline">
                calendar entries
              </Link>{' '}
              screen — the same session can be made active again later, with no data to restore.
            </p>
          </section>

          <form
            className="mt-6 flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-5 shadow-sm"
            onSubmit={(event) => {
              event.preventDefault()
              setConfirming(nextSession)
            }}
          >
            <h2 className="text-lg font-bold text-ink-900">Start a new session</h2>
            <FormField
              label="Session"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="2027/2028"
              helper="Formatted like 2026/2027. Dates are not moved or copied — add the new session's dates on the entries screen afterwards."
              required
            />

            {confirming === nextSession && nextSession !== '' ? (
              <div className="flex flex-col gap-3 rounded-md border border-danger bg-danger-bg p-4 dark:bg-danger/15">
                <p className="text-sm font-semibold text-danger">
                  Make {nextSession} the active session? {activeSession && `${activeSession} will stop being shown on the public calendar.`}
                  {counts.find(([session]) => session === nextSession)
                    ? ` It already has ${counts.find(([session]) => session === nextSession)[1]} dates on file.`
                    : ' No dates have been added for it yet, so the public calendar will be empty until you add some.'}
                </p>
                <div className="flex shrink-0 flex-wrap gap-3">
                  <Button variant="destructive" size="sm" loading={pending} onClick={() => activate(nextSession)}>
                    Yes, switch to {nextSession}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirming(null)} disabled={pending}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <Button type="submit" disabled={trimmed === '' || nextSession === activeSession || !isOwner}>
                  {nextSession === activeSession && trimmed !== ''
                    ? 'That is already the active session'
                    : isOwner
                      ? 'Set active session'
                      : 'Owner only'}
                </Button>
              </div>
            )}
          </form>

          <section className="mt-6">
            <h2 className="text-lg font-bold text-ink-900">Sessions with dates</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Every session in the table, newest label first. Switch to any of them in one click — the
              confirm step still applies.
            </p>

            {countsError && !counts.length ? (
              <div className="mt-4">
                <ErrorState message="Couldn't count the calendar dates right now." onRetry={refetch} />
              </div>
            ) : countsLoading ? (
              <div className="mt-4">
                <SkeletonText lines={3} />
              </div>
            ) : counts.length === 0 ? (
              <p className="mt-4 text-sm text-ink-muted">No calendar dates have been added yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-hairline overflow-hidden rounded-md border border-hairline">
                {counts.map(([session, count]) => (
                  <li key={session} className="flex flex-wrap items-center justify-between gap-3 bg-surface px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-ink-900">{session}</span>
                      {session === activeSession && <Badge tone="updated">Active</Badge>}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm text-ink-muted">
                        {count} {count === 1 ? 'date' : 'dates'}
                      </span>
                      {session === activeSession ? (
                        <span className="text-sm text-ink-muted">Showing on /calendar</span>
                      ) : confirming === session ? (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            loading={pending}
                            onClick={() => activate(session)}
                          >
                            Confirm switch to {session}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setConfirming(null)} disabled={pending}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setConfirming(session)}
                          disabled={pending || !isOwner}
                        >
                          Make active
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {knownSessions.length > 0 && (
              <p className="mt-3 text-xs text-ink-muted">
                Sessions on file: {knownSessions.join(', ')}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  )
}
