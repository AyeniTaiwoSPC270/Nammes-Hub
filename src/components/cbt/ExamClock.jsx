import { useEffect, useRef, useState } from 'react'
import { msLeft, formatClock, clockTone } from '../../data/cbt'

// The countdown for the whole paper. The server owns the deadline; this only shows it (corrected by `offset`, the gap
// between the server's clock and this phone's). `onExpire` fires once when it reaches zero.
const TONE = {
  calm: 'border-hairline bg-surface text-ink-900',
  warn: 'border-amber-500 bg-amber-500/15 text-amber-700',
  danger: 'border-red-600 bg-red-600/15 text-red-600',
}

export default function ExamClock({ deadlineAt, offset, onExpire }) {
  const [left, setLeft] = useState(() => msLeft(deadlineAt, offset))
  const fired = useRef(false)
  const expire = useRef(onExpire)
  useEffect(() => {
    expire.current = onExpire
  })

  useEffect(() => {
    fired.current = false
    const tick = () => {
      const next = msLeft(deadlineAt, offset)
      setLeft(next)
      if (next !== null && next <= 0 && !fired.current) {
        fired.current = true
        expire.current?.()
      }
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [deadlineAt, offset])

  if (left === null) return null
  const tone = clockTone(left)
  // Screen readers hear the time only at a few moments, not every second.
  const spoken = left <= 60_000 ? 'Less than one minute left' : left <= 10 * 60_000 ? 'Less than ten minutes left' : ''
  return (
    <div className="flex items-center gap-2">
      <div role="timer" aria-label="Time left" className={`rounded-xl border-2 px-3 py-1.5 font-mono text-lg font-bold tabular-nums ${TONE[tone]}`}>
        {formatClock(left)}
      </div>
      <span className="sr-only" role="status" aria-live="polite">{spoken}</span>
    </div>
  )
}
