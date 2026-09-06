import { useEffect, useState } from 'react'
import { useTour } from '../../lib/TourContext'
import Button from '../ui/Button'

function findVisibleTarget(key) {
  const nodes = document.querySelectorAll(`[data-tour="${key}"]`)
  for (const node of nodes) {
    const rect = node.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) return node
  }
  return null
}

export default function SpotlightOverlay() {
  const { phase, spotlightStep, spotlightIndex, nextSpotlight, skip } = useTour()
  const [rect, setRect] = useState(null)

  useEffect(() => {
    if (phase !== 'spotlight') {
      setRect(null)
      return undefined
    }

    let frame
    let attempts = 0

    function measure() {
      const node = findVisibleTarget(spotlightStep.target)
      if (!node) {
        attempts += 1
        if (attempts < 30) frame = requestAnimationFrame(measure)
        return
      }
      node.scrollIntoView({ block: 'center', behavior: 'auto' })
      frame = requestAnimationFrame(() => setRect(node.getBoundingClientRect()))
    }

    measure()
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
    }
  }, [phase, spotlightIndex, spotlightStep])

  if (phase !== 'spotlight' || !rect) return null

  const padding = 6
  const holeStyle = {
    position: 'fixed',
    top: rect.top - padding,
    left: rect.left - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
    borderRadius: 8,
    boxShadow: '0 0 0 9999px rgba(11, 36, 23, 0.6)',
    transition: 'top .2s ease, left .2s ease, width .2s ease, height .2s ease',
    pointerEvents: 'none',
    zIndex: 100,
  }

  const cardWidth = 280
  const viewportPadding = 16
  const cardLeft = Math.min(
    Math.max(rect.left, viewportPadding),
    window.innerWidth - cardWidth - viewportPadding,
  )
  const cardTop = Math.min(rect.bottom + padding + 12, window.innerHeight - 220)

  const cardStyle = {
    position: 'fixed',
    top: cardTop,
    left: cardLeft,
    width: cardWidth,
    zIndex: 101,
  }

  return (
    <>
      <div style={holeStyle} />
      <div style={cardStyle} className="rounded-lg border border-hairline bg-surface p-5 shadow-md">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[.03em] text-ink-muted">
          {spotlightStep.eyebrow}
        </span>
        <h3 className="mb-2 text-lg font-bold text-ink-900">{spotlightStep.heading}</h3>
        <p className="mb-4 text-sm leading-relaxed text-ink-muted">{spotlightStep.body}</p>
        <div className="flex items-center justify-between border-t border-hairline pt-3">
          <button type="button" onClick={skip} className="text-sm font-semibold text-ink-muted hover:text-ink-900">
            Skip tour
          </button>
          <Button size="sm" onClick={nextSpotlight}>
            {spotlightStep.cta}
          </Button>
        </div>
      </div>
    </>
  )
}
