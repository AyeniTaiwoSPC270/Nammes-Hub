// The look of the /events and /news pages, designed in the Events and News Design Studio. Pure and
// dependency-free like every other file in api/_lib: the studio, the public pages, Home and the tests all
// clean a theme through this one function, so a hand-edited row can never put a colour, a word or a
// class name on those pages that nothing here vetted.
//
// Two facts about this file are load-bearing:
//
// 1. THE THEME IS PAGE-AWARE. `sanitizeTheme(input, page)` is the only judge, and it is told which page
//    it is judging for. A news page has a featured card and an events page has none, because events are
//    grouped by date and not by importance -- so `layout.featured` is settled to 'none' on events rather
//    than trusted, and a news design pointed at /events cannot smuggle one across.
//
// 2. EVERY TAILWIND-FACED SETTING IS EMITTED AS A CSS CUSTOM PROPERTY, NOT AS A CLASS. `grid-cols-3` is
//    a static string, so a setting cannot reach it; the look is carried by `--content-*` variables and a
//    dozen lines of CSS in src/index.css. The scale maps below therefore hold CSS values, the same way
//    calendarTheme.js:36-39 holds RADIUS_PX and CELL_MIN.
//
// Colours are the interesting case, and they work exactly as they do in calendarTheme.js: a theme stores
// a *swatch id* rather than a CSS value, so an accent re-skins through the token it names and follows the
// site into dark mode for free. An admin who wants a colour the curated list does not have types a hex
// into the Advanced field; it is kept alongside the swatch id, so the picker still shows something chosen.

export const PAGES = ['events', 'news']

// The eight curated choices, copied from calendarTheme.js SWATCHES rather than imported: importing would
// couple this studio to the calendar one, and AGENTS.md records that these studios stay independent (each
// has its own table, its own data module and its own sanitiser). Every `token` is a real @theme colour in
// src/index.css: naming the token rather than a hex is what keeps a look legible in both themes.
export const SWATCHES = [
  { id: 'brand', label: 'Brand', token: '--color-brand' },
  { id: 'forest', label: 'Forest', token: '--color-green-900' },
  { id: 'flame', label: 'Flame', token: '--color-orange-500' },
  { id: 'ember', label: 'Ember', token: '--color-orange-600' },
  { id: 'sand', label: 'Sand', token: '--color-orange-100' },
  { id: 'success', label: 'Green', token: '--color-success' },
  { id: 'warning', label: 'Amber', token: '--color-warning' },
  { id: 'danger', label: 'Red', token: '--color-danger' },
]

const SWATCH_IDS = SWATCHES.map((s) => s.id)
const SWATCH_BY_ID = new Map(SWATCHES.map((s) => [s.id, s]))

export const RADII = ['sm', 'md', 'lg', 'full']
export const SHADOWS = ['none', 'sm', 'md', 'lg']
export const IMAGE_MODES = ['cover', 'plain', 'none']
export const DENSITIES = ['compact', 'comfortable', 'spacious']
export const TITLE_SIZES = ['sm', 'md', 'lg', 'xl']
export const FEATURED = ['none', 'image-left', 'image-top']
export const IMAGE_ASPECTS = ['short', 'md', 'tall', 'wide']

export const CLAMP_RANGE = { min: 2, max: 6 }
export const COLUMN_RANGE = { min: 1, max: 4 }
export const NAME_MAX = 40

// Mirrors --radius-* and --shadow-* in src/index.css, so a content card and a site card round and lift
// the same way.
const RADIUS_PX = { sm: '4px', md: '8px', lg: '12px', full: '9999px' }
const SHADOW_PX = {
  none: 'none',
  sm: '0 1px 2px rgba(0, 0, 0, 0.06)',
  md: '0px 4px 20px rgba(0, 0, 0, 0.05)',
  lg: '0 10px 24px rgba(0, 0, 0, 0.10)',
}
const PAD_PX = { compact: '16px', comfortable: '24px', spacious: '32px' }
const TITLE_PX = { sm: '18px', md: '20px', lg: '24px', xl: '28px' }
// `wide` for news (a h-48 card in a three-column grid is about 1.9:1) and `tall` for events (which have
// always been aspect-[3/4]). One list, two defaults -- see PAGE_DEFAULTS.
const ASPECT_RATIO = { short: '1 / 1', md: '4 / 3', tall: '3 / 4', wide: '16 / 9' }

