import { useEffect, useState } from 'react'

// A number that counts up (or down) from `from` to `to`, used for scores on the quiz leaderboards.

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3)
}

// The value at `progress` (0 to 1) of the way from `from` to `to`: quick at first, slowing into the final number.
export function countUpValue(from, to, progress) {
  const p = Math.min(1, Math.max(0, progress))
  return Math.round(from + (to - from) * easeOutCubic(p))
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

export function useCountUp(from, to, { durationMs = 900, delayMs = 0 } = {}) {
  const reduce = prefersReducedMotion()
  const [value, setValue] = useState(reduce ? to : from)

  useEffect(() => {
    if (reduce || from === to) {
      setValue(to)
      return undefined
    }
    setValue(from)
    let frame
    let startedAt = null
    const timer = setTimeout(() => {
      const tick = (now) => {
        if (startedAt === null) startedAt = now
        const progress = (now - startedAt) / durationMs
        setValue(countUpValue(from, to, progress))
        if (progress < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }, delayMs)
    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(frame)
    }
  }, [from, to, durationMs, delayMs, reduce])

  return value
}
