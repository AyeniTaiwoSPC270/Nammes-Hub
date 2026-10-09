// Paste a senate calendar as plain text, read it into rows, correct it, then write it.
// Spec: docs/superpowers/specs/2026-10-08-academic-calendar-design.md §5.2, §7
//
// The parser (api/_lib/calendarPaste.js) is deliberately incurious: it will not guess a `kind`, and every line it
// cannot read comes back as a warning rather than a silently dropped row. This screen is where that promise is kept.
// It writes nothing until the admin presses the button, it renders every warning in full, and it says how many
// dates it is about to add before it adds them.
import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import FormField from '../../components/ui/FormField'
import EmptyState from '../../components/ui/EmptyState'
import { useToast } from '../../lib/ToastContext'
import { useAuth } from '../../lib/AuthContext'
import { useOwnAdminRowQuery } from '../../data/admins'
import { useAcademicCalendarQuery, useCalendarSettingsQuery } from '../../data/calendar'
import { submitChangeRequest } from '../../data/changeRequests'
import { supabase } from '../../lib/supabaseClient'
import { generateId } from '../../lib/adminFields'
import { parseCalendarPaste } from '../../../api/_lib/calendarPaste.js'
import { KIND_ORDER } from '../../../api/_lib/calendarTheme.js'

// A senate calendar is two pages. 400 rows is three orders of magnitude past that and exists so a pasted
// spreadsheet of every department's timetable cannot quietly become 4,000 calendar rows one insert at a time.
// The cap is checked on the parsed row count, not the line count, because a line the parser cannot read is
// already a warning and costs nothing.
const MAX_ROWS = 400
// Parsing runs on every keystroke so the preview is live, so the input itself is bounded too. 100k characters is
// several thousand lines: far past a PDF, far below anything that would make a keystroke stutter.
const MAX_PASTE_CHARS = 100_000
// academic_calendar.remind_days is `check (remind_days is null or remind_days between 0 and 30)`
// (20261009090000_calendar.sql:25), so the box offers the same range rather than a way to fail.
const REMIND_MIN = 0
const REMIND_MAX = 30

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const input =
  'min-h-10 w-full rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-ink-900 focus:border-brand focus:outline-none'
const selectInput = `${input} sm:w-40`

// Written out rather than formatted with toLocaleDateString: the admin reads this date back against the PDF
// they pasted, so the shape has to be the same everywhere rather than following a device locale.
function formatDay(key) {
  if (!key) return null
  const [year, month, day] = String(key).split('-').map(Number)
  return `${day} ${MONTHS[month - 1]} ${year}`
}

function rangeLabel(row) {
  const start = formatDay(row.startsAt)
  if (!start) return 'To be determined'
  const end = formatDay(row.endsAt)
  return end && end !== start ? `${start} – ${end}` : start
}

// The anchor a duplicate is judged on. The source document prints 2027-03-08 twice with two different titles
// ("Resumption for Second Semester" and "Resumption / Commencement of Lectures"), so exact-title matching would
// miss the very case this screen exists for. The first real word catches it and leaves alone the pairs that
// legitimately share a date -- 57th Convocation Ceremonies and First Semester break both start on 22 Feb 2027.
function anchorWord(title) {
  const match = /[a-z]{3,}/i.exec(String(title ?? ''))
  return match ? match[0].toLowerCase() : String(title ?? '').trim().toLowerCase()
}

function rowKey(row, index) {
  return `${index}|${row.startsAt ?? 'undated'}|${row.endsAt ?? ''}|${row.title}`
}

// Every row after the first to claim a date+anchor pair is flagged against the row it repeats. Undated rows are
// left out: the senate prints two "To be determined" entries with nothing to compare, and a row with no date is
// shown in its own TBA panel where a double entry is visible anyway.
function flagDuplicates(rows) {
  const claimed = new Map()
  return rows.map((row, index) => {
    if (!row.startsAt) return { ...row, duplicateOf: null }
    const anchor = anchorWord(row.title)
    const key = `${row.startsAt}|${anchor}`
    const first = claimed.get(key)
    if (first === undefined) {
      claimed.set(key, index)
      return { ...row, duplicateOf: null }
    }
    return { ...row, duplicateOf: first }
  })
}

