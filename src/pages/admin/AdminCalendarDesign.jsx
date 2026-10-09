// The Calendar Design Studio. Spec: docs/superpowers/specs/2026-10-08-academic-calendar-design.md §8
//
// The theme is a join of two public tables -- `calendar_settings.active_look_id` names the look, `calendar_looks.design`
// carries it -- so the screen edits a copy and writes the look, then points the settings row at it. Nothing here
// cleans a design itself: `sanitizeTheme` (api/_lib/calendarTheme.js) is the only judge, on the way into the editor,
// into the preview and into the row, which is what keeps the studio and the public calendar from disagreeing.
import { useEffect, useMemo, useState } from 'react'
import { fromDayKey, toDayKey } from '../../../api/_lib/calendarDates.js'
import { mergeCalendarSources } from '../../../api/_lib/calendarMerge.js'
import { DEFAULT_THEME, sanitizeTheme, themeVars } from '../../../api/_lib/calendarTheme.js'
import {
  useAcademicCalendarQuery,
  useCalendarLooksQuery,
  useCalendarSettingsQuery,
  useDeleteCalendarLookMutation,
  useSaveCalendarLookMutation,
  useUpdateCalendarSettingsMutation,
} from '../../data/calendar'
import { useEventsQuery } from '../../data/events'
import { useOwnAdminRowQuery } from '../../data/admins'
import { generateId } from '../../lib/adminFields'
import { useAuth } from '../../lib/AuthContext'
import { useTheme } from '../../lib/ThemeContext'
import { useToast } from '../../lib/ToastContext'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonText } from '../../components/ui/Skeleton'
import Toggle from '../../components/ui/Toggle'
import CalendarDesignControls from '../../components/calendar/CalendarDesignControls'
import CalendarLegend from '../../components/calendar/CalendarLegend'
import MonthGrid from '../../components/calendar/MonthGrid'
import NextUpStrip from '../../components/calendar/NextUpStrip'
import TbaPanel from '../../components/calendar/TbaPanel'

// The same four the public page shows above the grid (Calendar.jsx:36). Restated rather than exported because
// NextUpStrip is not the only thing that would have to change with it, and a preview that quietly drifted from the
// page would be worse than a number written twice.
const NEXT_UP_COUNT = 4

// The real day sheet is a fixed, scroll-locking dialog. Opening it over the preview would cover the controls the admin
// is comparing against, so the preview stops at the grid rather than faking the sheet's markup.
const ignoreDaySelect = () => {}

