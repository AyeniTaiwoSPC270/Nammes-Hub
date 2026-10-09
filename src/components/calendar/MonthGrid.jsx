import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { addMonths, monthGrid, toDayKey } from '../../../api/_lib/calendarDates.js'
import { monthLabel, weekdayLongName, weekdayShortName } from './calendarFormat.js'

// The three pixel heights the layout is built from. They live here, in JS, rather than in CSS because the
// bar overlay positions itself as a percentage of the cell it hangs out of while the cell reserves that
// space in padding: if the two disagreed, the bar would sit on top of the cell's last item.
const DAY_HEAD_H = 20
const SLOT_H = 18
const LANE_H = 22

const byId = (a, b) => (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0)

/**
 * Places every dated item on the grid.
 *
 * Multi-day items become bars: one segment per week they touch, `from`/`to` being column indexes into the
 * flattened, weekend-filtered day list. Single-day items are collected per day and left for the caller to
 * cap. Lanes are assigned once across the whole month rather than per week, so a three-week exam block
 * stays in the same lane in every week it spans instead of jumping around the column it is drawn in.
 */
function buildLayout({ year, monthIndex, weekStart, showWeekends, items }) {
  const weeks = monthGrid(year, monthIndex, { weekStart })
  // Hiding the weekend drops Saturday and Sunday from every week. monthGrid still builds seven columns
  // because that is how the month's dates line up against its real first and last day.
  const visibleWeeks = showWeekends
    ? weeks
    : weeks.map((week) => week.filter((day) => day.getDay() !== 0 && day.getDay() !== 6))
  const columns = visibleWeeks[0]?.length ?? 7
  const days = visibleWeeks.flat()
  const columnOf = new Map(days.map((day, i) => [toDayKey(day), i]))

  const singles = new Map()
  const spans = []

  for (const item of items) {
    if (item.startsAt === item.endsAt) {
      if (!columnOf.has(item.startsAt)) continue
      if (!singles.has(item.startsAt)) singles.set(item.startsAt, [])
      singles.get(item.startsAt).push(item)
      continue
    }
    // Day keys are 'YYYY-MM-DD', so comparing them as strings is comparing them as dates. Walking the day
    // list rather than iterating a range keeps this correct across a daylight-saving week, where two
    // consecutive days are 23 or 25 hours apart as instants.
    let from = -1
    let to = -1
    for (let i = 0; i < days.length; i += 1) {
      const key = toDayKey(days[i])
      if (from === -1 && key >= item.startsAt) from = i
      if (key <= item.endsAt) to = i
    }
    // A span whose only visible days are the hidden weekend has no column to sit in. It still turns up in
    // the agenda and the day sheet; leaving it out of the grid is not leaving it off the calendar.
    if (from === -1 || to === -1 || to < from) continue
    spans.push({ item, from, to })
  }

  spans.sort(
    (a, b) =>
      a.from - b.from ||
      // Among items starting the same day, the longest span claims the top lane.
      b.to - b.from - (a.to - a.from) ||
      a.to - b.to ||
      byId(a, b),
  )

  const laneEnds = []
  for (const span of spans) {
    let lane = 0
    while (lane < laneEnds.length && laneEnds[lane] >= span.from) lane += 1
    laneEnds[lane] = span.to
    span.lane = lane
  }

  const grid = visibleWeeks.map((weekDays, w) => {
    const start = w * columns
    const end = start + columns - 1
    const bars = spans
      .filter((span) => span.from <= end && span.to >= start)
      .map((span) => {
        const first = Math.max(span.from, start)
        return {
          item: span.item,
          lane: span.lane,
          // The column this segment starts in, which is also the cell that draws it.
          col: first - start,
          spanCols: Math.min(span.to, end) - first + 1,
          continuesBefore: span.from < start,
          continuesAfter: span.to > end,
        }
      })
    return { days: weekDays, bars, lanes: bars.reduce((most, bar) => Math.max(most, bar.lane + 1), 0) }
  })

  return { grid, days, columns, columnOf, singles }
}

function ItemChip({ item }) {
  const inner = (
    <>
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: `var(--cal-${item.kind})` }}
        aria-hidden="true"
      />
      <span className="truncate">{item.title}</span>
    </>
  )
  const shape = 'flex min-w-0 items-center gap-1 rounded-sm px-1 text-[11px] leading-none text-ink hover:bg-surface-low'
  const style = { height: SLOT_H }

  // An academic row has no detail page in v1, so it renders as a chip and not as a link to nowhere.
  return item.href ? (
    <Link to={item.href} data-cal-item className={shape} style={style}>
      {inner}
    </Link>
  ) : (
    <span data-cal-item className={shape} style={style}>
      {inner}
    </span>
  )
}

