import { useEffect } from 'react'
import {
  hasTheme,
  themeVars,
  pageBackground,
  widthPx,
  normalizeTheme,
  loadFormFont,
  cardStyle,
  textStyle,
  safeImageUrl,
} from '../../lib/formTheme'
import { linkifyText } from '../../lib/linkify'
import AdjustableImage from './AdjustableImage'

// Paints the page background and re-skins everything inside via CSS variables. With no theme it
// renders the form exactly as it always looked. `contained` is for the design preview, where the
// background must stay inside its own scroll box instead of spanning the page.
export default function FormThemeShell({ theme, contained = false, children }) {
  const custom = hasTheme(theme)
  const t = custom ? normalizeTheme(theme) : null

  useEffect(() => {
    if (!t) return
    loadFormFont(t.fonts.heading)
    loadFormFont(t.fonts.body)
  }, [t?.fonts.heading, t?.fonts.body]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!t) return <div className="mx-auto max-w-[700px] px-5 py-12 sm:px-6">{children}</div>

  const bg = pageBackground(t)
  const imageUrl = bg?.image ? safeImageUrl(bg.image.url) : ''

  return (
    <div
      className={['form-themed relative isolate', contained ? 'min-h-full' : 'min-h-[70svh]'].join(' ')}
      style={{ ...themeVars(t), background: bg ? bg.base : undefined }}
    >
      {bg && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          {bg.gradient && <div className="absolute inset-0" style={{ background: bg.gradient }} />}
          {imageUrl && (
            <div className={contained ? 'absolute inset-0' : 'sticky top-0 h-svh w-full'} style={{ overflow: 'hidden' }}>
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url("${imageUrl}")`,
                  backgroundSize: 'cover',
                  backgroundPosition: `${bg.image.x}% ${bg.image.y}%`,
                  transform: `scale(${bg.image.zoom * (bg.imageBlur > 0 ? 1.08 : 1)}) scaleX(${bg.image.flipH ? -1 : 1})`,
                  transformOrigin: `${bg.image.x}% ${bg.image.y}%`,
                  filter: [
                    bg.imageBlur > 0 ? `blur(${bg.imageBlur}px)` : '',
                    bg.image.brightness !== 100 ? `brightness(${bg.image.brightness}%)` : '',
                    bg.image.contrast !== 100 ? `contrast(${bg.image.contrast}%)` : '',
                    bg.image.saturate !== 100 ? `saturate(${bg.image.saturate}%)` : '',
                    bg.image.grayscale > 0 ? `grayscale(${bg.image.grayscale}%)` : '',
                  ].filter(Boolean).join(' ') || undefined,
                  opacity: bg.imageOpacity / 100,
                }}
              />
              {bg.imageDim > 0 && <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${bg.imageDim / 100})` }} />}
            </div>
          )}
        </div>
      )}
      <div className="mx-auto px-5 py-12 sm:px-6" style={{ maxWidth: widthPx(t) + 48, position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  )
}

/** Title card: optional banner image, then the title and description in the theme's text styles. */
export function FormHeaderCard({ form, theme }) {
  const custom = hasTheme(theme)
  if (!custom) {
    return (
      <>
        <h1 className="text-3xl font-bold text-ink-900">{form.title || 'Untitled form'}</h1>
        {form.description && <p className="mt-2 text-ink-muted">{linkifyText(form.description)}</p>}
      </>
    )
  }
  const t = normalizeTheme(theme)
  return (
    <div className="overflow-hidden" style={cardStyle(t)}>
      {t.header && <AdjustableImage image={{ ...t.header, aspect: t.header.aspect === 'free' ? '3:1' : t.header.aspect }} fill />}
      <div className="px-6 py-6">
        <h1 style={{ ...textStyle(t.title, 'var(--color-ink-900)'), fontFamily: 'var(--font-display)', lineHeight: 1.2 }}>
          {form.title || 'Untitled form'}
        </h1>
        {form.description && (
          <p className="mt-2 whitespace-pre-line" style={{ ...textStyle(t.description, 'var(--color-ink-muted)'), lineHeight: 1.5 }}>
            {linkifyText(form.description)}
          </p>
        )}
      </div>
    </div>
  )
}

/** Style for a question card. Falls back to the standard look when the form has no theme. */
export function questionCardStyle(theme) {
  return hasTheme(theme) ? cardStyle(theme) : undefined
}
