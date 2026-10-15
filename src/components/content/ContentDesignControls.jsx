// The control set for the Events and News Design Studio.
//
// Built from the shared primitives in ../admin/forms/DesignControls.jsx, on the same contract
// CalendarDesignControls uses: the panel holds the RAW draft and calls `onChange` with a whole new draft.
// Nothing here reads the theme's own defaults -- the studio cleans the draft for display and this panel
// draws from the unsanitised values, so a control can never be showing a fallback while the preview is
// showing something else.
import {
  DENSITIES,
  FEATURED,
  IMAGE_ASPECTS,
  IMAGE_MODES,
  PAGES,
  RADII,
  SHADOWS,
  SWATCHES,
  TITLE_SIZES,
  CLAMP_RANGE,
  COLUMN_RANGE,
} from '../../../api/_lib/contentTheme.js'
import { defaultTheme } from '../../../api/_lib/contentTheme.js'
import { ControlSection, Segmented, Slider, ToggleIcon } from '../admin/forms/DesignControls'

const options = (list, labels = {}) => list.map((value) => ({ value, label: labels[value] ?? value }))

const RADIUS_LABELS = { sm: 'Sharp', md: 'Soft', lg: 'Round', full: 'Pill' }
const SHADOW_LABELS = { none: 'Flat', sm: 'Faint', md: 'Soft', lg: 'Deep' }
const IMAGE_LABELS = { cover: 'Whole picture', plain: 'Cropped', none: 'No picture' }
const DENSITY_LABELS = { compact: 'Compact', comfortable: 'Comfortable', spacious: 'Roomy' }
const TITLE_LABELS = { sm: 'Small', md: 'Medium', lg: 'Large', xl: 'Huge' }
const FEATURED_LABELS = { none: 'No lead story', 'image-left': 'Lead, picture left', 'image-top': 'Lead, picture above' }
const ASPECT_LABELS = { short: 'Square', md: '4:3', tall: 'Tall', wide: 'Wide' }

/**
 * The eight swatches as buttons. Each shows the colour it will actually paint by reading the token, rather
 * than a hard-coded hex here -- a second copy of the palette is how a swatch ends up showing green while
 * the page paints brown.
 */
