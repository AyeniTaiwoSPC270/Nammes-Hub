import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useBodyScrollLock } from '../../lib/useBodyScrollLock'
import { dayMonthLabel, fullDayLabel } from './calendarFormat.js'

// Everything that touches a given day, including the bars that started weeks earlier and the entries that
// have not started yet. On a phone the grid cell is the only way in, so this is the view a student actually
// reads a date from -- which is why it spells the whole date out rather than repeating the grid's "14".
export default function DaySheet({ dayKey, items, theme, onClose }) {
  const dialogRef = useRef(null)
  const opener = useRef(null)

  useBodyScrollLock()

  useEffect(() => {
    opener.current = document.activeElement
    dialogRef.current?.focus()
    return () => {
      if (opener.current instanceof HTMLElement) opener.current.focus()
    }
  }, [])

  useEffect(() => {
    function handleKey(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const ranged = items.length > 1 || items.some((item) => item.endsAt !== item.startsAt)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={fullDayLabel(dayKey)}
        tabIndex={-1}
        className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-lg border border-hairline bg-surface p-5 shadow-md outline-none sm:rounded-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold text-ink-900">{fullDayLabel(dayKey)}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close day details"
            className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-surface-low hover:text-ink-900"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {items.length === 0 ? (
          <p className="rounded-md border border-hairline bg-surface-low px-4 py-6 text-center text-sm text-ink-muted">
            Nothing is scheduled for this day.
          </p>
        ) : (
          <ul className="flex flex-col">
            {items.map((item) => {
              const accent = theme.accents[item.kind]
              const when =
                item.endsAt === item.startsAt
                  ? 'All day'
                  : item.startsAt === dayKey
                    ? `Started ${dayMonthLabel(item.startsAt)} · ends ${dayMonthLabel(item.endsAt)}`
                    : item.endsAt === dayKey
                      ? `Started ${dayMonthLabel(item.startsAt)} · ends today`
                      : `Ran ${dayMonthLabel(item.startsAt)} – ${dayMonthLabel(item.endsAt)}`

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
                      <span>{when}</span>
                      {ranged && item.isMultiDay && <span>Runs several days</span>}
                    </p>
                    {item.note && <p className="mt-1 text-sm text-ink-muted">{item.note}</p>}
                  </div>
                  {item.href && (
                    <span className="material-symbols-outlined shrink-0 text-lg text-ink-muted" aria-hidden="true">
                      chevron_right
                    </span>
                  )}
                </>
              )
              const shape =
                'flex w-full items-start gap-3 border-t border-hairline py-3 text-left first:border-t-0 first:pt-0'

              return (
                <li key={item.id}>
                  {/* Academic rows have no detail page in v1, so they are plain text here too. */}
                  {item.href ? (
                    <Link to={item.href} className={`${shape} no-underline transition-colors hover:bg-surface-low`}>
                      {body}
                    </Link>
                  ) : (
                    <div className={shape}>{body}</div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}