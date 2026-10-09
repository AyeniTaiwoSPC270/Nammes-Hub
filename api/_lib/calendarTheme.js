// The look of the academic calendar, designed in the Calendar Design Studio. Pure and dependency-free like every
// other file in api/_lib: the studio, the public calendar and the API all clean a theme through this one
// function, so a hand-edited row can never put a colour or a word on the calendar that nothing here vetted.
//
// Colours are the interesting case. A theme stores a *swatch id*, not a CSS value, so every accent re-skins
// through the token it names and follows the site into dark mode for free. An admin who wants a colour the
// curated list does not have types a hex into the Advanced field; it is kept, but the swatch id stays valid so
// the picker still shows something chosen and one click gets them back to a curated colour.

export const KIND_ORDER = ['lectures', 'exams', 'registration', 'break', 'convocation', 'orientation', 'other']

// The eight curated choices. Every `token` is a real @theme colour in src/index.css: naming the token rather
// than a hex is what keeps the calendar legible in both themes without a second palette to maintain.
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

// The two sources the calendar merges. Kept here rather than at the call site so `sanitizeTheme` and the merge
// handler agree on what a source is called.
export const SOURCE_ORDER = ['academic', 'event']

export const CALENDAR_VIEWS = ['month', 'agenda']
export const CALENDAR_RADII = ['sm', 'md', 'lg', 'full']
export const CALENDAR_DENSITIES = ['comfortable', 'compact']

// Mirrors --radius-* in src/index.css, so a calendar card and a site card round the same corners.
const RADIUS_PX = { sm: '4px', md: '8px', lg: '12px', full: '9999px' }
const CELL_MIN = { comfortable: '112px', compact: '84px' }
const ROW_PAD = { comfortable: '10px', compact: '4px' }

export const LABEL_MAX = 60

const HEX = /^#[0-9a-f]{6}$/i

// `hex` is the Advanced field: '' means "use the swatch". It is part of the default so the rule that every key
// has a fallback stays checkable rather than a thing to remember.
export const DEFAULT_THEME = Object.freeze({
  accents: Object.freeze({
    lectures: Object.freeze({ color: 'brand', icon: 'school', label: 'Lectures', hex: '' }),
    exams: Object.freeze({ color: 'danger', icon: 'assignment', label: 'Exams', hex: '' }),
    registration: Object.freeze({ color: 'warning', icon: 'edit_note', label: 'Registration', hex: '' }),
    break: Object.freeze({ color: 'sand', icon: 'beach_access', label: 'Break', hex: '' }),
    convocation: Object.freeze({ color: 'ember', icon: 'workspace_premium', label: 'Convocation', hex: '' }),
    orientation: Object.freeze({ color: 'flame', icon: 'groups', label: 'Orientation', hex: '' }),
    other: Object.freeze({ color: 'forest', icon: 'event', label: 'Other', hex: '' }),
  }),
  page: Object.freeze({ accent: 'brand', hex: '', radius: 'md', density: 'comfortable' }),
  grid: Object.freeze({ weekStart: 1, showWeekends: true, maxPerDay: 3 }),
  defaults: Object.freeze({ view: 'month', kinds: Object.freeze([...KIND_ORDER]), sources: Object.freeze([...SOURCE_ORDER]) }),
  highlight: Object.freeze({ today: true, nextUp: true }),
})

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function oneOf(list, value, fallback) {
  return list.includes(value) ? value : fallback
}

// Only a real number, like quizTheme's slider reading: a numeric string from a query param or a null from a
// hand-edited row is not a setting, it is the default with extra steps.
function int(value, min, max, fallback) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

function cleanLabel(value, fallback) {
  if (typeof value !== 'string') return fallback
  // Whitespace collapses first so a newline between two words becomes a space rather than welding the
  // words together; whatever control characters are left are then dropped rather than rendered.
  // eslint-disable-next-line no-control-regex
  const trimmed = value.replace(/\s+/g, ' ').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, LABEL_MAX)
  return trimmed || fallback
}

// Material Symbols names are lowercase words. Held to that shape so a theme cannot put a class name, a second
// word or an angle bracket where an icon name belongs.
function cleanIcon(value, fallback) {
  return typeof value === 'string' && /^[a-z_]+$/.test(value) ? value : fallback
}

// An accent value, whether it came from a kind's `color` or the page's `accent`. A swatch id is kept as-is;
// an Advanced hex is kept *alongside* that id, because the picker renders the id and a hex has no swatch to
// select. Anything else is dropped rather than passed through to CSS.
//
// Both fields are read on purpose. Reading `color` alone made cleaning non-idempotent: a theme that already
// held a hex would come back with the hex stripped, so a colour typed in the Advanced field vanished the
// moment the studio sanitised the draft again. A hex is accepted in either slot, because a hand-edited row
// or an older save can carry it in `color`.
function cleanAccent(value, fallback, hexValue = '') {
  const given = typeof value === 'string' ? value.trim() : ''
  const givenHex = typeof hexValue === 'string' ? hexValue.trim() : ''
  const candidate = HEX.test(givenHex) ? givenHex : given
  return {
    id: SWATCH_IDS.includes(given) ? given : fallback,
    hex: HEX.test(candidate) ? candidate.toLowerCase() : '',
  }
}

