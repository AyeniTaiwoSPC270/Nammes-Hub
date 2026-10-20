// Holiday themes: the pure judge of a season's values, shared by the browser and the server.
// Spec: docs/superpowers/specs/2026-10-20-holiday-themes-design.md
//
// Same discipline as calendarTheme.js and contentTheme.js: no window, no Supabase, no Node built-ins,
// and every value either survives this file's rules or settles to a default. A holiday palette repaints
// the WHOLE site by repointing the tokens src/index.css already defines, so a junk colour here would
// reach every page at once — this file is the only thing standing between a hand-edited row and that.

import { sanitizeTheme, isHexColor, THEME_PATTERNS, THEME_MUSIC, THEME_CONFETTI, THEME_LOOKS } from './quizTheme.js'

// The particle effects a theme may pick, 'off' included so a plain theme is an explicit choice. The
// keyframe names are derived from these ids (`holiday-p-<id>` in src/index.css); a source-scan test
// asserts every non-'off' id has its keyframes, the same guard the backdrop-motion styles have.
export const HOLIDAY_PARTICLES = Object.freeze({
  off: 'None',
  snow: 'Snow',
  petals: 'Petals',
  sparks: 'Sparks',
  confetti: 'Confetti',
  leaves: 'Leaves',
})

// The only tokens a theme may repoint. Fixed rather than open-ended: each of these is read by
// Tailwind classes that exist all over the site, and the list stops short of fonts, radii and shadows,
// which are not a holiday's business.
export const HOLIDAY_TOKENS = Object.freeze([
  'brand', 'brand-orange', 'green-900', 'orange-500',
  'paper', 'surface', 'surface-low', 'ink-900', 'ink', 'ink-muted', 'hairline',
])
export const HOLIDAY_MODES = Object.freeze(['light', 'dark'])
export const BANNER_MAX = 80

const THEME_ID = /^[a-z0-9-]{1,40}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

// Uploaded art lives in the holiday-themes bucket under the theme's own folder, mirroring the quiz
// image rule (api/_lib/quizImage.js): a path is either exactly the shape it claims to be, or it is
// nothing, so a hand-edited row can never point the site at some other address.
const IMAGE_PATH = /^([a-z0-9-]{1,40})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(webp|jpg|png)$/

export function isThemeId(value) {
  return typeof value === 'string' && THEME_ID.test(value)
}

export function isHolidayImagePath(value, themeId) {
  if (typeof value !== 'string') return false
  const m = IMAGE_PATH.exec(value)
  if (!m) return false
  return themeId === undefined || m[1] === String(themeId).toLowerCase()
}

function cleanText(value, max) {
  if (typeof value !== 'string') return ''
  // eslint-disable-next-line no-control-regex
  return value.replace(/\s+/g, ' ').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max)
}

function oneOf(list, value, fallback) {
  return typeof value === 'string' && Object.hasOwn(list, value) ? value : fallback
}

function cleanDate(value) {
  return typeof value === 'string' && DATE.test(value) ? value : null
}

/** { light: {...}, dark: {...} } — allowlisted keys, validated lowercase #rrggbb, nothing else. */
export function sanitizePalette(input) {
  const p = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const out = {}
  for (const mode of HOLIDAY_MODES) {
    const src = p[mode] && typeof p[mode] === 'object' && !Array.isArray(p[mode]) ? p[mode] : {}
    const map = {}
    for (const token of HOLIDAY_TOKENS) {
      if (isHexColor(src[token])) map[token] = src[token].toLowerCase()
    }
    out[mode] = map
  }
  return out
}

/** { particles: id, banner: text|null } — banner is plain text, never markup; React renders it as text. */
export function sanitizeDecor(input) {
  const d = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const banner = cleanText(d.banner, BANNER_MAX)
  return {
    particles: oneOf(HOLIDAY_PARTICLES, d.particles, 'off'),
    banner: banner || null,
  }
}

/** { band: path|null, logo: path|null } — each must sit in this theme's own folder when a theme is named. */
export function sanitizeImagery(input, { themeId } = {}) {
  const i = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const clean = (value) => (isHolidayImagePath(value, themeId) ? value.toLowerCase() : null)
  return { band: clean(i.band), logo: clean(i.logo) }
}

