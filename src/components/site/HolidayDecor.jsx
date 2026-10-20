import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useHolidayTheme } from '../../lib/HolidayThemeProvider'

// The festive half of a holiday theme: a fixed layer of CSS-animated particles (keyframes in
// src/index.css, one rule per effect, disabled under prefers-reduced-motion) and the optional greeting
// banner. Spec: docs/superpowers/specs/2026-10-20-holiday-themes-design.md §2.
//
// Decor reaches public and admin pages and NEVER the quiz screens. The projector and the phones own
// their own look system (quiz_looks, five studios), a phone obeys the low-data rule, and snow over a
// live game would be a bug report rather than festivity — so these prefixes render no overlay at all.
const QUIZ_PREFIXES = ['/host', '/play', '/battle', '/practice', '/make', '/set', '/cbt']

const PARTICLE_COUNT = 26

// Deterministic spread, the backdrop-scatter reasoning: positions and pacing come from the index, so a
// page never rearranges its snow between reloads. Duration and delay are inline custom properties the
// keyframes read, keeping the stylesheet duration-free.
function particleStyle(i) {
  return {
    left: `${(i * 37 + 11) % 100}%`,
    width: 4 + (i % 4) * 2,
    height: 4 + (i % 4) * 2,
    '--holiday-fall': `${10 + ((i * 7) % 12)}s`,
    animationDelay: `-${(i * 13) % 18}s`,
  }
}

export default function HolidayDecor() {
  const theme = useHolidayTheme()
  const { pathname } = useLocation()
  const effect = theme?.decor?.particles
  if (!effect || effect === 'off') return null
  if (QUIZ_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return null
  return (
    <div className="holiday-particles" aria-hidden="true">
      {Array.from({ length: PARTICLE_COUNT }, (_, i) => (
        <span key={i} className={`holiday-particle holiday-p--${effect}`} style={particleStyle(i)} />
      ))}
    </div>
  )
}

const DISMISS_KEY = 'nammes-holiday-banner'

/**
 * The greeting strip. Rendered by Layout directly under the navbar (and by AdminLayout), not by the
 * provider: "below the navbar" is a place in the page, and the provider wraps routes that have no
 * navbar at all. Dismissal is per session and per theme — a reload brings it back, and next year's
 * greeting is not silenced by this year's click.
 */
export function HolidayBanner() {
  const theme = useHolidayTheme()
  const [dismissedId, setDismissedId] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY)
    } catch {
      return null
    }
  })
  const banner = theme?.decor?.banner
  if (!banner || dismissedId === theme.id) return null

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, theme.id)
    } catch {
      // A browser with storage locked still gets its banner back on reload; nothing else breaks.
    }
    setDismissedId(theme.id)
  }

  return (
    <div className="relative z-40 flex items-center justify-center gap-2 bg-brand px-10 py-2 text-center">
      <p className="text-sm font-semibold" style={{ color: 'var(--color-surface)' }}>
        {banner}
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss the greeting"
        className="absolute right-2 cursor-pointer rounded p-1 opacity-70 transition-opacity hover:opacity-100"
        style={{ color: 'var(--color-surface)' }}
      >
        <span className="material-symbols-outlined text-base">close</span>
      </button>
    </div>
  )
}