function cleanKindAccent(kind, raw) {
  const d = DEFAULT_THEME.accents[kind]
  const a = object(raw)
  const accent = cleanAccent(a.color, d.color, a.hex)
  return { color: accent.id, hex: accent.hex, icon: cleanIcon(a.icon, d.icon), label: cleanLabel(a.label, d.label) }
}

// Kinds and sources are allow-listed and returned in KIND_ORDER / SOURCE_ORDER, so cleaning the same theme
// twice gives back the same jsonb however the admin filled the boxes. An empty list means "everything off",
// which would leave the calendar blank, so it falls back to everything on.
function cleanList(value, order, fallback) {
  if (!Array.isArray(value)) return [...fallback]
  const picked = order.filter((item) => value.includes(item))
  return picked.length ? picked : [...fallback]
}

// Only a real boolean counts. A missing key, a null from a hand-edited row and the string 'false' all fall
// back, because Boolean('false') is true and a switch that cannot be switched off is worse than a default.
function bool(value, fallback) {
  return typeof value === 'boolean' ? value : fallback
}

function cleanGrid(raw) {
  const g = object(raw)
  const d = DEFAULT_THEME.grid
  // 0 and 1 are the only two week starts there is; anything in between would silently shift every column.
  const weekStart = g.weekStart === 0 || g.weekStart === 1 ? g.weekStart : d.weekStart
  return {
    weekStart,
    showWeekends: bool(g.showWeekends, d.showWeekends),
    maxPerDay: int(g.maxPerDay, 1, 12, d.maxPerDay),
  }
}

/** Anything goes in, a complete valid theme comes out. Missing or bad values fall back to the defaults. */
export function sanitizeTheme(input) {
  const t = object(input)
  const a = object(t.accents)
  const p = object(t.page)
  const d = object(t.defaults)
  const h = object(t.highlight)
  const accents = {}
  // Driven by KIND_ORDER, not by the stored object, so a kind this file does not know is dropped rather
  // than rendered and a kind it does know is always present.
  for (const kind of KIND_ORDER) accents[kind] = cleanKindAccent(kind, a[kind])
  return {
    accents,
    page: (() => {
      // An IIFE, because the accent is read in two places and a helper would have to hand back a renamed key.
      const accent = cleanAccent(p.accent, DEFAULT_THEME.page.accent, p.hex)
      return {
        accent: accent.id,
        hex: accent.hex,
        radius: oneOf(CALENDAR_RADII, p.radius, DEFAULT_THEME.page.radius),
        density: oneOf(CALENDAR_DENSITIES, p.density, DEFAULT_THEME.page.density),
      }
    })(),
    grid: cleanGrid(t.grid),
    defaults: {
      view: oneOf(CALENDAR_VIEWS, d.view, DEFAULT_THEME.defaults.view),
      kinds: cleanList(d.kinds, KIND_ORDER, DEFAULT_THEME.defaults.kinds),
      sources: cleanList(d.sources, SOURCE_ORDER, DEFAULT_THEME.defaults.sources),
    },
    highlight: {
      today: bool(h.today, DEFAULT_THEME.highlight.today),
      nextUp: bool(h.nextUp, DEFAULT_THEME.highlight.nextUp),
    },
  }
}

// A colour as CSS: the admin's hex if they typed one, otherwise the token behind the swatch id. The token
// reference is what makes the whole thing dark-mode safe for free — the site's dark block redefines it.
function colorVar(id, hex) {
  return hex || `var(${SWATCH_BY_ID.get(id).token})`
}

/**
 * The CSS custom properties a theme sets on the calendar wrapper. Every app-level token here is one
 * formTheme.js `themeVars` already knows how to apply, plus the `--cal-*` names the calendar's own CSS reads.
 */
export function themeVars(theme) {
  const t = sanitizeTheme(theme)
  const vars = {
    '--cal-accent': colorVar(t.page.accent, t.page.hex),
    '--cal-radius': RADIUS_PX[t.page.radius],
    '--cal-cell-min': CELL_MIN[t.page.density],
    '--cal-row-pad': ROW_PAD[t.page.density],
  }
  for (const kind of KIND_ORDER) vars[`--cal-${kind}`] = colorVar(t.accents[kind].color, t.accents[kind].hex)
  // Repointing a token at a swatch that *is* that same token is a custom-property cycle, and CSS drops the
  // whole chain to its initial value — light mode would fall back silently and dark mode not at all. So a
  // mapping is only emitted when it actually changes something.
  const source = t.page.hex ? null : SWATCH_BY_ID.get(t.page.accent).token
  for (const token of ['--color-brand', '--color-green-900']) {
    if (token !== source) vars[token] = 'var(--cal-accent)'
  }
  return vars
}