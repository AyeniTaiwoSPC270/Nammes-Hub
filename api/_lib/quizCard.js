import { isHexColor, sanitizeTheme, THEME_PATTERNS } from './quizTheme.js'
import { isQuizImagePath } from './quizImage.js'

// How the result card is designed. Separate from the theme: theme drives the projector and phone screens, card
// drives one exported image, and the theme column has a size cap this must not eat into.
export const DEFAULT_CARD = Object.freeze({
  accent: null,
  background: null,
  backgroundColor: null,
  pattern: null,
  showCharacter: true,
  showTitle: true,
  showPlacement: true,
  showAccuracy: true,
  showStreak: true,
  showTeam: true,
})

// Any value that is not literal false leaves the line on, so a hand-edited row can only ever hide a line.
function flag(value) {
  return value !== false
}

// The card's own backdrop pattern, or null to follow whatever the game is using. Unlike the theme's pattern this keeps
// null rather than falling back to a name: "same as the game" is the default and has to survive cleaning, so a card with
// no pattern of its own must not be given one. An unknown name is still refused, so a card can never ask for a pattern
// the renderer does not draw — that would be a blank card rather than a wrong one.
function cleanPattern(value) {
  return typeof value === 'string' && Object.hasOwn(THEME_PATTERNS, value) ? value : null
}

// Anything goes in, a complete valid card comes out (bad or missing values fall back to the defaults).
export function sanitizeCard(input, { quizId } = {}) {
  const c = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  return {
    accent: isHexColor(c.accent) ? c.accent.toLowerCase() : null,
    background: isQuizImagePath(c.background, quizId) ? c.background.toLowerCase() : null,
    backgroundColor: isHexColor(c.backgroundColor) ? c.backgroundColor.toLowerCase() : null,
    pattern: cleanPattern(c.pattern),
    showCharacter: flag(c.showCharacter),
    showTitle: flag(c.showTitle),
    showPlacement: flag(c.showPlacement),
    showAccuracy: flag(c.showAccuracy),
    showStreak: flag(c.showStreak),
    showTeam: flag(c.showTeam),
  }
}

// The studio's preview renders the *saved* card, so an unsaved draft has to travel on the url for the preview to
// follow the controls. Only the card is sent, never the theme: the card is the tab being edited, and a theme is
// large enough (sponsors, sound, pictures) to make the url unusable.
const PREVIEW_MAX_CHARS = 700

function toBase64Url(text) {
  if (typeof Buffer !== 'undefined') return Buffer.from(text, 'utf8').toString('base64url')
  return btoa(unescape(encodeURIComponent(text))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  if (typeof Buffer !== 'undefined') return Buffer.from(padded, 'base64').toString('utf8')
  return decodeURIComponent(escape(atob(padded)))
}

// A theme fragment for the studio's preview, so "same as the game" shows the backdrop currently on screen rather than
// the last one saved. Six fields, not the whole theme: sponsors, sound and picture paths would make the url unusable.
// Both sides clean it, so the preview endpoint is never handed a colour or a pattern name it has not already validated.
export const PREVIEW_THEME_KEYS = Object.freeze(['look', 'accent', 'page', 'pattern', 'backdropOpacity', 'backdropScale'])

export function encodeThemePreview(theme) {
  if (!theme || typeof theme !== 'object' || Array.isArray(theme)) return ''
  const t = sanitizeTheme(theme)
  const fragment = {}
  for (const key of PREVIEW_THEME_KEYS) fragment[key] = t[key]
  return toBase64Url(JSON.stringify(fragment))
}

export function decodeThemePreview(payload) {
  if (typeof payload !== 'string' || !payload || payload.length > PREVIEW_MAX_CHARS) return null
  let parsed
  try {
    parsed = JSON.parse(fromBase64Url(payload))
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  // sanitizeTheme fills in the rest, so a fragment carrying two fields is still a complete theme to render from.
  return sanitizeTheme(parsed)
}

// A draft card, url-safe and capped. Sanitised on the way out so the payload is already the shape the server wants.
export function encodeCardPreview(card, { quizId } = {}) {
  return toBase64Url(JSON.stringify(sanitizeCard(card, { quizId })))
}

// The draft the url carried, or null when there is not a usable one — in which case the caller keeps the saved card.
// Anything unparseable is null rather than an exception: this is an unauthenticated url parameter.
export function decodeCardPreview(payload, { quizId } = {}) {
  if (typeof payload !== 'string' || !payload || payload.length > PREVIEW_MAX_CHARS) return null
  let parsed
  try {
    parsed = JSON.parse(fromBase64Url(payload))
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  return sanitizeCard(parsed, { quizId })
}