function SwatchPicker({ value, hex, onChange }) {
  const pick = (id) => onChange({ color: id, hex: '' })
  return (
    <div className="flex flex-wrap gap-1.5">
      {SWATCHES.map((swatch) => {
        const active = value === swatch.id && !hex
        return (
          <button
            key={swatch.id}
            type="button"
            onClick={() => pick(swatch.id)}
            aria-pressed={active}
            title={swatch.label}
            className={[
              'h-9 w-9 rounded-md border-2 transition-colors',
              active ? 'border-ink-900' : 'border-hairline hover:border-ink-muted',
            ].join(' ')}
            style={{ background: `var(${swatch.token})` }}
          >
            <span className="sr-only">{swatch.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * The Advanced hex field.
 *
 * Kept, and kept next to the swatch, because clearing it is how an admin gets back to a curated colour. The
 * note is not decoration: an advanced hex does NOT follow the site into dark mode, since there is no token
 * behind it, and an admin who has chosen one deserves to know that before it goes live.
 */
function AdvancedColor({ hex, onChange }) {
  return (
    <div className="flex flex-col gap-2 border-t border-hairline pt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-ink">Advanced</span>
        <div className="flex items-center gap-2">
          {hex && (
            <button type="button" onClick={() => onChange('')} className="text-xs font-semibold text-brand hover:underline">
              Reset
            </button>
          )}
          <input
            type="color"
            value={hex || '#000000'}
            onChange={(event) => onChange(event.target.value)}
            aria-label="Advanced accent colour"
            className="h-9 w-12 cursor-pointer rounded-md border border-hairline bg-surface p-0.5"
          />
        </div>
      </div>
      {hex && (
        <p className="text-xs text-ink-muted">
          A custom colour has no token behind it, so it will not lighten for dark mode. Pick a swatch above to
          come back to one that does.
        </p>
      )}
    </div>
  )
}

/**
 * One control changed: return the draft with `group` replaced by `value`.
 *
 * Separate and pure so the shape of a control's write is testable. The bug this replaced destructured the
 * GROUP NAME as if it were a path -- `const [group, key] = 'card'` yields `'c'` and `'a'`, so every control
 * in the panel wrote to a junk key that sanitizeTheme then dropped. Nothing appeared to do anything, and
 * because the draft never changed, `dirty` stayed false and Save stayed disabled.
 */
export function applyControl(draft, group, value) {
  return { ...draft, [group]: value }
}

export default function ContentDesignControls({ draft, page, onChange }) {
  // Every call site passes the group's WHOLE replacement object (`{ ...card, radius }`), so this only has to
  // attach it under the right key. Reading `draft.x` rather than destructuring the draft means one that has
  // not loaded yet cannot make this throw.
  const set = (group, value) => onChange(applyControl(draft, group, value))
  const accent = draft?.accent ?? {}
  const card = draft?.card ?? {}
  const type = draft?.type ?? {}
  const layout = draft?.layout ?? {}
  const isEvents = page === 'events'
  // The sanitised defaults, NOT the range minimums. `type.clamp ?? CLAMP_RANGE.min` would put the slider on 2
  // while the preview showed 3 the moment a draft ever arrived without the key -- which is the exact
  // disagreement the header comment above says this panel must not be capable of.
  const fallback = defaultTheme(page)

  return (
    <div>
      <ControlSection title="Accent">
        <div className="flex flex-col gap-3">
          <SwatchPicker value={accent.color} hex={accent.hex} onChange={(next) => set('accent', next)} />
          <AdvancedColor hex={accent.hex} onChange={(hex) => set('accent', { ...accent, hex })} />
        </div>
      </ControlSection>

      <ControlSection title="Cards">
        <div className="flex flex-col gap-3">
          <Segmented label="Corners" value={card.radius} options={options(RADII, RADIUS_LABELS)} onChange={(radius) => set('card', { ...card, radius })} />
          <Segmented label="Shadow" value={card.shadow} options={options(SHADOWS, SHADOW_LABELS)} onChange={(shadow) => set('card', { ...card, shadow })} />
          <Segmented label="Picture" value={card.image} options={options(IMAGE_MODES, IMAGE_LABELS)} onChange={(image) => set('card', { ...card, image })} />
          <Segmented label="Spacing" value={card.density} options={options(DENSITIES, DENSITY_LABELS)} onChange={(density) => set('card', { ...card, density })} />
        </div>
      </ControlSection>

      <ControlSection title="Text">
        <div className="flex flex-col gap-3">
          <Segmented label="Title size" value={type.titleSize} options={options(TITLE_SIZES, TITLE_LABELS)} onChange={(titleSize) => set('type', { ...type, titleSize })} />
          <Slider
            label="Cut off after"
            value={type.clamp ?? fallback.type.clamp}
            min={CLAMP_RANGE.min}
            max={CLAMP_RANGE.max}
            unit=" lines"
            onChange={(clamp) => set('type', { ...type, clamp })}
          />
        </div>
      </ControlSection>

      <ControlSection title="Layout">
        <div className="flex flex-col gap-3">
          <Slider
            label="Columns"
            value={layout.columns ?? fallback.layout.columns}
            min={COLUMN_RANGE.min}
            max={COLUMN_RANGE.max}
            onChange={(columns) => set('layout', { ...layout, columns })}
          />
          <Segmented
            label="Picture shape"
            value={layout.imageAspect}
            options={options(IMAGE_ASPECTS, ASPECT_LABELS)}
            onChange={(imageAspect) => set('layout', { ...layout, imageAspect })}
          />
          {/* The featured card is not offered on the events page at all, rather than offered and then quietly
              reverted by the sanitiser: an admin who could see a control that does nothing would not trust
              the rest of the panel. */}
          {isEvents ? (
            <p className="text-xs text-ink-muted">
              Events are grouped by date rather than by importance, so there is no lead story on this page.
            </p>
          ) : (
            <Segmented
              label="Lead story"
              value={layout.featured}
              options={options(FEATURED, FEATURED_LABELS)}
              onChange={(featured) => set('layout', { ...layout, featured })}
            />
          )}
          <div className="flex items-center gap-2">
            <ToggleIcon
              icon="tune"
              label="Stagger cards as they appear"
              active={Boolean(layout.stagger)}
              onClick={() => set('layout', { ...layout, stagger: !layout.stagger })}
            />
            <span className="text-xs text-ink-muted">Fade the cards in one after another</span>
          </div>
        </div>
      </ControlSection>
    </div>
  )
}

/** The label a studio screen shows for its page, from the same list the theme sanitiser holds. */
export function pageLabel(page) {
  return page === 'events' ? 'Events' : PAGES.includes(page) ? 'News' : 'Content'
}