import { useEffect, useLayoutEffect, useRef } from 'react'

// Keeps a projector screen on one page by shrinking its content (never below a readable size) until the page stops
// needing a scroll bar. If it still does not fit at the smallest size, the page simply scrolls as normal.

export const FIT_STEPS = [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6]

// The biggest zoom from FIT_STEPS for which `fits(zoom)` is true, or the smallest step if none fit.
export function pickFitZoom(fits, steps = FIT_STEPS) {
  for (const zoom of steps) if (fits(zoom)) return zoom
  return steps[steps.length - 1]
}

function zoomSupported() {
  return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('zoom', '1')
}

const overflows = () => document.documentElement.scrollHeight > window.innerHeight + 1
const pageSize = () => `${document.documentElement.scrollHeight}x${window.innerHeight}x${window.innerWidth}`

// Shrinks `ref`'s element to fit the window. `baseMaxWidth` (px) is the content's width limit at full size; it is
// widened as the content shrinks so a wide projector is still filled.
export function useProjectorFit(ref, { baseMaxWidth } = {}) {
  const runRef = useRef(() => {})
  const lastSize = useRef('')

  // The host screen re-renders several times a second (the countdown), so the fit only runs again when the page's
  // size has actually changed. Trying every zoom step on each tick made the screen lag and jitter.
  runRef.current = (force = false) => {
    const el = ref.current
    if (!el || !zoomSupported()) return
    const size = pageSize()
    if (!force && size === lastSize.current) return
    const apply = (z) => {
      el.style.zoom = String(z)
      if (baseMaxWidth) el.style.maxWidth = `${baseMaxWidth / z}px`
    }
    apply(pickFitZoom((z) => {
      apply(z)
      return !overflows()
    }))
    lastSize.current = pageSize()
  }

  // After every render (the screen changed), and again each second in case sizes changed without a render.
  useLayoutEffect(() => {
    runRef.current()
  })
  useEffect(() => {
    const again = () => runRef.current()
    const onResize = () => runRef.current(true)
    const timer = setInterval(again, 1000)
    window.addEventListener('resize', onResize)
    return () => {
      clearInterval(timer)
      window.removeEventListener('resize', onResize)
    }
  }, [])
}