// Empty is not zero: the reminder worker skips NULL rows and sends on 0 (spec §9), so the two states have to stay
// distinguishable all the way to the column. Out-of-range and non-integer values are refused rather than clamped,
// because a silently corrected reminder is a reminder nobody chose.
function readRemind(value) {
  if (value === '' || value === null || value === undefined) return { days: null }
  const days = Number(value)
  if (!Number.isInteger(days) || days < REMIND_MIN || days > REMIND_MAX) {
    return { error: `Reminder must be a whole number of days from ${REMIND_MIN} to ${REMIND_MAX}.` }
  }
  return { days }
}

// generateId already appends six random characters, so a collision is improbable -- but "improbable" is not a
// primary key policy, so every id is checked against the ids on file and against the ones minted earlier in this
// same batch before it is used.
function mintIds(rows, taken) {
  const used = new Set(taken)
  return rows.map((row) => {
    const base = generateId(row.title)
    let id = base
    let attempt = 1
    while (used.has(id)) {
      id = `${base}-${++attempt}`
    }
    used.add(id)
    return id
  })
}

export function CalendarPasteBody() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const adminRowQuery = useOwnAdminRowQuery(user?.id)
  const isOwner = Boolean(adminRowQuery.data?.is_owner)
  // academic_calendar's insert policy is owner-only (20261009090000_calendar.sql:111-114) and apply_change_request
  // carries an academic_calendar branch (20261009100000_calendar_review_queue.sql:69-86), so a non-owner admin
  // queues instead of writing. Same posture as academicCalendarConfig.js reviewGated.
  const gated = !isOwner

  const settingsQuery = useCalendarSettingsQuery()
  const existingQuery = useAcademicCalendarQuery()
  const existingRows = useMemo(() => existingQuery.data ?? [], [existingQuery.data])
  const existingIds = useMemo(() => existingRows.map((row) => row.id), [existingRows])

  const [text, setText] = useState('')
  const [sessionDraft, setSessionDraft] = useState('')
  const [semester, setSemester] = useState(1)
  // Per-row corrections, keyed by rowKey so a re-parse of the same text keeps what the admin already typed.
  // Absent means "the default for that row", which is why a cleared correction reverts rather than sticking.
  const [edits, setEdits] = useState({})
  const [confirming, setConfirming] = useState(false)
  const [report, setReport] = useState(null)

  const session = sessionDraft.trim() || (settingsQuery.data?.active_session ?? '').trim()

  const tooLong = text.length > MAX_PASTE_CHARS
  const parsed = useMemo(() => {
    if (tooLong) return { rows: [], warnings: [] }
    return parseCalendarPaste(text, { session, semester })
  }, [text, session, semester, tooLong])
  const rows = useMemo(() => flagDuplicates(parsed.rows), [parsed.rows])
  const warnings = parsed.warnings
  const overCap = rows.length > MAX_ROWS

  const view = rows.map((row, index) => {
    const key = rowKey(row, index)
    const edit = edits[key] ?? {}
    return {
      ...row,
      key,
      kind: KIND_ORDER.includes(edit.kind) ? edit.kind : 'other',
      remind: edit.remind ?? '',
      // A flagged duplicate starts unchecked. It is not removed -- one click brings it back for a paste where
      // the same date really is printed twice on purpose.
      include: edit.include ?? row.duplicateOf === null,
      duplicateOf: row.duplicateOf,
    }
  })
  const selected = view.filter((row) => row.include)
  const duplicateCount = view.filter((row) => row.duplicateOf !== null).length

  const badReminders = selected
    .map((row) => ({ row, error: readRemind(row.remind).error }))
    .filter((entry) => entry.error)

  const commit = useMutation({
    mutationFn: async ({ payloads, queued }) => {
      if (queued) {
        // The review queue has no batch call: submit_change_request takes one row at a time, so a non-owner paste
        // is the one path here that cannot be atomic. Each result is therefore tracked and reported, never
        // summarised as "done" — the pending queue holds what actually arrived.
        const queuedRows = []
        const failed = []
        for (const payload of payloads) {
          try {
            await submitChangeRequest('academic_calendar', 'insert', null, payload)
            queuedRows.push(payload)
          } catch (error) {
            failed.push({ title: payload.title, message: error?.message ?? 'the request was refused' })
          }
        }
        return { queued: queuedRows.length, failed }
      }
      // One statement, so Postgres runs it in one transaction: a row that violates a CHECK constraint or a
      // duplicate id rolls the whole batch back and returns no rows. That is the all-or-nothing guarantee —
      // there is no loop here to leave the calendar half-written.
      const { data, error } = await supabase.from('academic_calendar').insert(payloads).select('id')
      if (error) throw error
      if (!data || data.length !== payloads.length) {
        throw new Error(
          `Only ${data?.length ?? 0} of ${payloads.length} dates came back from the calendar, so nothing is assumed to have been saved. Reload the entries screen and check what is there.`,
        )
      }
      return { written: data.length, failed: [] }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['academic_calendar'] })
      queryClient.invalidateQueries({ queryKey: ['change_requests'] })
      setConfirming(false)
      setEdits({})
      if (result.failed.length === 0) {
        setReport(null)
        setText('')
        toast.success(
          `Added ${result.written} ${result.written === 1 ? 'date' : 'dates'} to the calendar.`,
        )
        return
      }
      // Only the refusals stay on screen. The queued rows are already in the review queue and clearing the
      // textarea would hide which they were, so the report names what failed and the admin re-pastes that.
      setText(
        result.failed.map((entry) => entry.title).join('\n'),
      )
      setReport({
        queued: result.queued,
        failed: result.failed,
      })
      toast.error(`${result.queued} queued for review, ${result.failed.length} refused. Nothing else was written.`)
    },
    onError: (error) => {
      // saveCalendarEntry and the insert above both report the real reason: an RLS refusal, a missing session or
      // a check-constraint violation. A generic "could not save" here would hide which.
      toast.error(error?.message ?? 'Nothing was saved.')
    },
  })

  function edit(key, patch) {
    setEdits((prev) => ({ ...prev, [key]: { ...(prev[key] ?? {}), ...patch } }))
  }

  function prepare() {
    const ids = mintIds(selected, existingIds)
    const payloads = selected.map((row, index) => {
      const { days } = readRemind(row.remind)
      return {
        id: ids[index],
        session,
        semester: row.semester,
        title: row.title,
        kind: row.kind,
        starts_at: row.startsAt,
        ends_at: row.endsAt,
        note: row.note,
        remind_days: days,
      }
    })
    return payloads
  }

  const canCommit =
    selected.length > 0 && session !== '' && badReminders.length === 0 && !overCap && !tooLong && !commit.isPending

  // The heading, the description and the page padding belong to the tab shell
  // (AdminCalendar.jsx), which owns them for all four screens — otherwise switching tabs
  // re-announces a different h1 and the tab strip is the only thing saying where you are.
  return (
    <>
      <section className="rounded-lg border border-hairline bg-surface p-5 shadow-sm" aria-label="Calendar text">
        <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <FormField
            label="Pasted calendar"
            type="textarea"
            rows={10}
            value={text}
            maxLength={MAX_PASTE_CHARS}
            onChange={(event) => setText(event.target.value)}
            placeholder={'Monday, October 5, 2026* Payment of Fees & Online Registration\nMonday, December 7 - Sunday, December 20, 2026 Editing of Registered Courses\n(2 weeks)\nTo be determined Orientation Programme for Fresh Students'}
            helper="Straight out of the PDF is fine. Mangled dashes, missing commas and page furniture are all handled."
          />
          <div className="flex flex-col justify-end gap-3">
            <FormField
              label="Session"
              value={sessionDraft}
              onChange={(event) => setSessionDraft(event.target.value)}
              placeholder={settingsQuery.data?.active_session ?? '2026/2027'}
              helper={session === '' ? 'Required — these dates would have no session to belong to.' : `Saved as ${session}.`}
              error={session === '' ? 'A session is required.' : undefined}
            />
            <FormField
              label="Semester"
              type="select"
              value={String(semester)}
              onChange={(event) => setSemester(Number(event.target.value))}
              options={['1', '2']}
              helper="Applies to every row in this paste."
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              navigator.clipboard
                ?.readText()
                .then((value) => setText(value))
                .catch(() => toast.error("Couldn't read the clipboard — paste into the box instead."))
            }}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              content_copy
            </span>
            Paste from clipboard
          </Button>
          {text !== '' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setText('')
                setEdits({})
                setReport(null)
              }}
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                delete
              </span>
              Clear
            </Button>
          )}
          <span className="text-sm text-ink-muted">
            {text.trim() === '' ? 'Nothing pasted yet.' : `${rows.length} ${rows.length === 1 ? 'date' : 'dates'} read`}
          </span>
        </div>
      </section>

      {report && (
        <section
          className="mt-6 rounded-lg border border-danger bg-danger-bg p-5 dark:bg-danger/15"
          aria-label="Result of the last commit"
        >
          <h2 className="text-lg font-bold text-danger">
            {report.queued} {report.queued === 1 ? 'date is' : 'dates are'} queued for review, {report.failed.length}{' '}
            {report.failed.length === 1 ? 'was' : 'were'} refused
          </h2>
          <p className="mt-1 text-sm text-danger">
            The queued {report.queued === 1 ? 'row is' : 'rows are'} on the reviews screen and have not touched the
            public calendar. The refused ones are still listed below — nothing was written either way.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {report.failed.map((entry) => (
              <li key={entry.title} className="rounded-md bg-surface px-3 py-2 text-sm">
                <span className="font-semibold text-ink-900">{entry.title}</span>
                <span className="block text-danger">{entry.message}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Link to="/admin/reviews" className="text-sm font-semibold text-brand hover:underline">
              See the queued requests
            </Link>
          </div>
        </section>
      )}

      {tooLong && (
        <section className="mt-6 rounded-lg border border-danger bg-danger-bg p-5 dark:bg-danger/15">
          <h2 className="text-lg font-bold text-danger">That paste is too long to read</h2>
          <p className="mt-1 text-sm text-danger">
            It is {text.length.toLocaleString()} characters and this screen reads up to{' '}
            {MAX_PASTE_CHARS.toLocaleString()}. Paste the senate calendar itself, one session at a time.
          </p>
        </section>
      )}

      {overCap && (
        <section className="mt-6 rounded-lg border border-danger bg-danger-bg p-5 dark:bg-danger/15">
          <h2 className="text-lg font-bold text-danger">Too many dates to add at once</h2>
          <p className="mt-1 text-sm text-danger">
            This paste reads as {rows.length} dates, over the {MAX_ROWS} this screen will write in one go. Split it
            into one session or one semester per paste.
          </p>
        </section>
      )}

      {text.trim() !== '' && !tooLong && rows.length === 0 && warnings.length === 0 && (
        <div className="mt-6">
          <EmptyState
            icon="event"
            title="No dates found in that text"
            description="Nothing here looks like a senate line. Check the session year is in the pasted text — a date with no year is reported as a warning below, not read as one."
          />
        </div>
      )}

      {rows.length > 0 && (
        <section className="mt-8" aria-label="Preview">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-bold text-ink-900">Preview</h2>
            <p className="text-sm text-ink-muted">
              {selected.length} of {view.length} {view.length === 1 ? 'row' : 'rows'} will be added
              {duplicateCount > 0 && ` · ${duplicateCount} ${duplicateCount === 1 ? 'looks' : 'look'} like a repeat, unchecked`}
            </p>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            Set the kind on each row. The parser does not guess one — reading &ldquo;Editing of Registered
            Courses&rdquo; as a registration is your call, not a regex&rsquo;s.
          </p>

          <ul className="mt-4 flex flex-col gap-2">
            {view.map((row) => {
              const repeatOf = row.duplicateOf !== null ? view[row.duplicateOf] : null
              return (
                <li
                  key={row.key}
                  className={[
                    'rounded-md border bg-surface px-4 py-3',
                    row.include ? 'border-hairline' : 'border-hairline bg-surface-low opacity-70',
                  ].join(' ')}
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={row.include}
                        onChange={(event) => edit(row.key, { include: event.target.checked })}
                        className="mt-1 h-4 w-4 shrink-0 accent-orange-500"
                        aria-label={`Add ${row.title}`}
                      />
                      <span className="min-w-0">
                        <span className="block font-semibold text-ink-900">{row.title}</span>
                        <span className="block text-sm text-ink-muted">
                          {rangeLabel(row)}
                          {row.note ? ` · ${row.note}` : ''}
                        </span>
                      </span>
                    </label>

                    <div className="flex w-full shrink-0 gap-2 sm:w-auto">
                      <label className="flex-1 sm:flex-none">
                        <span className="sr-only">Kind for {row.title}</span>
                        <select
                          value={row.kind}
                          onChange={(event) => edit(row.key, { kind: event.target.value })}
                          className={selectInput}
                          disabled={!row.include}
                        >
                          {KIND_ORDER.map((kind) => (
                            <option key={kind} value={kind}>
                              {kind}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="w-24 sm:w-28">
                        <span className="sr-only">Reminder days for {row.title}</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={REMIND_MIN}
                          max={REMIND_MAX}
                          value={row.remind}
                          onChange={(event) => edit(row.key, { remind: event.target.value })}
                          placeholder="none"
                          className={input}
                          disabled={!row.include}
                          aria-label={`Reminder days for ${row.title}`}
                        />
                      </label>
                    </div>
                  </div>

                  {row.duplicateOf !== null && (
                    <p className="mt-2 flex items-start gap-2 rounded-sm bg-warning-bg px-3 py-2 text-sm text-warning dark:bg-warning/15">
                      <span className="material-symbols-outlined text-base" aria-hidden="true">
                        info
                      </span>
                      <span>
                        {repeatOf ? `"${repeatOf.title}" on ` : ''}
                        {rangeLabel(repeatOf ?? row)} says the same thing. Unchecked so it is not added twice — tick
                        it if the senate really printed it twice.
                      </span>
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {warnings.length > 0 && (
        <section className="mt-8" aria-label="Lines that could not be read">
          <h2 className="text-xl font-bold text-ink-900">
            {warnings.length} {warnings.length === 1 ? 'line' : 'lines'} could not be read
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            These lines are <strong className="font-semibold text-warning">not</strong> being added. Fix them in the
            source document and paste again — a line you cannot read must never look like one that was imported.
          </p>
          <ul className="mt-4 flex flex-col gap-2">
            {warnings.map((warning) => (
              <li
                key={`${warning.line}-${warning.text}`}
                className="rounded-md border border-warning bg-warning-bg px-4 py-3 dark:bg-warning/15"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="material-symbols-outlined text-base text-warning" aria-hidden="true">
                    error_outline
                  </span>
                  <span className="font-mono text-xs font-semibold uppercase tracking-[.05em] text-warning">
                    Line {warning.line}
                  </span>
                  <span className="text-sm font-semibold text-warning">{warning.reason}</span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap break-words font-mono text-sm text-ink-900">
                  {warning.text.trim() === '' ? `(blank)` : warning.text}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rows.length > 0 && (
        <section className="mt-8 border-t border-hairline pt-6" aria-label="Commit">
          {badReminders.length > 0 && (
            <ul className="mb-4 flex flex-col gap-2">
              {badReminders.map((entry) => (
                <li key={entry.row.key} className="rounded-md bg-danger-bg px-4 py-3 text-sm text-danger dark:bg-danger/15">
                  <span className="font-semibold">{entry.row.title}</span> — {entry.error}
                </li>
              ))}
            </ul>
          )}

          {gated && (
            <p className="mb-4 text-sm text-ink-muted">
              Your account is not the owner, so each row is sent to the{' '}
              <Link to="/admin/reviews" className="font-semibold text-brand hover:underline">
                review queue
              </Link>{' '}
              instead of being written. The owner approves them there, one at a time.
            </p>
          )}

          {confirming ? (
            <div className="flex flex-col gap-3 rounded-md border border-brand bg-surface-low p-4">
              <p className="text-sm font-semibold text-ink-900">
                About to add {selected.length} {selected.length === 1 ? 'date' : 'dates'} to {session}, semester{' '}
                {semester}.
                {warnings.length > 0 && ` ${warnings.length} unread ${warnings.length === 1 ? 'line' : 'lines'} will not be added.`}
              </p>
              <div className="flex shrink-0 flex-wrap gap-3">
                <Button
                  variant="primary"
                  size="sm"
                  loading={commit.isPending}
                  onClick={() => commit.mutate({ payloads: prepare(), queued: gated })}
                >
                  {gated ? 'Yes, queue them for review' : `Yes, add ${selected.length}`}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={commit.isPending}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <Button onClick={() => setConfirming(true)} disabled={!canCommit}>
                {session === ''
                  ? 'Set a session first'
                  : selected.length === 0
                    ? 'Nothing checked'
                    : `Review ${selected.length} ${selected.length === 1 ? 'date' : 'dates'}`}
              </Button>
              <span className="text-sm text-ink-muted">
                {selected.length} of {view.length} checked
                {duplicateCount > 0 && ` · ${duplicateCount} unchecked as possible repeats`}
              </span>
              {duplicateCount > 0 && <Badge tone="neutral">{duplicateCount} possible repeat</Badge>}
            </div>
          )}
        </section>
      )}
    </>
  )
}