const HEX = /^#[0-9a-f]{6}$/i

/**
 * The one place a page's *default* image proportion is decided, and the reason it is data rather than a
 * constant in DEFAULT_THEME: the news and events cards have always had different proportions, so a single
 * default would restyle one of the two pages the moment this shipped. `layout.imageAspect` stays editable
 * on both -- only the starting value is per-page.
 */
export const PAGE_DEFAULTS = Object.freeze({
  events: Object.freeze({ imageAspect: 'tall' }),
  news: Object.freeze({ imageAspect: 'wide' }),
})

/**
 * The default theme, expressed as the news page. `page` inside it is the fallback for an unknown page,
 * which is why it is 'news' and not 'events': news is the page with the larger surface, so the two
 * defaults are the same everywhere except `imageAspect`, and a caller that forgot to pass a page gets the
 * more general of the two.
 *
 * Every value here is chosen to match what these cards rendered BEFORE this existed, because shipping a
 * studio should not restyle the page it styles. `--radius-lg` is 12px (src/index.css:41) and that is what
 * `rounded-lg` gave; the clamp is 2 because the news grid title was `line-clamp-2`; the padding is 24px
 * because `p-6` was.
 */
export const DEFAULT_THEME = Object.freeze({
  accent: Object.freeze({ color: 'brand', hex: '' }),
  card: Object.freeze({ radius: 'lg', shadow: 'md', image: 'cover', density: 'comfortable' }),
  type: Object.freeze({ titleSize: 'md', clamp: 2 }),
  layout: Object.freeze({
    page: 'news',
    columns: 3,
    featured: 'image-left',
    imageAspect: 'wide',
    stagger: true,
  }),
})

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function oneOf(list, value, fallback) {
  return list.includes(value) ? value : fallback
}

// Only a real number, like calendarTheme.js int(): a numeric string from a query param or a null from a
// hand-edited row is not a setting, it is the default with extra steps.
function int(value, min, max, fallback) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

// Only a real boolean counts. A missing key, a null from a hand-edited row and the string 'false' all fall
// back, because Boolean('false') is true and a switch that cannot be switched off is worse than a default.
function bool(value, fallback) {
  return typeof value === 'boolean' ? value : fallback
}

// A colour, as a swatch id plus the admin's optional Advanced hex.
//
// Both fields are read on purpose. Reading `color` alone made cleaning non-idempotent in the calendar
// studio: a theme that already held a hex came back with the hex stripped, so a colour typed into the
// Advanced field vanished the moment the studio sanitised the draft again. A hex is accepted in either
// slot, because a hand-edited row or an older save can carry it in `color`.
function cleanAccent(value, fallback, hexValue = '') {
  const given = typeof value === 'string' ? value.trim() : ''
  const givenHex = typeof hexValue === 'string' ? hexValue.trim() : ''
  const candidate = HEX.test(givenHex) ? givenHex : given
  return {
    id: SWATCH_IDS.includes(given) ? given : fallback,
    hex: HEX.test(candidate) ? candidate.toLowerCase() : '',
  }
}

/**
 * Anything goes in, a complete valid theme for `page` comes out. Missing or bad values fall back to the
 * defaults, and the return is a literal, so unknown keys are dropped rather than carried: that is the
 * line a hand-edited row cannot cross to put a class name into a style attribute.
 */
