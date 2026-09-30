import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// Keeps a projector screen on one page. First the content is shrunk (never below a readable size) until the page stops
// needing a scroll bar; if it still does not fit, the page scrolls down by itself, pauses at the bottom, and comes back.
// Moving the mouse wheel, touching the screen or pressing a key pauses the automatic scroll for a while.

export const FIT_STEPS = [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6]
export const AUTO_SCROLL = { pauseMs: 2500, downPxPerSec: 45, upPxPerSec: 140, resumeAfterMs: 15000 }

// The biggest zoom from FIT_STEPS for which `fits(zoom)` is true, or the smallest step if none fit.
export function pickFitZoom(fits, steps = FIT_STEPS) {
  for (const zoom of steps) if (fits(zoom)) return zoom
  return steps[steps.length - 1]
}

// Where the page should be `elapsedMs` into the automatic scroll, for a page that can scroll `max` pixels:
// wait at the top, scroll down slowly, wait at the bottom, scroll back up quicker, repeat.
export function autoScrollY(elapsedMs, max, config = AUTO_SCROLL) {
  if (!(max > 0)) return 0
  const down = (max / config.downPxPerSec) * 1000
  const up = (max / config.upPxPerSec) * 1000
  const cycle = config.pauseMs + down + config.pauseMs + up
  const t = ((elapsedMs % cycle) + cycle) % cycle
  if (t < config.pauseMs) return 0
  if (t < config.pauseMs + down) return ((t - config.pauseMs) / down) * max
  if (t < config.pauseMs + down + config.pauseMs) return max
  return max - ((t - config.pauseMs - down - config.pauseMs) / up) * max
}

function zoomSupported() {
  return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('zoom', '1')
}

const overflows = () => document.documentElement.scrollHeight > window.innerHeight + 1

// Shrinks `ref`'s element to fit the window. Returns true while the page still needs scrolling at the smallest size.
// `baseMaxWidth` (px) is the content's width limit at full size; it is widened as the content shrinks so a wide
// projector is still filled.
export function useProjectorFit(ref, { baseMaxWidth } = {}) {
  const [stillOverflowing, setStillOverflowing] = useState(false)
  const runRef = useRef(() => {})

  runRef.current = () => {
    const el = ref.current
    if (!el) return
    if (zoomSupported()) {
      const apply = (z) => {
        el.style.zoom = String(z)
        if (baseMaxWidth) el.style.maxWidth = `${baseMaxWidth / z}px`
      }
      const zoom = pickFitZoom((z) => {
        apply(z)
        return !overflows()
      })
      apply(zoom)
    }
    const over = overflows()
    setStillOverflowing((prev) => (prev === over ? prev : over))
  }

  // After every render (the screen changed), and again each second in case sizes changed without a render.
  useLayoutEffect(() => {
    runRef.current()
  })
  useEffect(() => {
    const again = () => runRef.current()
    const timer = setInterval(again, 1000)
    window.addEventListener('resize', again)
    return () => {
      clearInterval(timer)
      window.removeEventListener('resize', again)
    }
  }, [])

  return stillOverflowing
}

// Scrolls the page up and down by itself while `active`. Does nothing if the person asked the browser for less motion.
export function useAutoScroll(active) {
  useEffect(() => {
    if (!active || typeof window === 'undefined') return undefined
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined
    let frame = 0
    let pausedUntil = 0
    let startedAt = performance.now()
    const interrupt = () => {
      pausedUntil = performance.now() + AUTO_SCROLL.resumeAfterMs
    }
    const events = ['wheel', 'touchstart', 'pointerdown', 'keydown']
    events.forEach((name) => window.addEventListener(name, interrupt, { passive: true }))

    function tick(now) {
      const max = document.documentElement.scrollHeight - window.innerHeight
      if (now < pausedUntil) {
        startedAt = now - AUTO_SCROLL.pauseMs // when it resumes, start from the top of the cycle
      } else if (max > 1) {
        window.scrollTo(0, autoScrollY(now - startedAt, max))
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      events.forEach((name) => window.removeEventListener(name, interrupt))
    }
  }, [active])
}