/**
 * The quiz half: { design, image, look_id }.
 *
 * `design` is judged by quizTheme's own sanitizeTheme — one judge, not two — and deliberately carries
 * NO picture: a holiday path is not a `<quizId>/<uuid>` quiz path, so sanitizeTheme drops it, and an
 * image backdrop settles to 'none'. The picture travels beside the design in `image` instead, and the
 * studio's apply path copies it into the quiz's own folder before sanitizeTheme sees it
 * (AGENTS.md: sanitizeTheme strips foreign paths on purpose; we honour that rather than weaken it).
 * `image` present therefore means "pattern 'image' at apply time".
 */
export function sanitizeQuizTheme(input, { themeId } = {}) {
  const q = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  return {
    design: sanitizeTheme(q.design),
    image: isHolidayImagePath(q.image, themeId) ? q.image.toLowerCase() : null,
    look_id: isThemeId(q.look_id) ? q.look_id : null,
  }
}

/** A whole row, as the studio and the provider consume it. */
export function sanitizeHolidayTheme(row) {
  const r = row && typeof row === 'object' ? row : {}
  const id = isThemeId(r.id) ? r.id : ''
  return {
    id,
    name: cleanText(r.name, 40) || id,
    palette: sanitizePalette(r.palette),
    decor: sanitizeDecor(r.decor),
    imagery: sanitizeImagery(r.imagery, { themeId: id }),
    quiz: sanitizeQuizTheme(r.quiz, { themeId: id }),
    starts_on: cleanDate(r.starts_on),
    ends_on: cleanDate(r.ends_on),
    enabled: r.enabled !== false,
  }
}

/**
 * The pure mirror of the `active_holiday_theme()` RPC: which theme is live, given the rows, the kill
 * flag and a caller-pinned Lagos day ('YYYY-MM-DD'). The browser normally asks the RPC (which resolves
 * server-side so it cannot disagree with itself); this exists for tests and for the owner screen's
 * preview, and both must follow the same rule — flag off → null; 'off' → null; 'manual' → that theme
 * if enabled; 'auto' → enabled, in-range (inclusive), later starts_on wins, id breaks ties, unbounded
 * last.
 */
export function resolveActiveHoliday({ themes, settings, enabled = true, today } = {}) {
  if (!enabled) return null
  const s = settings && typeof settings === 'object' ? settings : {}
  if (s.mode === 'off') return null
  const list = (Array.isArray(themes) ? themes : [])
    .map(sanitizeHolidayTheme)
    .filter((t) => t.id && t.enabled)
  if (s.mode === 'manual') return list.find((t) => t.id === s.active_theme_id) ?? null
  if (s.mode !== 'auto' || typeof today !== 'string' || !DATE.test(today)) return null
  const inRange = list.filter(
    (t) => (!t.starts_on || t.starts_on <= today) && (!t.ends_on || t.ends_on >= today),
  )
  inRange.sort((a, b) => {
    // Later starts_on first; null (unbounded) last; id ascending so two themes sharing a start day
    // always resolve the same way.
    if (a.starts_on !== b.starts_on) {
      if (!a.starts_on) return 1
      if (!b.starts_on) return -1
      return a.starts_on < b.starts_on ? 1 : -1
    }
    return a.id < b.id ? -1 : 1
  })
  return inRange[0] ?? null
}

/**
 * The CSS custom properties one theme sets on <html> for one mode. Only provided, valid tokens are
 * emitted — a partial palette leaves every other token on the site's own value, which is what lets a
 * two-colour theme work. Literal hexes, never var() references, so the custom-property cycle the
 * calendar guard watches for (calendarTheme.js themeVars) cannot arise here.
 */
export function holidayThemeVars(theme, mode) {
  const map = sanitizeHolidayTheme(theme).palette[HOLIDAY_MODES.includes(mode) ? mode : 'light']
  const vars = {}
  for (const token of HOLIDAY_TOKENS) {
    if (isHexColor(map[token])) vars[`--color-${token}`] = map[token]
  }
  return vars
}

/**
 * Today's date in Africa/Lagos, as 'YYYY-MM-DD'. Read through an Intl pinned to the zone rather than
 * the host clock: Vercel runs UTC and the two disagree for hours a day, which is how a Christmas theme
 * would switch on at 1am Nigerian time (2026-10-13 calendar reminders learned this the hard way).
 * en-CA formats as YYYY-MM-DD by construction.
 */
export function todayLagos(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(now)
}

export { THEME_PATTERNS, THEME_MUSIC, THEME_CONFETTI, THEME_LOOKS }
