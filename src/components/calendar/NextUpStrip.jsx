import { Link } from 'react-router-dom'
import { dayMonthLabel } from './calendarFormat.js'

// "Happening now" rather than a date: a student in the middle of a three-week exam week cares that it is
// still running, and printing the date it started would read as though it were over.
function whenLabel(item, todayKey) {
  if (item.startsAt < todayKey) return 'Happening now'
  if (item.startsAt === todayKey) return 'Today'
  return dayMonthLabel(item.startsAt)
}

function endsLabel(item) {
  if (item.endsAt === item.startsAt) return null
  return `Ends ${dayMonthLabel(item.endsAt)}`
}

// The strip above the calendar, and the reason /calendar is not just /events with a month grid bolted on.
// /events queries the `events` table alone, so a week with no departmental event but lectures running has
// nothing to say at all; this merges both sources and answers "what is happening".
//
// Event items carry an `href` from calendarMerge and link to their detail page. Academic rows have no
// detail page in v1, so they are plain cards: a dead link to nowhere is worse than no link.
export default function NextUpStrip({ items, todayKey }) {
  return (
    <section aria-label="Coming up" className="rounded-lg border border-hairline bg-surface-low p-4 sm:p-5">
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold uppercase tracking-[.06em] text-brand-orange">
        <span className="material-symbols-outlined text-base">calendar_today</span>
        Next up
      </h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => {
          const ends = endsLabel(item)
          const card = [
            'flex h-full flex-col items-start gap-1.5 rounded-md border border-hairline bg-surface p-3 text-left',
            item.href ? 'no-underline transition-colors duration-150 hover:border-brand' : '',
          ].join(' ')
          const body = (
            <>
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: `var(--cal-${item.kind})` }}
                aria-hidden="true"
              />
              <span className="text-sm font-semibold leading-snug text-ink-900">{item.title}</span>
              <span className="mt-auto pt-1 text-xs text-ink-muted">
                {whenLabel(item, todayKey)}
                {ends ? ` · ${ends}` : ''}
              </span>
            </>
          )

          return (
            <li key={item.id} className="min-w-0">
              {item.href ? (
                <Link to={item.href} className={card}>
                  {body}
                </Link>
              ) : (
                <div className={card}>{body}</div>
              )}
            </li>
          )
        })}
      </ul>
      <p className="sr-only">{items.length} upcoming items, merged from both calendar sources.</p>
    </section>
  )
}