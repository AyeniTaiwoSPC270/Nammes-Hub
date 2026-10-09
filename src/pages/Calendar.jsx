import { useCallback, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import PageBanner from '../components/PageBanner'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import { SkeletonText } from '../components/ui/Skeleton'
import AgendaList from '../components/calendar/AgendaList'
import CalendarLegend from '../components/calendar/CalendarLegend'
import DaySheet from '../components/calendar/DaySheet'
import MonthGrid from '../components/calendar/MonthGrid'
import NextUpStrip from '../components/calendar/NextUpStrip'
import SourceFilter from '../components/calendar/SourceFilter'
import TbaPanel from '../components/calendar/TbaPanel'
import { monthLabel } from '../components/calendar/calendarFormat.js'
import {
  useAcademicCalendarQuery,
  useCalendarFlag,
  useCalendarLooksQuery,
  useCalendarSettingsQuery,
} from '../data/calendar'
import { useEventsQuery } from '../data/events'
import { usePageBanner } from '../data/pageBanners'
import { useMediaQuery } from '../lib/useMediaQuery'
import { addMonths, fromDayKey, toDayKey } from '../../api/_lib/calendarDates.js'
import { mergeCalendarSources } from '../../api/_lib/calendarMerge.js'
import { CALENDAR_VIEWS, KIND_ORDER, SOURCE_ORDER, sanitizeTheme, themeVars } from '../../api/_lib/calendarTheme.js'

// How much slack to keep either side of the dates that are actually on file.
//
// The window is derived from the rows rather than pinned to the current calendar year: the senate publishes
// the following session a year ahead, so a window anchored on today's year would cut the far end of a
// freshly seeded calendar off the grid without saying so. A year of padding past the last row leaves room
// for month navigation, and a year before the first leaves room for the archive end of the agenda.
const RANGE_PAD_MONTHS = 12

const NEXT_UP_COUNT = 4

// The narrow-width default. Phones read by date, not by position: a seven column grid at 360px leaves
// room for a number and half a word, which is why the agenda is where they land (spec §6).
const NARROW = '(max-width: 767px)'

export default function Calendar() {
  const enabled = useCalendarFlag()
  const settingsQuery = useCalendarSettingsQuery()
  const looksQuery = useCalendarLooksQuery()
  const eventsQuery = useEventsQuery()

  const banner = usePageBanner('calendar')
  const narrow = useMediaQuery(NARROW)

  // Read off the local clock rather than toISOString(), which is the UTC day and would ring the wrong
  // cell for every reader west of Greenwich.
  const [today] = useState(() => new Date())
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [pickedView, setPickedView] = useState(null)
  const [pickedSources, setPickedSources] = useState(null)
  const [selectedDay, setSelectedDay] = useState(null)

  const session = settingsQuery.data?.active_session
  // Without the settings row there is no session to filter on, and the academic query then reads every row.
  const academicQuery = useAcademicCalendarQuery(session, !settingsQuery.isLoading)
  const todayKey = toDayKey(today)

  // The theme is a join of two tables: the settings row names the look, the look carries the design. Both
  // go through sanitizeTheme, so a hand-edited `design` cannot put a colour or an icon on this page that
  // the studio would not have allowed.
  const theme = useMemo(() => {
    const activeId = settingsQuery.data?.active_look_id
    const look = (looksQuery.data ?? []).find((row) => row.id === activeId)
    return sanitizeTheme(look?.design)
  }, [looksQuery.data, settingsQuery.data])

  // calendar_settings holds the landing defaults and the theme holds the same fields. Settings win where
  // they are present, the theme covers the case where they are not, and both are allow-listed: these are
  // text arrays a dashboard can edit by hand.
  const defaultSources = useMemo(() => {
    const raw = settingsQuery.data?.default_sources
    if (!Array.isArray(raw)) return theme.defaults.sources
    const picked = SOURCE_ORDER.filter((source) => raw.includes(source))
    return picked.length ? picked : theme.defaults.sources
  }, [settingsQuery.data, theme])

  const kinds = useMemo(() => {
    const raw = settingsQuery.data?.default_kinds
    if (!Array.isArray(raw)) return theme.defaults.kinds
    const picked = KIND_ORDER.filter((kind) => raw.includes(kind))
    return picked.length ? picked : theme.defaults.kinds
  }, [settingsQuery.data, theme])

  // A reader's own choice outranks the admin's landing default for the rest of their visit, which is why
  // this is `picked ?? default` rather than state that gets overwritten when a query settles.
  const sources = pickedSources ?? defaultSources
  const settingsView = CALENDAR_VIEWS.includes(settingsQuery.data?.default_view)
    ? settingsQuery.data.default_view
    : theme.defaults.view
  const view = pickedView ?? (narrow ? 'agenda' : settingsView)

  const range = useMemo(() => {
    let first = today
    let last = today
    for (const row of academicQuery.data ?? []) {
      if (!row.starts_at) continue
      if (row.starts_at < toDayKey(first)) first = fromDayKey(row.starts_at)
      if (row.ends_at && row.ends_at > toDayKey(last)) last = fromDayKey(row.ends_at)
    }
    return {
      from: toDayKey(addMonths(first, -RANGE_PAD_MONTHS)),
      to: toDayKey(addMonths(last, RANGE_PAD_MONTHS)),
    }
  }, [academicQuery.data, today])

  const merged = useMemo(
    () =>
      mergeCalendarSources(
        { academic: academicQuery.data ?? [], events: eventsQuery.data ?? [] },
        range,
      ),
    [academicQuery.data, eventsQuery.data, range],
  )

  const shown = useMemo(
    () => merged.items.filter((item) => sources.includes(item.source) && kinds.includes(item.kind)),
    [merged.items, sources, kinds],
  )
  const tbaItems = useMemo(
    () => merged.tba.filter((item) => sources.includes(item.source) && kinds.includes(item.kind)),
    [merged.tba, sources, kinds],
  )

  // mergeCalendarSources already orders by start, so filtering preserves the order. `endsAt >= today` rather
  // than `startsAt >= today`, because a three-week exam block that opened last week is the single most
  // useful thing this strip could say today.
  const nextUp = useMemo(
    () => (theme.highlight.nextUp ? shown.filter((item) => item.endsAt >= todayKey).slice(0, NEXT_UP_COUNT) : []),
    [shown, todayKey, theme.highlight.nextUp],
  )

  const monthKey = toDayKey(month).slice(0, 7)
  // Counted against the unfiltered list as well as the filtered one, so an empty month can say "nothing is
  // scheduled" and a month with everything filtered out can say "the filter did this" -- two different
  // sentences, and guessing wrong between them is how a working calendar reads as broken.
  const monthCount = useMemo(
    () => merged.items.filter((item) => item.startsAt.slice(0, 7) === monthKey).length,
    [merged.items, monthKey],
  )
  const shownMonthCount = useMemo(
    () => shown.filter((item) => item.startsAt.slice(0, 7) === monthKey).length,
    [shown, monthKey],
  )

  const dayItems = useMemo(
    () => (selectedDay ? shown.filter((item) => item.startsAt <= selectedDay && item.endsAt >= selectedDay) : []),
    [shown, selectedDay],
  )

  const toggleSource = useCallback(
    (source) => {
      setPickedSources((current) => {
        const base = current ?? sources
        return base.includes(source) ? base.filter((one) => one !== source) : [...base, source]
      })
    },
    [sources],
  )

  // The kill switch. useCalendarFlag fails open, so this only fires once the row has actually said the
  // feature is off; a reader who lands here with the flag down gets sent to the page that still works
  // rather than a blank one.
  if (!enabled) return <Navigate to="/events" replace />

  const loading = academicQuery.isLoading || eventsQuery.isLoading
  const failed =
    (academicQuery.isError && !academicQuery.data) || (eventsQuery.isError && !eventsQuery.data)

  return (
    <div>
      <PageBanner
        images={banner?.image_urls}
        transition={banner?.transition}
        intervalSeconds={banner?.interval_seconds}
        title={banner?.title ?? 'Academic Calendar'}
        subtitle={banner?.subtitle ?? 'Lecture, examination and registration dates alongside departmental events.'}
      />

      <div style={themeVars(theme)} className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="Calendar view" className="inline-flex rounded-full border border-hairline bg-surface p-1">
            {[
              { id: 'month', label: 'Month', icon: 'calendar_month' },
              { id: 'agenda', label: 'Agenda', icon: 'format_list_bulleted' },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={view === option.id}
                onClick={() => setPickedView(option.id)}
                className={[
                  'inline-flex min-h-9 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold',
                  'transition-colors duration-150',
                  view === option.id ? 'bg-green-900 text-white' : 'text-ink-muted hover:bg-surface-low hover:text-ink-900',
                ].join(' ')}
              >
                <span className="material-symbols-outlined text-base">{option.icon}</span>
                {option.label}
              </button>
            ))}
          </div>
          <SourceFilter selected={sources} onToggle={toggleSource} />
        </div>

        {session && (
          <p className="mb-6 text-sm font-semibold text-brand-orange">{`${session} session`}</p>
        )}

        {failed ? (
          <ErrorState
            message="Couldn't load the calendar right now."
            onRetry={() => {
              academicQuery.refetch()
              eventsQuery.refetch()
            }}
          />
        ) : loading ? (
          <div className="flex flex-col gap-4">
            <SkeletonText lines={2} />
            <div className="h-40 animate-pulse rounded-lg bg-hairline" />
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {nextUp.length > 0 && <NextUpStrip items={nextUp} todayKey={todayKey} />}

            {sources.length === 0 ? (
              <EmptyState
                icon="tune"
                title="No sources selected"
                description="Both calendar sources are switched off. Turn one back on to see the calendar."
              />
            ) : view === 'agenda' ? (
              shown.length === 0 ? (
                <EmptyState
                  icon="event_busy"
                  title="Nothing dated yet"
                  description="No lectures, examinations, registration dates or departmental events have a date on file."
                />
              ) : (
                <AgendaList items={shown} theme={theme} todayKey={todayKey} />
              )
            ) : monthCount === 0 ? (
              // A blank grid reads as broken. A month with nothing in it says so, in words, in the space the
              // grid would have taken.
              <EmptyState
                icon="calendar_month"
                title={`Nothing scheduled in ${monthLabel(month)}`}
                description="There are no dated lectures, examinations, registration dates or events this month. Use the arrows to look at another month."
              />
            ) : shownMonthCount === 0 ? (
              <EmptyState
                icon="tune"
                title="This month is filtered out"
                description="Every date this month is from a source or a kind that is switched off."
              />
            ) : (
              <MonthGrid
                month={month}
                onMonthChange={setMonth}
                items={shown}
                theme={theme}
                todayKey={todayKey}
                onSelectDay={setSelectedDay}
              />
            )}

            <CalendarLegend theme={theme} />
            <TbaPanel items={tbaItems} theme={theme} />

            {merged.hasMore && (
              // mergeCalendarSources caps the dated list and sorts it by start, so what is missing is the
              // far end. Saying which end beats a bare "some entries are not shown".
              <p className="text-sm text-ink-muted">
                This view stops at the first 500 dated entries, so the latest dates in the calendar are not listed here.
              </p>
            )}
          </div>
        )}
      </div>

      {selectedDay && (
        <DaySheet dayKey={selectedDay} items={dayItems} theme={theme} onClose={() => setSelectedDay(null)} />
      )}
    </div>
  )
}