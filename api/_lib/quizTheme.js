// The look of a live quiz, designed in the Quiz Design Studio. Pure and dependency-free: the studio, the screens
// and the API all use this one file, so a theme is cleaned the same way everywhere. Nothing in a theme is ever
// free text that reaches CSS: colours must be #rrggbb and every other choice comes from a fixed list.

import { isQuizImagePath } from './quizImage.js'

export const THEME_LOOKS = {
  classic: { name: 'Classic', accent: '#ff5a1f', glow: ['#ff5a1f', '#0b2417'], deep: ['#0b2417', '#17492f'] },
  midnight: { name: 'Midnight', accent: '#6366f1', glow: ['#6366f1', '#22d3ee'], deep: ['#1e1b4b', '#312e81'] },
  sunrise: { name: 'Sunrise', accent: '#d97706', glow: ['#f97316', '#ec4899'], deep: ['#7c2d12', '#9a3412'] },
  forest: { name: 'Forest', accent: '#15803d', glow: ['#16a34a', '#facc15'], deep: ['#052e16', '#14532d'] },
  royal: { name: 'Royal', accent: '#7c3aed', glow: ['#7c3aed', '#f472b6'], deep: ['#3b0764', '#581c87'] },
  candy: { name: 'Candy', accent: '#db2777', glow: ['#ec4899', '#38bdf8'], deep: ['#831843', '#9d174d'] },
  ocean: { name: 'Ocean', accent: '#0e7490', glow: ['#0891b2', '#2563eb'], deep: ['#083344', '#164e63'] },
  mono: { name: 'Mono', accent: '#52525b', glow: ['#71717a', '#a1a1aa'], deep: ['#18181b', '#3f3f46'] },
}

export const THEME_PATTERNS = {
  math: 'Maths symbols',
  dots: 'Dots',
  grid: 'Grid',
  waves: 'Waves',
  stars: 'Sparkles',
  none: 'Plain',
}

export const THEME_CONFETTI = {
  math: 'Maths symbols',
  stars: 'Stars',
  petals: 'Petals',
  off: 'None',
}

export const THEME_MUSIC = {
  off: 'No music',
  chill: 'Chill',
  hype: 'Hype',
}

export const MAX_SPONSORS = 6
export const SPONSOR_NAME_MAX = 40

export const THEME_HEADLINE_MAX = 60
export const THEME_TAGLINE_MAX = 80

export const DEFAULT_THEME = Object.freeze({
  look: 'classic',
  accent: null,
  pattern: 'math',
  confetti: 'math',
  headline: '',
  tagline: '',
  sound: Object.freeze({ music: 'off', effects: true }),
  logo: null,
  sponsors: Object.freeze([]),
  showSponsors: Object.freeze({ lobby: true, finish: true }),
})

const HEX = /^#[0-9a-fA-F]{6}$/

export function isHexColor(value) {
  return typeof value === 'string' && HEX.test(value)
}

function cleanText(value, max) {
  if (typeof value !== 'string') return ''
  // eslint-disable-next-line no-control-regex
  return value.replace(/\s+/g, ' ').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max)
}

function cleanSound(input) {
  const o = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  return { music: Object.hasOwn(THEME_MUSIC, o.music) ? o.music : 'off', effects: o.effects !== false }
}

// A picture path is only kept if it has the exact shape of an uploaded image and, when the quiz is known, sits in that
// quiz's own folder. Anything else is dropped, so a theme can never point at some other address.
function cleanPath(value, quizId) {
  return isQuizImagePath(value, quizId) ? value.toLowerCase() : null
}

function cleanSponsors(input, quizId) {
  if (!Array.isArray(input)) return []
  const out = []
  for (const item of input) {
    const path = cleanPath(item?.path, quizId)
    const name = cleanText(item?.name, SPONSOR_NAME_MAX)
    if (path && name) out.push({ name, path })
    if (out.length === MAX_SPONSORS) break
  }
  return out
}

// Anything goes in, a complete valid theme comes out (bad or missing values fall back to the defaults).
export function sanitizeTheme(input, { quizId } = {}) {
  const t = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  return {
    look: Object.hasOwn(THEME_LOOKS, t.look) ? t.look : DEFAULT_THEME.look,
    accent: isHexColor(t.accent) ? t.accent.toLowerCase() : null,
    pattern: Object.hasOwn(THEME_PATTERNS, t.pattern) ? t.pattern : DEFAULT_THEME.pattern,
    confetti: Object.hasOwn(THEME_CONFETTI, t.confetti) ? t.confetti : DEFAULT_THEME.confetti,
    headline: cleanText(t.headline, THEME_HEADLINE_MAX),
    tagline: cleanText(t.tagline, THEME_TAGLINE_MAX),
    sound: cleanSound(t.sound),
    logo: cleanPath(t.logo, quizId),
    sponsors: cleanSponsors(t.sponsors, quizId),
    showSponsors: {
      lobby: t.showSponsors?.lobby !== false,
      finish: t.showSponsors?.finish !== false,
    },
  }
}

export function themeAccent(theme) {
  const t = sanitizeTheme(theme)
  return t.accent ?? THEME_LOOKS[t.look].accent
}

function channel(hex, from) {
  const v = parseInt(hex.slice(from, from + 2), 16) / 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

function luminance(hex) {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5)
}

// How readable white text is on this colour (1 to 21). Buttons and chips in the quiz use white text on the accent.
export function contrastWithWhite(hex) {
  if (!isHexColor(hex)) return 1
  return Math.round((1.05 / (luminance(hex) + 0.05)) * 100) / 100
}

// The CSS variables a theme sets on the page. The accent replaces the site's orange everywhere in the quiz screens.
export function themeCssVars(theme) {
  const t = sanitizeTheme(theme)
  const look = THEME_LOOKS[t.look]
  const accent = t.accent ?? look.accent
  return {
    '--color-orange-500': accent,
    '--color-orange-600': `color-mix(in srgb, ${accent} 72%, black)`,
    '--color-orange-100': `color-mix(in srgb, ${accent} 14%, white)`,
    '--color-brand-orange': accent,
    '--qz-glow-a': t.accent ?? look.glow[0],
    '--qz-glow-b': look.glow[1],
    '--qz-deep-a': look.deep[0],
    '--qz-deep-b': look.deep[1],
  }
}
