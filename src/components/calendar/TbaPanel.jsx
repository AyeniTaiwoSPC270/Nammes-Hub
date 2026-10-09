import { Link } from 'react-router-dom'

// The undated rows, always reachable and never in a grid cell.
//
// The senate's calendar prints "To be determined" for Orientation and Matriculation, and `events` keeps its
// free-text `date` column, which still allows a row with nothing parseable on it. `starts_at IS NULL` is a
// real state in the schema (spec §3.1) and modelling it as a sentinel date would have corrupted every
// comparison, so the rows are parked here instead of being invented into the grid.
export default function TbaPanel({ items, theme }) {
  if (items.length === 0) return null

  return (
    <section
      aria-labelledby="cal-tba-heading"
      className="rounded-lg border border-hairline bg-surface-low p-4 sm:p-5"
    >
      <h2 id="cal-tba-heading" className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-[.06em] text-brand-orange">
        <span className="material-symbols-outlined text-base">hourglass_top</span>
        Dates to be announced
      </h2>
      <p className="mt-1.5 text-sm text-ink-muted">
        No date has been set yet, so these are not on the grid. They will appear in it as soon as one is.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {items.map((item) => {
          const accent = theme.accents[item.kind]
          const shape =
            'flex items-start gap-3 rounded-md border border-hairline bg-surface p-3 text-left'

          return (
            <li key={item.id}>
              {item.href ? (
                <Link to={item.href} className={`${shape} no-underline transition-colors hover:border-brand`}>
                  <TbaBody item={item} accent={accent} />
                </Link>
              ) : (
                <div className={shape}>
                  <TbaBody item={item} accent={accent} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function TbaBody({ item, accent }) {
  return (
    <>
      <span
        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: `var(--cal-${item.kind})` }}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-snug text-ink-900">{item.title}</span>
        <span className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted">
          <span className="material-symbols-outlined text-sm">{accent.icon}</span>
          {accent.label}
        </span>
        {item.note && <span className="mt-1 block text-sm text-ink-muted">{item.note}</span>}
      </span>
    </>
  )
}