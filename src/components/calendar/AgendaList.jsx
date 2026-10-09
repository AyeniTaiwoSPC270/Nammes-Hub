import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { dayMonthLabel, monthKeyLabel, weekdayLongLabel } from './calendarFormat.js'

// A row in the agenda. Dates first, then the entry: on a phone the reader is scanning for "when", not for
// what the entry is called.
function AgendaRow({ item, theme, isToday }) {
  const accent = theme.accents[item.kind]
  const span = item.endsAt === item.startsAt ? null : `${dayMonthLabel(item.startsAt)} – ${dayMonthLabel(item.endsAt)}`
  const body = (
    <>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug text-ink-900">{item.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: `var(--cal-${item.kind})` }}
              aria-hidden="true"
            />
            <span className="material-symbols-outlined text-sm">{accent.icon}</span>
            {accent.label}
          </span>
          {span && <span>{span}</span>}
          {isToday && <span className="font-bold text-orange-500">Today</span>}
        </p>
        {item.note && <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{item.note}</p>}
      </div>
      {item.href && (
        <span className="material-symbols-outlined shrink-0 text-lg text-ink-muted" aria-hidden="true">
          chevron_right
        </span>
      )}
    </>
  )
  const shape = 'flex w-full items-start gap-4 border-t border-hairline px-1 py-3 text-left sm:px-2'
  const dayNumber = Number(item.startsAt.slice(8))

  return (
    <li className="flex items-start gap-3 sm:gap-4">
      <div className="w-14 shrink-0 pt-0.5 text-center">
        <span className="block text-2xl font-bold leading-none text-ink-900 tabular-nums">{dayNumber}</span>
        <span className="mt-1 block text-[11px] font-semibold uppercase tracking-[.05em] text-ink-muted">
          {weekdayLongLabel(item.startsAt).slice(0, 3)}
        </span>
      </div>
      {/* An academic row has no detail page in v1, so it is a plain div. A dead link reads as a broken
          page rather than as a deliberate choice. */}
      {item.href ? (
        <Link to={item.href} className={`${shape} no-underline transition-colors hover:bg-surface-low`}>
          {body}
        </Link>
      ) : (
        <div className={shape}>{body}</div>
      )}
    </li>
  )
}

/**
 * The chronological view, grouped by month.
 *
 * Not a month picker: it is the whole dated calendar in order, which is what a phone wants, where a seven
 * column grid is too narrow to hold a readable title. Groups come out of the item list rather than the
 * month cursor, so scrolling between months needs no controls at all.
 */
export default function AgendaList({ items, theme, todayKey }) {
  const groups = useMemo(() => {
    const byMonth = new Map()
    for (const item of items) {
      const key = item.startsAt.slice(0, 7)
      if (!byMonth.has(key)) byMonth.set(key, [])
      byMonth.get(key).push(item)
    }
    return [...byMonth.entries()]
  }, [items])

  return (
    <div className="flex flex-col gap-8">
      {groups.map(([key, group]) => (
        <section key={key} aria-label={monthKeyLabel(key)}>
          {/* Sits just under the sticky navbar, whose height is 44px of control plus 14px of padding either
              side. */}
          <h2 className="sticky top-18 z-1 -mx-1 bg-paper/95 px-1 py-2 text-lg font-bold text-ink-900 backdrop-blur">
            {monthKeyLabel(key)}
            <span className="ml-2 text-sm font-normal text-ink-muted">{group.length} items</span>
          </h2>
          <ul className="flex flex-col">
            {group.map((item) => (
              <AgendaRow key={item.id} item={item} theme={theme} isToday={item.startsAt === todayKey} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}