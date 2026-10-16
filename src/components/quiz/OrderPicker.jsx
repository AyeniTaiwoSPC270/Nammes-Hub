import { useState } from 'react'

// The student puts steps in order by tapping them. Tap in sequence to build the sequence; tap a placed step to send it
// back to the pool. Deliberately not drag-and-drop: on a phone in a hall with fifty people, drag is the interaction
// that fails, and tapping twice works with a thumb, a stylus and a cracked screen.
export function OrderPicker({ steps, value, onChange, disabled = false }) {
  // `value` is the sequence of indices already placed. Empty entries are pool steps waiting to be tapped.
  const placed = value ?? []
  const pool = steps.map((text, i) => ({ text, i })).filter(({ i }) => !placed.includes(i))
  const [justPlaced, setJustPlaced] = useState(null)

  function place(i) {
    if (disabled) return
    setJustPlaced(i)
    onChange([...placed, i])
  }

  function unplace(at) {
    if (disabled) return
    setJustPlaced(null)
    onChange(placed.filter((_, k) => k !== at))
  }

  const row = 'flex w-full items-center gap-3 rounded-2xl border border-hairline bg-surface p-3 text-left'
  const badge = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white'

  return (
    <div className="flex w-full flex-col gap-2">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">Your order</p>
      {placed.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-hairline p-4 text-sm text-ink-muted">
          Tap the steps below in the right order.
        </p>
      ) : (
        <ol className="flex w-full flex-col gap-2">
          {placed.map((step, at) => (
            <li key={`${step}-${at}`}>
              <button type="button" onClick={() => unplace(at)} disabled={disabled} className={row}>
                <span className={badge}>{at + 1}</span>
                <span className="min-w-0 flex-1 break-words font-semibold">{steps[step]}</span>
                {!disabled && (
                  <span className="material-symbols-outlined text-ink-muted" aria-hidden="true">close</span>
                )}
              </button>
            </li>
          ))}
        </ol>
      )}

      {pool.length > 0 && (
        <>
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">Remaining steps</p>
          <ul className="flex w-full flex-col gap-2">
            {pool.map(({ text, i }) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => place(i)}
                  disabled={disabled}
                  className={`${row} ${justPlaced === i ? 'ring-2 ring-brand' : ''}`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline text-ink-muted">
                    <span className="material-symbols-outlined" aria-hidden="true">add</span>
                  </span>
                  <span className="min-w-0 flex-1 break-words">{text}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}