export function CalendarDesignBody() {
  const toast = useToast()
  const { theme: siteTheme } = useTheme()
  const { user } = useAuth()
  const adminRowQuery = useOwnAdminRowQuery(user?.id)
  const isOwner = Boolean(adminRowQuery.data?.is_owner)

  const settingsQuery = useCalendarSettingsQuery()
  const looksQuery = useCalendarLooksQuery()
  // Gated on the settings row so the academic rows are fetched once, for the session the calendar is actually on,
  // rather than once for every session and again for the right one.
  const academicQuery = useAcademicCalendarQuery(settingsQuery.data?.active_session, !settingsQuery.isLoading)
  const eventsQuery = useEventsQuery()

  const looks = looksQuery.data
  const activeLookId = settingsQuery.data?.active_look_id ?? null

  // `null` until the two rows have loaded, so the first paint cannot show the built-in default over a look that is
  // still on its way. `ready` gates the seed effect below rather than the render, so a slow refetch does not blank
  // the editor.
  const [draft, setDraft] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [seeded, setSeeded] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [previewDark, setPreviewDark] = useState(false)

  // Read off the local clock rather than toISOString(), for the reason Calendar.jsx:52 gives.
  const todayKey = toDayKey(new Date())

  const ready = looks !== undefined && settingsQuery.data !== undefined
  const selectedLook = (looks ?? []).find((look) => look.id === selectedId) ?? null
  const base = useMemo(() => sanitizeTheme(selectedLook?.design), [selectedLook])

  useEffect(() => {
    if (!ready || seeded) return
    setSeeded(true)
    // The editor opens on whatever the calendar is showing, so the screen starts from the truth rather than from a
    // default the admin then has to notice is not what visitors see.
    const startId = activeLookId ?? looks[0]?.id ?? null
    setSelectedId(startId)
    setDraft(sanitizeTheme(looks.find((look) => look.id === startId)?.design))
  }, [ready, seeded, activeLookId, looks])

  // What the calendar will paint, judged by the one function that judges it. The draft above stays raw: cleaning it
  // in place would drop an Advanced hex the moment another control was touched.
  const theme = useMemo(() => sanitizeTheme(draft), [draft])
  const dirty = Boolean(draft) && JSON.stringify(theme) !== JSON.stringify(base)

  const saveMutation = useSaveCalendarLookMutation()
  const deleteMutation = useDeleteCalendarLookMutation()
  const settingsMutation = useUpdateCalendarSettingsMutation()

  function selectLook(id) {
    if (id === selectedId) return
    if (dirty && !window.confirm('Discard the unsaved changes to this design?')) return
    setSelectedId(id)
    setDraft(sanitizeTheme((looks ?? []).find((look) => look.id === id)?.design))
    setRenamingId(null)
  }

  function handleSave() {
    if (!selectedLook) return
    saveMutation.mutate(
      { id: selectedLook.id, name: selectedLook.name, design: draft },
      {
        onSuccess: () => toast.success(`“${selectedLook.name}” saved.`),
        onError: (error) => toast.error(error.message),
      },
    )
  }

  function handleSaveAsNew(event) {
    event.preventDefault()
    const name = newName.trim()
    if (!name) return
    saveMutation.mutate(
      // Client-minted id, the same rule as an admin adding a resource row: saveCalendarLook is an upsert and the
      // table has no sequence to draw from.
      { id: generateId(name), name, design: draft },
      {
        onSuccess: (saved) => {
          setSelectedId(saved.id)
          setNewName('')
          toast.success(`Saved “${saved.name}”. It is not live until you make it the active design.`)
        },
        onError: (error) => toast.error(error.message),
      },
    )
  }

  function handleRename(event) {
    event.preventDefault()
    const name = renameValue.trim()
    if (!name || !selectedLook || renamingId === null) return
    saveMutation.mutate(
      // The design travels with the row, because calendar_looks is written whole: a rename that sent only the name
      // would have to read the row back first, and a rename is not worth a round trip that could land on a design
      // somebody else had just changed.
      { id: selectedLook.id, name, design: selectedLook.design },
      { onSuccess: () => toast.success('Design renamed.'), onError: (error) => toast.error(error.message) },
    )
    setRenamingId(null)
  }

  function handleDelete(id) {
    const look = (looks ?? []).find((row) => row.id === id)
    if (!look) return
    const alsoActive = id === activeLookId
    const question = alsoActive
      ? `Delete “${look.name}”? It is the design the public calendar is showing, so /calendar falls back to the built-in default until you make another design active.`
      : `Delete “${look.name}”? This cannot be undone.`
    if (!window.confirm(question)) return
    deleteMutation.mutate(id, {
      onSuccess: () => {
        // The pointer is cleared with the row. A settings row still naming a look that is gone renders as the default
        // theme with nothing on screen saying why, and the calendar would quietly look un-designed.
        if (alsoActive) settingsMutation.mutate({ active_look_id: null })
        if (id === selectedId) {
          setSelectedId(null)
          setDraft(sanitizeTheme(DEFAULT_THEME))
        }
        toast.success('Design deleted.')
      },
      onError: (error) => toast.error(error.message),
    })
  }

  function makeActive(id) {
    settingsMutation.mutate(
      { active_look_id: id },
      { onSuccess: () => toast.success('That design is now live on /calendar.'), onError: (error) => toast.error(error.message) },
    )
  }

  // ---- preview ----

  // Both sources, merged by the same module the public page merges them with. No window: the studio is showing what a
  // date looks like, not what a particular month of the session contains.
  const merged = useMemo(
    () => mergeCalendarSources({ academic: academicQuery.data ?? [], events: eventsQuery.data ?? [] }),
    [academicQuery.data, eventsQuery.data],
  )

  // The draft's own landing defaults, not the settings row's. The admin is editing the theme, and the settings row is
  // a separate copy of the same three settings that wins on the public page -- previewing from it would show a design
  // that is not the one on screen.
  const shownItems = useMemo(
    () =>
      merged.items.filter(
        (item) => theme.defaults.sources.includes(item.source) && theme.defaults.kinds.includes(item.kind),
      ),
    [merged.items, theme.defaults.sources, theme.defaults.kinds],
  )
  const tbaItems = useMemo(
    () =>
      merged.tba.filter(
        (item) => theme.defaults.sources.includes(item.source) && theme.defaults.kinds.includes(item.kind),
      ),
    [merged.tba, theme.defaults.sources, theme.defaults.kinds],
  )
  const nextUp = useMemo(
    () => (theme.highlight.nextUp ? shownItems.filter((item) => item.endsAt >= todayKey).slice(0, NEXT_UP_COUNT) : []),
    [shownItems, todayKey, theme.highlight.nextUp],
  )

  // Picked once, the first time there is anything to show. The public page opens on the current month whatever it
  // holds; a preview that opened on an empty grid would be reviewing nothing, so it falls forward to the first month
  // with dates. The admin can still walk back with the grid's own arrows.
  const [previewMonth, setPreviewMonth] = useState(null)
  useEffect(() => {
    if (previewMonth || shownItems.length === 0) return
    const now = new Date()
    const current = new Date(now.getFullYear(), now.getMonth(), 1)
    const thisMonth = shownItems.filter((item) => item.startsAt.slice(0, 7) === toDayKey(current).slice(0, 7))
    setPreviewMonth(thisMonth.length ? current : fromDayKey(`${shownItems[0].startsAt.slice(0, 7)}-01`))
  }, [shownItems, previewMonth])

  if (looksQuery.isError && !looks) {
    return (
      <div className="max-w-[1400px]">
        <ErrorState message="Couldn't load the saved calendar designs right now." onRetry={looksQuery.refetch} />
      </div>
    )
  }

  const pending = saveMutation.isPending || deleteMutation.isPending || settingsMutation.isPending

  return (
    <div className="max-w-[1400px]">

      {/* `calendar_looks` and `calendar_settings` are owner-write at the database
          (20261009090000_calendar.sql:127,150). Every admin can see the calendar, so the screen is not hidden from
          them -- but the writes are switched off rather than left to be refused with "no changes were saved". */}
      {!isOwner && (
        <p className="mt-4 rounded-md border border-hairline bg-surface-low p-4 text-sm text-ink-muted">
          You can look at every setting and see the preview, but only the owner can save a design or change which one
          is live. The database refuses the write for anyone else, so the buttons are off rather than failing on press.
        </p>
      )}

      {!ready || !draft ? (
        <div className="mt-6">
          <SkeletonText lines={6} />
        </div>
      ) : (
        <>
          <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline bg-surface p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="material-symbols-outlined text-brand-orange">palette</span>
              <span className="text-sm font-semibold text-ink-900">
                {selectedLook ? selectedLook.name : 'Built-in default'}
              </span>
              {selectedLook?.id === activeLookId && <Badge tone="updated">Live</Badge>}
              {!selectedLook && <Badge tone="neutral">Not saved</Badge>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                loading={saveMutation.isPending}
                disabled={!dirty || !selectedLook || !isOwner}
                onClick={handleSave}
              >
                <span className="material-symbols-outlined text-base">save</span>
                {dirty ? 'Save design' : 'Saved'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDraft(sanitizeTheme(DEFAULT_THEME))}>
                <span className="material-symbols-outlined text-base">restart_alt</span>
                Reset to default
              </Button>
            </div>
          </section>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[240px_360px_minmax(0,1fr)]">
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-bold uppercase tracking-[.05em] text-ink-muted">Saved designs</h2>

              {(looks ?? []).length === 0 ? (
                <p className="rounded-md border border-hairline bg-surface p-4 text-sm text-ink-muted">
                  Nothing saved yet. Design something on the right and give it a name below.
                </p>
              ) : (
                <ul className="divide-y divide-hairline overflow-hidden rounded-md border border-hairline">
                  {looks.map((look) => (
                    <li key={look.id} className={['flex flex-col gap-2 p-3', look.id === selectedId ? 'bg-surface-low' : 'bg-surface'].join(' ')}>
                      {renamingId === look.id ? (
                        <form className="flex items-center gap-1.5" onSubmit={handleRename}>
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={(event) => setRenameValue(event.target.value)}
                            aria-label={`New name for ${look.name}`}
                            className="min-h-9 min-w-0 flex-1 rounded-md border border-hairline bg-surface px-2 text-sm text-ink focus:border-brand focus:outline-none"
                          />
                          <Button type="submit" size="sm" loading={saveMutation.isPending} disabled={!renameValue.trim()}>
                            Save
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setRenamingId(null)}>
                            Cancel
                          </Button>
                        </form>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => selectLook(look.id)}
                            className="flex min-w-0 items-center gap-2 text-left text-sm font-semibold text-ink hover:text-brand"
                          >
                            <span className="truncate">{look.name}</span>
                            {look.id === activeLookId && <Badge tone="updated">Live</Badge>}
                          </button>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={pending || !isOwner || look.id === activeLookId}
                              onClick={() => makeActive(look.id)}
                            >
                              <span className="material-symbols-outlined text-base">check</span>
                              Make live
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={pending || !isOwner}
                              onClick={() => {
                                setRenamingId(look.id)
                                setRenameValue(look.name)
                              }}
                            >
                              <span className="material-symbols-outlined text-base">edit</span>
                              Rename
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={pending || !isOwner}
                              onClick={() => handleDelete(look.id)}
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                              Delete
                            </Button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <form className="flex flex-col gap-2 rounded-md border border-hairline bg-surface p-3" onSubmit={handleSaveAsNew}>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-ink">Save the current design as</span>
                  <input
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="Term-time green"
                    maxLength={60}
                    className="min-h-10 rounded-md border border-hairline bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none"
                  />
                </label>
                <Button type="submit" size="sm" loading={saveMutation.isPending} disabled={!newName.trim() || !isOwner}>
                  <span className="material-symbols-outlined text-base">add</span>
                  Save as new design
                </Button>
                <p className="text-xs text-ink-muted">
                  Saving creates the design. Making it live is the separate button above, so a design you are still
                  working on never reaches /calendar by accident.
                </p>
              </form>
            </section>

            <div className="min-w-0 overflow-hidden rounded-lg border border-hairline bg-surface">
              <CalendarDesignControls draft={draft} onChange={setDraft} />
            </div>

            <section className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline bg-surface px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-ink-muted">calendar_month</span>
                  <span className="text-sm font-semibold text-ink-900">Live preview</span>
                  <span className="text-xs text-ink-muted">Real dates from both sources</span>
                </div>
                {/* `.dark` is the only place the site defines its dark palette (src/index.css:51), so putting the class
                    on this wrapper is the whole of the override -- there is no "light" block to switch back to. Which is
                    why the switch is only offered while the site itself is light. */}
                {siteTheme === 'dark' ? (
                  <span className="text-xs text-ink-muted">Showing the dark palette</span>
                ) : (
                  <Toggle
                    checked={previewDark}
                    onChange={setPreviewDark}
                    label="Dark mode"
                    description="Check a look before it goes live."
                  />
                )}
              </div>

              <div
                style={themeVars(theme)}
                className={['mt-3 flex flex-col gap-6 rounded-lg border border-hairline p-4', previewDark ? 'dark bg-paper' : 'bg-paper'].join(' ')}
              >
                {(academicQuery.isLoading || eventsQuery.isLoading) && !merged.items.length ? (
                  <SkeletonText lines={4} />
                ) : (
                  <>
                    {nextUp.length > 0 && <NextUpStrip items={nextUp} todayKey={todayKey} />}
                    {previewMonth ? (
                      <MonthGrid
                        month={previewMonth}
                        onMonthChange={setPreviewMonth}
                        items={shownItems}
                        theme={theme}
                        todayKey={todayKey}
                        onSelectDay={ignoreDaySelect}
                      />
                    ) : (
                      <p className="rounded-md border border-hairline bg-surface p-6 text-center text-sm text-ink-muted">
                        Nothing dated to preview. Every date on the calendar may be switched off by the defaults above.
                      </p>
                    )}
                    <CalendarLegend theme={theme} />
                    <TbaPanel items={tbaItems} theme={theme} />
                  </>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  )
}