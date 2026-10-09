import { KIND_ORDER } from '../../../api/_lib/calendarTheme.js'

// One row per kind, in the order the studio lists them, so the key reads the same on every page and an
// admin who reorders nothing still recognises it. Driven by KIND_ORDER rather than by the kinds present
// on screen: a legend that silently lost a row is how a student ends up convinced an exam week is a
// lecture.
export default function CalendarLegend({ theme }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <span className="text-xs font-bold uppercase tracking-[.06em] text-ink-muted">Key</span>
      <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {KIND_ORDER.map((kind) => {
          const accent = theme.accents[kind]
          return (
            <li key={kind} className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <span
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{ background: `var(--cal-${kind})` }}
                aria-hidden="true"
              />
              <span className="material-symbols-outlined text-base text-ink-muted">{accent.icon}</span>
              <span>{accent.label}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}