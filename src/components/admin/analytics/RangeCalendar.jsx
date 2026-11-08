import { useState } from 'react'
import { addMonths, fromDayKey, monthGrid, toDayKey } from '../../../../api/_lib/calendarDates.js'
import { formatDay } from '../../../lib/analytics'

// A calendar that picks a day or a span of days, for the analytics range picker.
//
// The grid comes from api/_lib/calendarDates.js rather than being drawn here. That module is already the
// one place a month is laid out, and a second copy is how Monday-start and a lead-in offset end up
// disagreeing with the academic calendar in the same admin area.

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function triggerLabel(range) {
  if (range.key !== 'custom' || !range.from || !range.to) return 'Custom date'
  return range.from === range.to
    ? formatDay(range.from)
    : `${formatDay(range.from)} – ${formatDay(range.to)}`
}

export default function RangeCalendar({ range, today, onSelect }) {
  const [open, setOpen] = useState(false)
  // The panel opens on the month being shown rather than on today, so reopening it after picking a
  // week in September does not scroll the admin back to November to find their own selection.
  const anchor = fromDayKey(range.from || today)
  const [view, setView] = useState({ year: anchor.getFullYear(), month: anchor.getMonth() })

  function openPanel() {
    const from = fromDayKey(range.from || today)
    setView({ year: from.getFullYear(), month: from.getMonth() })
    setOpen(true)
  }

  // One click is a single day, a second click makes it a range. A third starts again: the admin has
  // already seen the span they built, and dragging the far end of it is not what a fresh click means.
  function pick(day) {
    if (day > today) return
    if (!range.from || !range.to || range.from !== range.to) {
      onSelect(day, day)
      return
    }
    onSelect(day < range.to ? day : range.to, day < range.to ? range.to : day)
  }

  const weeks = monthGrid(view.year, view.month, { weekStart: 1 })
  const latest = fromDayKey(today)
  const atLatestMonth = view.year === latest.getFullYear() && view.month === latest.getMonth()

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={[
          'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors',
          range.key === 'custom'
            ? 'border-green-900 bg-green-900 text-white'
            : 'border-hairline bg-surface-low text-ink-muted hover:bg-surface hover:text-brand',
        ].join(' ')}
      >
        <span className="material-symbols-outlined text-base" aria-hidden="true">calendar_month</span>
        {triggerLabel(range)}
      </button>

      {open && (
        <>
          {/* Click anywhere else to dismiss, the same dismissal the PDF menu uses: a popover that
              traps you is worse than one that closes by accident. */}
          <button
            type="button"
            aria-label="Close the calendar"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          {/* Viewport-bound on a phone, anchored to the trigger on a wider screen. The trigger sits
              at the left end of the control row, so a right-anchored 288px panel hangs off the left
              edge on a narrow viewport -- it has nowhere to grow towards. */}
          <div
            role="dialog"
            aria-label="Pick a date range"
            className="fixed left-2 right-2 z-20 mt-1 max-h-[85vh] overflow-y-auto rounded-md border border-hairline bg-surface p-3 shadow-md sm:absolute sm:left-auto sm:right-0 sm:w-72"
          >
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setView((v) => monthOf(addMonths(new Date(v.year, v.month, 1), -1)))}
                className="flex h-9 w-9 items-center justify-center rounded-sm text-ink-muted hover:bg-surface-low hover:text-brand"
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">chevron_left</span>
              </button>
              <p className="text-sm font-semibold text-ink-900">
                {MONTH_NAMES[view.month]} {view.year}
              </p>
              <button
                type="button"
                aria-label="Next month"
                disabled={atLatestMonth}
                onClick={() => setView((v) => monthOf(addMonths(new Date(v.year, v.month, 1), 1)))}
                className="flex h-9 w-9 items-center justify-center rounded-sm text-ink-muted hover:bg-surface-low hover:text-brand disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">chevron_right</span>
              </button>
            </div>

            <div className="mt-2 grid grid-cols-7 gap-1" aria-hidden="true">
              {WEEKDAYS.map((day, i) => (
                <span key={i} className="flex h-6 items-center justify-center text-[11px] font-semibold text-ink-muted">
                  {day}
                </span>
              ))}
            </div>

            <div className="mt-1 grid grid-cols-7 gap-1" role="group" aria-label="Days">
              {weeks.flat().map((date) => {
                const day = toDayKey(date)
                const inside = date.getMonth() === view.month
                const selected = day === range.from || day === range.to
                const inRange = Boolean(range.from && range.to) && day >= range.from && day <= range.to
                const future = day > today

                // Days from the neighbouring month keep the grid square but are not buttons: a click
                // that silently changes the month underneath the cursor is worse than a gap.
                if (!inside) {
                  return <span key={day} className="h-9 rounded-sm" />
                }

                return (
                  <button
                    key={day}
                    type="button"
                    disabled={future}
                    aria-pressed={selected}
                    aria-label={formatDay(day)}
                    onClick={() => pick(day)}
                    className={[
                      // 36px is the most a seven-column grid affords on a 320px screen; below that the
                      // day you want is smaller than a fingertip.
                      'h-9 rounded-sm text-sm font-semibold transition-colors',
                      selected
                        ? 'bg-green-900 text-white'
                        : inRange
                          ? 'bg-surface-low text-ink-900'
                          : 'text-ink-900 hover:bg-surface-low',
                      future ? 'cursor-not-allowed text-ink-muted opacity-40 hover:bg-transparent' : '',
                      day === today && !selected ? 'ring-1 ring-inset ring-hairline' : '',
                    ].join(' ')}
                  >
                    {date.getDate()}
                  </button>
                )
              })}
            </div>

            <div className="mt-3 flex items-start justify-between gap-2 border-t border-hairline pt-2">
              <div className="flex flex-col">
                <p className="text-sm font-semibold text-ink-900">{triggerLabel(range)}</p>
                <p className="text-xs text-ink-muted">Click a day, then another to make a range.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-sm px-3 py-1.5 text-sm font-semibold text-brand hover:bg-surface-low"
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function monthOf(date) {
  return { year: date.getFullYear(), month: date.getMonth() }
}