export function sanitizeTheme(input, page = DEFAULT_THEME.layout.page) {
  const t = object(input)
  const a = object(t.accent)
  const c = object(t.card)
  const y = object(t.type)
  const l = object(t.layout)
  const d = DEFAULT_THEME
  const accent = cleanAccent(a.color, d.accent.color, a.hex)

  return {
    accent: { color: accent.id, hex: accent.hex },
    card: {
      radius: oneOf(RADII, c.radius, d.card.radius),
      shadow: oneOf(SHADOWS, c.shadow, d.card.shadow),
      image: oneOf(IMAGE_MODES, c.image, d.card.image),
      density: oneOf(DENSITIES, c.density, d.card.density),
    },
    type: {
      titleSize: oneOf(TITLE_SIZES, y.titleSize, d.type.titleSize),
      clamp: int(y.clamp, CLAMP_RANGE.min, CLAMP_RANGE.max, d.type.clamp),
    },
    layout: {
      // Echoed from the row the design was saved against, never from the design payload: a look's page is
      // decided by which admin screen saved it, and a payload that disagreed would move a design between
      // the two pages behind the admin's back.
      page: PAGES.includes(page) ? page : d.layout.page,
      columns: int(l.columns, COLUMN_RANGE.min, COLUMN_RANGE.max, d.layout.columns),
      // The one setting the page decides outright. An events page has nothing to feature, so this is not
      // an allow-list check on events -- it is 'none', whatever the row says.
      featured: page === 'news' ? oneOf(FEATURED, l.featured, d.layout.featured) : 'none',
      imageAspect: oneOf(
        IMAGE_ASPECTS,
        l.imageAspect,
        PAGE_DEFAULTS[page]?.imageAspect ?? d.layout.imageAspect,
      ),
      stagger: bool(l.stagger, d.layout.stagger),
    },
  }
}

/** The cleaned theme for a page, without an admin-authored draft behind it. */
export function defaultTheme(page = DEFAULT_THEME.layout.page) {
  return sanitizeTheme(undefined, page)
}

/**
 * How long the `name` column allows, as a write helper rather than a rule the studio has to remember:
 * the DDL check is `char_length(name) between 1 and 40` (20261015100000_content_looks.sql:26).
 */
export function cleanLookName(value, fallback = 'Untitled design') {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed ? trimmed.slice(0, NAME_MAX) : fallback
}

// A colour as CSS: the admin's hex if they typed one, otherwise the token behind the swatch id. The token
// reference is what makes the whole thing dark-mode safe for free -- the site's `.dark` block redefines it.
function colorVar(id, hex) {
  return hex || `var(${SWATCH_BY_ID.get(id).token})`
}

/**
 * The CSS custom properties a theme sets on a page wrapper.
 *
 * `theme` is cleaned here rather than assumed clean, and the page is read off the cleaned theme's own
 * `layout.page` rather than passed in. A sanitised theme always carries the page it was judged for, so
 * reading it back is exact -- and it removes the way a caller could pass a news page alongside an events
 * theme and quietly render the wrong one.
 */
export function themeVars(theme) {
  const page = object(object(theme).layout).page
  const t = sanitizeTheme(theme, PAGES.includes(page) ? page : DEFAULT_THEME.layout.page)
  const vars = {
    '--content-accent': colorVar(t.accent.color, t.accent.hex),
    '--content-radius': RADIUS_PX[t.card.radius],
    '--content-shadow': SHADOW_PX[t.card.shadow],
    '--content-pad': PAD_PX[t.card.density],
    '--content-title': TITLE_PX[t.type.titleSize],
    '--content-clamp': String(t.type.clamp),
    '--content-aspect': ASPECT_RATIO[t.layout.imageAspect],
    '--content-cols': String(t.layout.columns),
  }
  // Repointing a token at a swatch that *is* that same token is a custom-property cycle, and CSS drops the
  // whole chain to its initial value -- light mode would fall back silently and dark mode not at all. So a
  // mapping is only emitted when it actually changes something. Copied from calendarTheme.js:200-206.
  //
  // `--color-brand-orange` is in this list and is the one that matters most: src/index.css:27-32 exists
  // precisely to say that `--color-brand-orange` is the "text/borders/icons on a page surface" accent, which
  // is what a card's category label and its Read more link are. Without it here the Accent control would
  // repoint two tokens that almost nothing on these pages uses and change nothing a visitor can see.
  const source = t.accent.hex ? null : SWATCH_BY_ID.get(t.accent.color).token
  for (const token of ['--color-brand', '--color-brand-orange', '--color-green-900']) {
    if (token !== source) vars[token] = 'var(--content-accent)'
  }
  return vars
}