/**
 * The month grid.
 *
 * A cell is the focusable unit, roving tabindex style: one Tab stop for the whole grid, arrow keys to move
 * between days, PageUp/PageDown for months, Enter or Space for the day's sheet. That sheet is also how a
 * keyboard reader reaches an item's link, which is why the spanning bars carry `tabIndex={-1}` rather
 * than adding one more Tab stop per date in the month.
 */
export default function MonthGrid({ month, onMonthChange, items, theme, todayKey, onSelectDay }) {
  const [focusKey, setFocusKey] = useState(todayKey)
  const cellRefs = useRef([])
  const wantsFocus = useRef(false)

  const layout = useMemo(
    () =>
      buildLayout({
        year: month.getFullYear(),
        monthIndex: month.getMonth(),
        weekStart: theme.grid.weekStart,
        showWeekends: theme.grid.showWeekends,
        items,
      }),
    [month, items, theme.grid.weekStart, theme.grid.showWeekends],
  )

  const maxPerDay = theme.grid.maxPerDay
  // Taken from the grid's own first week rather than from the week start, so a calendar with the weekend
  // switched off gets five headers over five columns and the right five names.
  const headers = layout.grid[0]?.days ?? []
  const focusIndex = Math.max(0, layout.columnOf.get(focusKey) ?? 0)
  const columnsStyle = { gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))` }

  useEffect(() => {
    if (!wantsFocus.current) return
    wantsFocus.current = false
    cellRefs.current[focusIndex]?.focus()
  }, [focusIndex, focusKey])

  const move = useCallback(
    (index) => {
      const day = layout.days[Math.min(layout.days.length - 1, Math.max(0, index))]
      if (!day) return
      wantsFocus.current = true
      setFocusKey(toDayKey(day))
    },
    [layout.days],
  )

  const changeMonth = useCallback(
    (next) => {
      wantsFocus.current = true
      setFocusKey(toDayKey(next))
      onMonthChange(next)
    },
    [onMonthChange],
  )

  function handleKeyDown(event, index, day) {
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -layout.columns, ArrowDown: layout.columns }
    if (event.key in moves) {
      event.preventDefault()
      move(index + moves[event.key])
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      move(index - (index % layout.columns))
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      move(index - (index % layout.columns) + layout.columns - 1)
      return
    }
    if (event.key === 'PageUp') {
      event.preventDefault()
      changeMonth(addMonths(month, -1))
      return
    }
    if (event.key === 'PageDown') {
      event.preventDefault()
      changeMonth(addMonths(month, 1))
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelectDay(toDayKey(day))
    }
  }

  function goToToday() {
    // Read off the local clock, never toISOString(): that is the UTC day and would put the calendar a day
    // out for every reader west of Greenwich.
    const today = new Date()
    wantsFocus.current = true
    setFocusKey(toDayKey(today))
    onMonthChange(new Date(today.getFullYear(), today.getMonth(), 1))
  }

  return (
    <section aria-label="Month calendar" className="overflow-hidden border border-hairline bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-3 py-2.5">
        <h2 className="text-lg font-bold text-ink-900">{monthLabel(month)}</h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => changeMonth(addMonths(month, -1))}
            aria-label="Previous month"
            className="flex h-9 w-9 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-surface-low hover:text-ink-900"
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <button
            type="button"
            onClick={goToToday}
            className="min-h-9 rounded-sm px-3 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-low hover:text-ink-900"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => changeMonth(addMonths(month, 1))}
            aria-label="Next month"
            className="flex h-9 w-9 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-surface-low hover:text-ink-900"
          >
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </div>

      <div role="grid" aria-label={monthLabel(month)}>
        <div role="row" className="grid border-b border-hairline bg-surface-low" style={columnsStyle}>
          {headers.map((day) => (
            <div
              key={toDayKey(day)}
              role="columnheader"
              className="px-2 py-2 text-xs font-bold uppercase tracking-[.06em] text-ink-muted"
            >
              {/* The columns are abbreviated on screen; "Mon" read on its own is still read as "Mon". */}
              <span className="sr-only">{`${weekdayLongName(day)}, `}</span>
              {weekdayShortName(day)}
            </div>
          ))}
        </div>

        {layout.grid.map((week, w) => {
          const barLayer = week.lanes * LANE_H
          return (
            <div key={w} role="row" className="grid border-b border-hairline last:border-b-0" style={columnsStyle}>
              {week.days.map((day, i) => {
                const key = toDayKey(day)
                const isToday = key === todayKey
                const inMonth = day.getMonth() === month.getMonth()
                const dayItems = layout.singles.get(key) ?? []
                const overflow = Math.max(0, dayItems.length - maxPerDay)
                const shown = overflow ? dayItems.slice(0, maxPerDay) : dayItems
                const index = w * layout.columns + i
                const pad = 'var(--cal-row-pad, 4px)'

                return (
                  <div
                    key={key}
                    ref={(node) => {
                      cellRefs.current[index] = node
                    }}
                    role="gridcell"
                    tabIndex={index === focusIndex ? 0 : -1}
                    aria-current={isToday ? 'date' : undefined}
                    aria-haspopup="dialog"
                    onClick={(event) => {
                      // An item is its own target: clicking an event link must not also open the sheet.
                      if (event.target.closest('[data-cal-item]')) return
                      onSelectDay(key)
                    }}
                    onKeyDown={(event) => handleKeyDown(event, index, day)}
                    className={[
                      'relative flex min-w-0 flex-col outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500',
                      inMonth ? 'bg-surface' : 'bg-surface-low',
                      isToday && theme.highlight.today ? 'ring-2 ring-inset ring-orange-500' : '',
                    ].join(' ')}
                    style={{
                      minHeight: 'var(--cal-cell-min, 112px)',
                      paddingTop: pad,
                      paddingLeft: pad,
                      paddingRight: pad,
                      // The space the bars hang into, reserved here rather than left to the overlay so a
                      // cell never has items sitting underneath one.
                      paddingBottom: `calc(${pad} + ${barLayer}px)`,
                    }}
                  >
                    <div className="flex items-center justify-between" style={{ height: DAY_HEAD_H }}>
                      <span
                        className={[
                          'text-xs font-bold tabular-nums',
                          isToday ? 'text-orange-500' : inMonth ? 'text-ink-900' : 'text-ink-muted',
                        ].join(' ')}
                      >
                        {day.getDate()}
                        {isToday && <span className="sr-only">, today</span>}
                      </span>
                    </div>

                    <div
                      className="flex flex-col overflow-hidden"
                      // A fixed box rather than a natural one: a day with three items and a day with none
                      // are the same height, so "+N more" can never reflow the month around it.
                      style={{ height: (maxPerDay + 1) * SLOT_H }}
                    >
                      {shown.map((item) => (
                        <ItemChip key={item.id} item={item} />
                      ))}
                      {overflow > 0 && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            onSelectDay(key)
                          }}
                          className="flex min-w-0 items-center rounded-sm px-1 text-left text-[11px] font-semibold leading-none text-brand hover:underline"
                          style={{ height: SLOT_H }}
                        >
                          <span className="truncate">{`+${overflow} more`}</span>
                        </button>
                      )}
                    </div>

                    {/* Each bar lives in the first cell of the segment it covers and reaches out over the
                        rest with a negative offset. That is what makes it read as one run across the week
                        rather than as the same entry repeated on every day. */}
                    {week.bars
                      .filter((bar) => bar.col === i)
                      .map((bar) => {
                        const accent = `var(--cal-${bar.item.kind})`
                        const shape = [
                          'absolute z-1 flex min-w-0 items-center gap-1 overflow-hidden border-l-[3px] px-1.5 text-[11px] font-semibold leading-none text-ink-900',
                          bar.item.href ? 'no-underline hover:brightness-95' : '',
                        ].join(' ')
                        // The studio's radius control writes --cal-radius, so the bars read it rather than
                        // pinning rounded-sm here and leaving that control doing nothing.
                        const style = {
                          borderRadius: 'var(--cal-radius, 4px)',
                          left: `calc(${-(bar.col / layout.columns) * 100}% + 2px)`,
                          width: `calc(${(bar.spanCols / layout.columns) * 100}% - 4px)`,
                          top: `calc(100% - ${barLayer}px + ${bar.lane * LANE_H + 2}px)`,
                          height: LANE_H - 4,
                          background: `color-mix(in srgb, ${accent} 20%, var(--color-surface))`,
                          borderLeftColor: accent,
                          borderLeftWidth: bar.continuesBefore ? 0 : undefined,
                          borderTopLeftRadius: bar.continuesBefore ? '2px' : undefined,
                          borderBottomLeftRadius: bar.continuesBefore ? '2px' : undefined,
                          borderTopRightRadius: bar.continuesAfter ? '2px' : undefined,
                          borderBottomRightRadius: bar.continuesAfter ? '2px' : undefined,
                        }
                        const inner = (
                          <>
                            <span className="material-symbols-outlined shrink-0 text-[13px]">
                              {theme.accents[bar.item.kind].icon}
                            </span>
                            <span className="truncate">{bar.item.title}</span>
                          </>
                        )
                        return bar.item.href ? (
                          <Link
                            key={bar.item.id}
                            to={bar.item.href}
                            tabIndex={-1}
                            title={bar.item.title}
                            className={shape}
                            style={style}
                          >
                            {inner}
                          </Link>
                        ) : (
                          <div key={bar.item.id} title={bar.item.title} className={shape} style={style}>
                            {inner}
                          </div>
                        )
                      })}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </section>
  )
}