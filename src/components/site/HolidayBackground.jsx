import { useTheme } from '../../lib/ThemeContext'
import { useHolidayPageBackground } from '../../lib/useHolidayPageBackground'
import { holidayImageUrl } from '../../data/holidays'

// The festive page background: a fixed layer that fills the role `bg-paper` holds on the site's two
// shells, so a live holiday can paint the whole page behind the content — an uploaded picture under a
// readability wash, or a gradient from the theme's own palette when no picture is set.
// Spec: docs/superpowers/specs/2026-10-21-holiday-page-background-design.md §2.
//
// Same rules as HolidayDecor: public and admin only, never the quiz screens (the hook enforces the
// shared quiz-surface list), always pointer-events-none, and a layer that fails to render is just the
// plain page again.

// The wash the approved mockup pins: a veil over the picture so hero text and headings always read.
// One picture serves both modes — the veil flips with the reader's mode instead of a second upload.
const WASH = {
  light: 'rgba(255, 255, 255, 0.55)',
  dark: 'rgba(10, 10, 10, 0.6)',
}

export default function HolidayBackground() {
  const theme = useHolidayPageBackground()
  const { theme: mode } = useTheme()
  if (!theme) return null

  const url = theme.background.image ? holidayImageUrl(theme.background.image) : null
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {url ? (
        <div
          className="absolute inset-0"
          style={{ backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
      ) : (
        // The fallback: a gradient of the theme's own tokens. `--color-paper` is behind this layer on
        // the body, so the gradient reads as the page rather than as a card, and a theme that sets no
        // palette colours still paints the site's own paper — festive or plain, never broken.
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(160deg, var(--color-surface-low), var(--color-paper))' }}
        />
      )}
      {url && <div className="absolute inset-0" style={{ background: WASH[mode] ?? WASH.light }} />}
    </div>
  )
}
