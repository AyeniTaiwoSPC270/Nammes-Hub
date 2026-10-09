import { SOURCE_ORDER } from '../../../api/_lib/calendarTheme.js'

// The two tables the calendar merges, as pills. Both are switchable, including down to none: the page
// answers an empty selection with a way back rather than a blank grid, because a filter that refuses to
// switch the last source off is a filter that has silently decided something for the reader.
const PILL = {
  academic: { label: 'Academic', icon: 'menu_book' },
  event: { label: 'Events', icon: 'event' },
}

// Source pills are described as a filter over the calendar, not as navigation, so `role="group"` with a
// label reads better to a screen reader than a radiogroup would: these are independent toggles and any
// combination of them is legal.
export default function SourceFilter({ selected, onToggle }) {
  return (
    <div role="group" aria-label="Calendar sources" className="flex flex-wrap items-center gap-2">
      {SOURCE_ORDER.map((source) => {
        const pill = PILL[source]
        const on = selected.includes(source)
        return (
          <button
            key={source}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(source)}
            className={[
              'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold',
              'transition-colors duration-150',
              on
                ? 'border-transparent bg-green-900 text-white'
                : 'border-hairline bg-surface text-ink-muted hover:bg-surface-low hover:text-ink-900',
            ].join(' ')}
          >
            <span className="material-symbols-outlined text-base">{pill.icon}</span>
            {pill.label}
          </button>
        )
      })}
    </div>
  )
}