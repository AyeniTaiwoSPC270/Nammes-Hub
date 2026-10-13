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

// The four colours a scheme owns, each of which the admin may replace in the studio. They are one list because they
// share one rule and one function: a colour is a #rrggbb or it is nothing, and null means "the scheme's own colour"
// — which is what every theme saved before this existed holds, so a live quiz changes for no one.
export const SCHEME_COLOR_KEYS = Object.freeze(['glowA', 'glowB', 'deepA', 'deepB'])

// The two page palettes a quiz can be shown on. These are the site's own tokens, not new colours: a quiz screen already
// says bg-paper and text-ink-900, and those compile to exactly these variables, so setting them on the quiz's wrapper
// re-skins every screen at once with no screen file touched — and the translucent bg-paper/85 bars follow for free.
//
// PAGE_DARK is a copy of the `.dark` block in src/index.css, and a test reads that file and compares the two. Two
// sources for one palette is only safe while something compares them, and it cannot be an import: index.css is CSS.
//
// `--color-brand-orange` and the three orange steps are deliberately absent: themeCssVars derives them from the accent,
// and because the page palette is spread after them, a token in here would overwrite the accent on every screen. A test
// holds that, because the absence is the only thing stopping it and nothing else would notice.
export const ACCENT_DERIVED_TOKENS = Object.freeze(['orange-500', 'orange-600', 'orange-100', 'brand-orange'])

export const PAGE_LIGHT = Object.freeze({
  paper: '#fcf9f8',
  surface: '#ffffff',
  'surface-low': '#f6f3f2',
  'ink-900': '#000904',
  ink: '#1c1b1b',
  'ink-muted': '#424843',
  hairline: '#c2c8c1',
  brand: '#0b2417',
})

export const PAGE_DARK = Object.freeze({
  paper: '#0d1310',
  surface: '#16211b',
  'surface-low': '#111a15',
  'ink-900': '#f7f9f7',
  ink: '#e6e8e5',
  'ink-muted': '#9aa79e',
  hairline: '#2c352f',
  brand: '#5cb88a',
})

export const THEME_PATTERNS = {
  image: 'My image',
  math: 'Maths symbols',
  notes: 'Music notes',
  party: 'Party shapes',
  dots: 'Dots',
  grid: 'Grid',
  waves: 'Waves',
  hexagons: 'Hexagons',
  stripes: 'Diagonal stripes',
  rings: 'Rings',
  stars: 'Sparkles',
  none: 'Plain',
}

// The characters each symbolic backdrop is built from, and the measurements each drawn one is built from. The two
// renderers cannot share their drawing code — the screens use CSS and SVG, the result card is a canvas — but they must
// share the *vocabulary*, or the card slowly stops matching the screens it was shared from. These tables were the two
// hand-copied arrays at QuizParts.jsx and quizCardRender.js, which agreed only because someone remembered to edit both.
//
// Today the card reads both tables, with a full branch for each; the browser does the same. The numbers below are in the
// reference pixels the browser designs at, which is the same unit `backdropScale` is a percentage of, so that when the
// card does start reading them it scales the numbers against its own 1080x1920 canvas rather than copying pixels sized
// for a browser window.
//
// Each glyph carries a **key**, not just a character, because an admin can now place a prop by name rather than by
// accident. The card reads `Object.values`, so a key is invisible to it — but there is still only one copy of every
// character, which is what the source-scan in the tests exists to protect.
export const PATTERN_GLYPHS = {
  math: { pi: 'π', sum: 'Σ', int: '∫', root: '√', delta: 'Δ', lambda: 'λ', theta: 'θ', inf: '∞', approx: '≈', plusminus: '±' },
  stars: { spark: '✦', sparkle: '✧', star: '★', ray: '✶' },
  // Musical symbols, not 🎵. The card has no emoji font — patternFonts.test.js fails the build if a glyph the server
  // cannot draw is put in this table — and these are the ones it can.
  notes: { single: '♪', pair: '♫', quarter: '♩', beamed: '♬' },
}

// How many glyphs each symbolic backdrop scatters. Kept here rather than in the call sites for the same reason as the
// glyphs themselves: the count is a property of the pattern, and two renderers reading two different numbers for it is
// how a card stops matching the screens.
export const GLYPH_PROP_COUNTS = { math: 14, notes: 16, stars: 18 }

// `party` is here rather than above because its shapes are drawn, not typed: a balloon and a party hat have no
// character to fall back on, and an emoji standing in for one prints as a tofu box on every shared card.
//
// `shapes` names the drawn props of the three mark patterns, and it lives inside this table rather than beside it
// because that is what keeps the "every pattern is in exactly one of the three tables" test honest: hexagons, rings and
// party are already geometry patterns, and a fourth table holding their prop names would put three patterns in two.
export const PATTERN_GEOMETRY = {
  dots: { cell: 26, dot: 1.6, gap: 1.8 },
  grid: { cell: 44, stroke: 1 },
  waves: { path: 'M0 40Q90 0 180 40T360 40T540 40T720 40V80H0z', viewBox: '0 0 720 80', band: 14, shift: { x: -140, y: 14 } },
  // Shared layout numbers, browser-only drawing numbers, and card-only drawing numbers are split into three groups so
  // each renderer edits only its own half. Shared: cell, count, width, gap, band, stroke, shapes. Browser-only: mark,
  // opacity, dot, viewBox, shift. Card-only: radius, step, rings, stagger, hat, balloon, confetti, path, angle.
  hexagons: { count: 26, cell: 88, mark: 46, opacity: 1, radius: 30, stagger: 0.5, shapes: ['hex'] },
  stripes: { width: 12, gap: 12, angle: 45 },
  rings: { count: 18, cell: 120, mark: 62, opacity: 1, radius: 22, step: 7, rings: 3, stroke: 2, shapes: ['ring'] },
  party: { count: 16, cell: 150, mark: 52, opacity: 1, balloon: 22, hat: 30, streamer: 36, confetti: 10, stroke: 2, shapes: ['balloon', 'hat', 'streamer', 'confetti'] },
}

// The two patterns with nothing of their own to draw: 'image' paints a photograph where the pattern would be, and
// 'none' paints nothing at all. Naming them is what lets the tables be checked against THEME_PATTERNS — a pattern that is
// in no table and not named here is one a renderer has to silently skip.
export const PATTERN_UNDRAWN = ['image', 'none']

// How many props an admin may leave on one backdrop, and how many across every backdrop on a quiz at once. Both exist
// because the theme is a single column with a size check on it (see 20261013120000_quiz_theme_layout_size.sql): a limit
// the app cannot exceed is what makes that check a bound rather than a trap. 60 is well above the busiest pattern's own
// default of 26, and 150 is the six prop patterns' 108 defaults plus about 40%.
export const LAYOUT_MAX_PER_PATTERN = 60
export const LAYOUT_MAX_TOTAL = 150

// The one prop whose drawing is rotationally symmetric. An angle set on a ring would be stored, sanitised and rendered
// and nothing would ever move, which reads as a broken control rather than as a fact about circles — so the angle is
// dropped on the way in and the studio does not offer the slider.
export const PROP_TILTLESS = Object.freeze(['ring'])

// Which props a pattern owns, as one list. A maths backdrop offers maths and a hexagons backdrop offers hexagons, and
// that is enforced here rather than in the editor, so a saved look carried from one quiz to another loses whatever the
// target pattern does not have rather than showing a prop nothing knows how to draw.
export function propVocabulary(pattern) {
  return [
    ...Object.keys(PATTERN_GLYPHS[pattern] ?? {}),
    ...(PATTERN_GEOMETRY[pattern]?.shapes ?? []),
  ]
}

// What a prop is called in the studio and on a hit box. A glyph is its own character, which is the shortest honest
// label there is; a drawn shape has no character, so its name is capitalised.
export function propLabel(pattern, key) {
  const glyph = PATTERN_GLYPHS[pattern]?.[key]
  if (glyph) return glyph
  return typeof key === 'string' ? key.charAt(0).toUpperCase() + key.slice(1) : String(key)
}

// How big a prop of this pattern may be, in the same unscaled pixels the pattern is designed at — which is the unit
// `backdropScale` is a percentage of, so a stored size is multiplied at draw time and the Size slider keeps working on
// an arrangement. The glyph span is the range the old scatter produced (28..71); a shape starts at its own mark, since
// that is what its default sizes are counted from.
export function propSizeRange(pattern) {
  const mark = PATTERN_GEOMETRY[pattern]?.mark
  if (typeof mark === 'number') return { min: mark, max: mark + 24 }
  return PATTERN_GLYPHS[pattern] ? { min: 28, max: 72 } : null
}

// Where a pattern's props sit when nobody has moved them: the two closed-form scatters that used to live in QuizParts.jsx,
// in one place so that an unedited backdrop and the studio's Reset can never disagree. Positions come from the index
// rather than from a random number — a backdrop that rearranged itself on every reload would read as a bug — and they are
// rounded here because a stored prop is a stored integer.
export function defaultBackdropProps(pattern) {
  const glyphs = PATTERN_GLYPHS[pattern]
  const count = GLYPH_PROP_COUNTS[pattern]
  if (glyphs && count) {
    const keys = Object.keys(glyphs)
    return Array.from({ length: count }, (_, i) => ({
      k: keys[i % keys.length],
      x: Math.round((i * 37 + 8) % 92),
      y: Math.round((i * 53 + 5) % 90),
      s: 28 + ((i * 17) % 44),
      r: ((i * 41) % 50) - 25,
    }))
  }
  const geometry = PATTERN_GEOMETRY[pattern]
  const shapes = geometry?.shapes
  if (!shapes || !geometry.count) return []
  return Array.from({ length: geometry.count }, (_, i) => ({
    k: shapes[i % shapes.length],
    x: Math.round((i * geometry.cell + 8) % 92),
    y: Math.round((i * geometry.cell * 1.4 + 5) % 90),
    s: geometry.mark + ((i * 13) % 12),
    r: ((i * 41) % 50) - 25,
  }))
}

export const THEME_CONFETTI = {
  math: 'Maths symbols',
  stars: 'Stars',
  petals: 'Petals',
  emoji: 'Emoji party',
  paper: 'Coloured paper',
  letters: 'Quiz letters',
  money: 'Money',
  notes: 'Music notes',
  hearts: 'Hearts',
  off: 'None',
}

// How an uploaded backdrop picture meets the screen. 'cover' fills it and hides whatever hangs over the edge, which is
// what a background normally wants; 'contain' shows the whole picture and leaves the page colour in the gaps; 'stretch'
// fills it and distorts. Without a choice here an admin can only ever lose part of their picture.
export const THEME_BACKDROP_FITS = {
  cover: 'Fill the screen',
  contain: 'Whole picture',
  stretch: 'Stretch to fill',
}

// The music the projector can play. 'off' is first because it is the default, and the two original loops come next so
// the quizzes that already use them are unaffected by the newer styles. 'custom' is the admin's own imported track,
// which is why it is listed last: it is the one style the engine cannot generate.
export const THEME_MUSIC = {
  off: 'No music',
  chill: 'Chill',
  hype: 'Hype',
  afro: 'Afrobeat',
  disco: 'Disco',
  cinematic: 'Cinematic',
  custom: 'My music',
}

// What each loop actually sounds like, for the studio sound lab. The loops are generated in the browser rather than
// played from a file, so an admin can only pick one by hearing it: this is the card under each Play button.
export const MUSIC_NOTES = {
  chill: 'Soft and slow. Good for a quiet lobby or a long quiz.',
  hype: 'Fast and driving. The most energy of the five.',
  afro: 'Warm, syncopated and groovy. The one people tap along to.',
  disco: 'Four to the floor with a bright bass. Bright and playful.',
  cinematic: 'Slow swelling chords and one big boom a bar. Made to sit under people talking.',
  custom: 'A track you imported on this computer. It loops all game and stays on the device that imported it.',
}

// Every sound effect a quiz can play, and what each one is for. This list lives here rather than only in the browser
// engine because sanitizeTheme has to stay pure and the server checks a saved theme too, so an effect a quiz switched
// off has to be a name this file knows. A test asserts it agrees with EFFECT_GROUPS in quizSound.js, so an effect can
// never be added to the engine without somewhere for the studio to hear it. The order matches those groups, which
// also keeps a saved theme's custom clips in a stable order however the admin filled them in.
export const THEME_EFFECTS = {
  tick: 'Tick, last 5 seconds',
  tickFast: 'Fast tick, last 2 seconds',
  timeUp: "Time's up horn",
  start: 'Question starts',
  lock: 'Answer locked in',
  join: 'A player joined',
  drumroll: 'Drum roll',
  correct: 'Right answer',
  wrong: 'Wrong answer',
  applause: 'Crowd applause',
  whoosh: 'Board whoosh',
  points: 'Points chime',
  fanfare: 'Fanfare',
}

// A clip id is a key into the local library in one browser, never a path or a URL, so it is held to a fixed shape: no
// slashes, no dots, nothing that could escape the library or be read as part of an address.
const CLIP_ID = /^[a-z0-9-]{8,40}$/

export function isClipId(value) {
  return typeof value === 'string' && CLIP_ID.test(value)
}

export const MAX_SPONSORS = 6
export const SPONSOR_NAME_MAX = 40

export const THEME_HEADLINE_MAX = 60
export const THEME_TAGLINE_MAX = 80

// How far the backdrop can be pushed. The studio drives its sliders off these, so a slider cannot drift from the range
// the sanitizer allows. `scale` is a percentage of the size each pattern is designed at, not a new size in pixels, so
// the patterns keep their proportions at every setting.
//
// `motionSpeed` is the one entry whose name is not simply the field it feeds. The studio and the tests both read this
// table by turning `opacity` into `backdropOpacity`, so a range called `motion` would derive `backdropMotion` — which is
// the style, not the speed, and would have that test asserting the *style* round-trips 1 and 5.
export const BACKDROP_RANGES = {
  opacity: { min: 0, max: 100, step: 1, unit: '%' },
  scale: { min: 50, max: 200, step: 5, unit: '%' },
  blur: { min: 0, max: 24, step: 1, unit: 'px' },
  dim: { min: 0, max: 90, step: 5, unit: '%' },
  motionSpeed: { min: 1, max: 5, step: 1, unit: '' },
}

// The backdrop loops an admin can pick from. 'off' is first because it is the default, matching THEME_MUSIC and
// THEME_CONFETTI. The names are what an admin sees rather than how it is drawn, and there is no way to stack them: one
// style at a time is a setting an admin can tune, and two at once is one they cannot.
//
// Four move the backdrop layer and work on every drawn pattern. Three move each mark on its own phase and need discrete
// marks to move. Pan moves a photograph.
export const THEME_BACKDROP_MOTION = {
  off: 'Still',
  drift: 'Drift',
  orbit: 'Orbit',
  breathe: 'Breathe',
  bounce: 'Bounce',
  float: 'Float',
  cascade: 'Cascade',
  twinkle: 'Twinkle',
  pan: 'Pan',
}

// The one style with nothing to move but a photograph. Kept beside PATTERN_UNDRAWN, which does the same job for patterns:
// naming the exception is what lets a table be checked against the list above.
export const MOTION_PICTURE_ONLY = ['pan']

// The styles that need discrete marks to move individually. Everything else moves one layer, so a pattern with no marks
// can still be given a style from this list.
export const MOTION_PER_MARK = ['float', 'cascade', 'twinkle']

// What a per-mark style becomes on a pattern with nothing to move individually. Dots, Grid, Stripes and Waves are a tiled
// gradient or a single band, so there is no mark in them to float — but an admin who chose Float did not choose to have
// a dead button, so each style falls to the loop that reads closest to what they asked for. Resolved when drawing rather
// than when saving, so switching to Maths and back gives them Float again.
export const MOTION_MARKLESS_STANDIN = { float: 'breathe', cascade: 'drift', twinkle: 'breathe' }

// Seconds per cycle at the reference speed of 3, which speed then divides. Keyframe names live in `index.css` rather than
// here because this file has to stay free of anything a serverless function cannot load, and because a stylesheet cannot
// read a theme field to work a duration out for itself. `off` is absent because a still backdrop never asks for one.
export const MOTION_DURATIONS = {
  drift: 44,
  orbit: 58,
  breathe: 16,
  bounce: 4.5,
  float: 7,
  cascade: 9,
  twinkle: 6,
  pan: 30,
}

// Under the ticks of the speed slider, so the number is a word as well as a reading.
export const MOTION_SPEED_LABELS = ['Calm', 'Gentle', 'Steady', 'Brisk', 'Lively']

// Translation distance in CSS percent units. Drift and Orbit move this far from centre, but their moving layers need more
// bleed than this number: CSS percentages use the already-expanded layer as their reference box, and Orbit also moves
// vertically and rotates. MOTION_BLEED is the independent amount grown on each edge to cover the full path.
export const MOTION_DISTANCE = { drift: 5, orbit: 5 }

// The amount the translated layer extends past each edge. The margin exceeds the largest translation plus Orbit's
// diagonal/rotational excursion on both landscape projectors and portrait phones.
export const MOTION_BLEED = { drift: 15, orbit: 15 }

export const DEFAULT_THEME = Object.freeze({
  look: 'classic',
  accent: null,
  page: null,
  glowA: null,
  glowB: null,
  deepA: null,
  deepB: null,
  pattern: 'math',
  image: null,
  backdropOpacity: 8,
  backdropScale: 100,
  backdropBlur: 0,
  backdropDim: 0,
  backdropFit: 'cover',
  backdropMotion: 'off',
  backdropMotionSpeed: 3,
  backdropMotionOnPhones: true,
  backdropLayout: Object.freeze({}),
  confetti: 'math',
  headline: '',
  tagline: '',
  sound: Object.freeze({ music: 'off', effects: true, off: Object.freeze([]), custom: Object.freeze({ music: null, effects: Object.freeze({}) }) }),
  logo: null,
  sponsors: Object.freeze([]),
  showSponsors: Object.freeze({ lobby: true, finish: true }),
})

const HEX = /^#[0-9a-fA-F]{6}$/

export function isHexColor(value) {
  return typeof value === 'string' && HEX.test(value)
}

// One rule for "a colour a theme may hold", shared by the sanitiser and the studio's own editor helpers. A second copy of
// `isHexColor(x) ? x.toLowerCase() : null` is a copy that can drift from the one the API enforces, and the sanitiser is
// the only thing that gets to decide what reaches a projector.
function cleanHexColor(value) {
  return isHexColor(value) ? value.toLowerCase() : null
}

function cleanText(value, max) {
  if (typeof value !== 'string') return ''
  // eslint-disable-next-line no-control-regex
  return value.replace(/\s+/g, ' ').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max)
}

// A choice is only accepted if it really is the name of one. Checking `Object.hasOwn(list, value)` on its own is
// not enough, because an array like ['chill'] becomes the string 'chill' when used as a key and would pass.
function oneOf(list, value, fallback) {
  return typeof value === 'string' && Object.hasOwn(list, value) ? value : fallback
}

// A slider reading: a finite number held inside its range. Anything else (a string, null, NaN) falls back to the
// default rather than reaching a CSS length or percentage, and a number that overshoots is pulled back to the edge
// instead of being thrown away, so a hand-edited row can never scale a backdrop to infinity.
function num(range, value, fallback) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(range.max, Math.max(range.min, Math.round(value)))
}

// Which effects a quiz has switched off: only names the list knows, each once, in the list's own order so that
// cleaning a theme twice gives the same jsonb back.
function cleanOff(input) {
  if (!Array.isArray(input)) return []
  return Object.keys(THEME_EFFECTS).filter((name) => input.includes(name))
}

// An admin's own clips, by id. An id is only ever a key into the library on one device, so it is checked against a
// fixed shape and an unknown effect name is dropped rather than kept for later.
function cleanCustom(input) {
  const c = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const map = c.effects && typeof c.effects === 'object' && !Array.isArray(c.effects) ? c.effects : {}
  const effects = {}
  for (const name of Object.keys(THEME_EFFECTS)) {
    if (isClipId(map[name])) effects[name] = map[name]
  }
  return { music: isClipId(c.music) ? c.music : null, effects }
}

function cleanSound(input) {
  const o = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const custom = cleanCustom(o.custom)
  const music = oneOf(THEME_MUSIC, o.music, DEFAULT_THEME.sound.music)
  return {
    // Asking for your own music with no clip to play is not a music style the engine can honour, so it settles to
    // silence rather than to a generated loop the admin did not choose.
    music: music === 'custom' && !custom.music ? 'off' : music,
    effects: o.effects !== false,
    off: cleanOff(o.off),
    custom,
  }
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

// 'image' only means something with a picture behind it, so an image backdrop with nothing usable uploaded settles to
// Plain rather than leaving a backdrop the screens have nothing to draw. The picture is kept either way, so choosing a
// pattern again and coming back does not need a second upload.
function cleanPattern(value, image) {
  const pattern = oneOf(THEME_PATTERNS, value, DEFAULT_THEME.pattern)
  return pattern === 'image' && !image ? 'none' : pattern
}

// A picture has nothing to pan without a picture, so Pan settles to Still for the same reason cleanPattern settles an
// image backdrop to Plain. The `pattern` test rather than an `image` one on purpose: an admin can upload a photo, choose
// Pan, then switch the pattern to Maths and keep the picture for later — and a pattern backdrop must stop panning, or the
// projector animates a photograph no screen is drawing.
//
// Only Pan is settled here. Float and Cascade on Dots are not settled — they are resolved to a whole-layer loop when the
// backdrop is drawn (see MOTION_MARKLESS_STANDIN), which keeps the admin's own choice in the saved row.
function cleanMotion(value, pattern) {
  const motion = oneOf(THEME_BACKDROP_MOTION, value, DEFAULT_THEME.backdropMotion)
  return MOTION_PICTURE_ONLY.includes(motion) && pattern !== 'image' ? DEFAULT_THEME.backdropMotion : motion
}

// The admin's own four scheme colours. Only keys this file names are read, so a hand-edited row carrying extra shape
// cannot reach through and change a field it was never given: SCHEME_COLOR_KEYS is the whole surface.
function cleanSchemeColors(input) {
  const t = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const out = {}
  for (const key of SCHEME_COLOR_KEYS) out[key] = cleanHexColor(t[key])
  return out
}

// A range for the two numbers on a prop that are not a size: where it sits, and how far it is turned. Percentages run
// the whole way to the edge because a prop is allowed to hang off it — the studio shows the clipping rather than
// pretending, since a phone really does cut a prop at 98% off the screen.
const PROP_POSITION_RANGE = Object.freeze({ min: 0, max: 100 })
const PROP_ROTATION_RANGE = Object.freeze({ min: -180, max: 180 })

// One prop of one pattern's arrangement. Every field is checked against the pattern that owns it, so a prop can never
// arrive carrying a size a maths symbol was never drawn at or a name its pattern does not have. `c` and `h` are left off
// entirely at their defaults: a row has a size check on it, and 36 characters per prop is what keeps 150 of them
// affordable.
function cleanProp(value, pattern) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  if (!propVocabulary(pattern).includes(value.k)) return null
  const range = propSizeRange(pattern)
  if (!range) return null
  const tiltless = PROP_TILTLESS.includes(value.k)
  const prop = {
    k: value.k,
    x: num(PROP_POSITION_RANGE, value.x, 50),
    y: num(PROP_POSITION_RANGE, value.y, 50),
    s: num(range, value.s, range.min),
    r: tiltless ? 0 : num(PROP_ROTATION_RANGE, value.r, 0),
  }
  const color = cleanHexColor(value.c)
  if (color) prop.c = color
  if (value.h === true) prop.h = true
  return prop
}

// The arrangement of every backdrop on the quiz, keyed by pattern. A pattern that is absent draws its defaults, so the
// common case of a quiz nobody has arranged stores nothing at all. An explicit empty array is different: it means the
// admin deleted every prop, so it must stay empty instead of scattering the defaults back over the screen. Malformed
// non-empty lists that clean to nothing are omitted; cleaning twice therefore gives the same jsonb back, which the
// studio's dirty check depends on.
function cleanLayout(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const out = {}
  let total = 0
  // PostgreSQL jsonb does not preserve object insertion order. Walk the vocabulary's fixed order so the 150-prop cap
  // produces the same cleaned layouts before and after a save/fetch round-trip, rather than favouring whichever key
  // happened to be first in the caller's object.
  for (const pattern of Object.keys(THEME_PATTERNS)) {
    if (!Object.hasOwn(input, pattern)) continue
    if (!Array.isArray(input[pattern])) continue
    const cleaned = []
    for (const item of input[pattern]) {
      if (cleaned.length >= LAYOUT_MAX_PER_PATTERN || total >= LAYOUT_MAX_TOTAL) break
      const prop = cleanProp(item, pattern)
      if (!prop) continue
      cleaned.push(prop)
      total += 1
    }
    // An explicitly empty list is meaningful: it is how an admin deletes the last prop without the renderer mistaking
    // "all gone" for "never arranged" and scattering the defaults back over it. A non-empty list that cleans to nothing
    // is malformed input and is dropped so a bad row cannot create an accidental blank pattern.
    if (cleaned.length || input[pattern].length === 0) out[pattern] = cleaned
  }
  return out
}

// Anything goes in, a complete valid theme comes out (bad or missing values fall back to the defaults).
export function sanitizeTheme(input, { quizId } = {}) {
  const t = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const image = cleanPath(t.image, quizId)
  const pattern = cleanPattern(t.pattern, image)
  return {
    look: oneOf(THEME_LOOKS, t.look, DEFAULT_THEME.look),
    accent: cleanHexColor(t.accent),
    page: cleanHexColor(t.page),
    ...cleanSchemeColors(t),
    pattern,
    image,
    backdropOpacity: num(BACKDROP_RANGES.opacity, t.backdropOpacity, DEFAULT_THEME.backdropOpacity),
    backdropScale: num(BACKDROP_RANGES.scale, t.backdropScale, DEFAULT_THEME.backdropScale),
    backdropBlur: num(BACKDROP_RANGES.blur, t.backdropBlur, DEFAULT_THEME.backdropBlur),
    backdropDim: num(BACKDROP_RANGES.dim, t.backdropDim, DEFAULT_THEME.backdropDim),
    backdropFit: oneOf(THEME_BACKDROP_FITS, t.backdropFit, DEFAULT_THEME.backdropFit),
    backdropMotion: cleanMotion(t.backdropMotion, pattern),
    backdropMotionSpeed: num(BACKDROP_RANGES.motionSpeed, t.backdropMotionSpeed, DEFAULT_THEME.backdropMotionSpeed),
    backdropMotionOnPhones: t.backdropMotionOnPhones !== false,
    backdropLayout: cleanLayout(t.backdropLayout),
    confetti: oneOf(THEME_CONFETTI, t.confetti, DEFAULT_THEME.confetti),
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

// Picking a scheme and picking an accent are two separate decisions, and neither may quietly undo the other. Changing
// the look used to clear the accent, so re-clicking your own scheme threw a custom colour away with no warning and no
// undo — which is what "custom colours do not work" meant. Both rules live beside the sanitiser rather than in a click
// handler so there is one place a rule has to change; the studio's wiring is held in place by a source test, because
// nothing here can stop a button from being wired to the wrong thing.
export function withLook(theme, look) {
  return { ...theme, look: oneOf(THEME_LOOKS, look, DEFAULT_THEME.look) }
}

// Clearing the accent is a deliberate act with its own button. A value the picker cannot produce falls to null for the
// same reason sanitizeTheme does it: nothing reaches the screens that the sanitiser would not accept anyway.
export function withAccent(theme, accent) {
  return { ...theme, accent: cleanHexColor(accent) }
}

// Same rule as withAccent, for the page behind the screens. Kept beside it so a future "reset everything" control has one
// place to reach rather than a third spelling of cleanHexColor.
export function withPage(theme, page) {
  return { ...theme, page: cleanHexColor(page) }
}

// Whether a pattern draws discrete marks that can each be moved on their own, or is a continuous fill with nothing to
// move. Read off the two shared tables rather than kept as a list of its own: a pattern has marks if it is typed from
// glyphs, or if its geometry counts how many to draw — and dots, grid, stripes and waves are the four that do neither.
// A third list would be one more thing to remember when a pattern is added.
export function hasMarks(pattern) {
  return Boolean(PATTERN_GLYPHS[pattern]) || Boolean(PATTERN_GEOMETRY[pattern]?.count)
}

// The loop a backdrop actually draws, which is not always the one that was chosen. A style that needs marks becomes its
// whole-layer stand-in on a pattern that draws no marks, and Plain draws nothing at all, so it gets Still.
//
// This runs when the backdrop is drawn and never when the theme is saved, so switching Dots to Maths and back gives the
// admin the style they picked. `pattern` is the raw pattern here, because a style may legitimately have been saved
// before the picture it needs was cleared, and the studio needs the same answer to grey out Pan in the picker.
//
// Picture-only is checked before the stand-in, and 'image' has no marks, so an order slip here would quietly turn Pan
// into Breathe rather than into Still.
export function resolveMotion(motion, pattern) {
  if (pattern === 'none') return 'off'
  if (MOTION_PICTURE_ONLY.includes(motion) && pattern !== 'image') return 'off'
  // Only a pattern that draws discrete marks can move them one at a time. Anywhere else the style becomes the closest
  // whole-layer loop, so an admin who picked Float on Dots gets a moving backdrop rather than a dead button.
  if (MOTION_PER_MARK.includes(motion) && !hasMarks(pattern)) return MOTION_MARKLESS_STANDIN[motion] ?? motion
  return motion
}

// The speed the table in MOTION_DURATIONS is written at, which is also the default. Every duration is relative to this, so
// renaming the middle stop means changing one number here rather than rewriting eight durations.
const MOTION_REFERENCE_SPEED = 3

// How many seconds one cycle of a style takes at the speed that was chosen. Speed scales the reference: 3 runs the table
// as written, 5 runs it a third faster and 1 takes three times as long — which is why the slider reads as five words
// rather than as a multiplier. An unknown style is Still and never asks, hence 0.
export function motionDuration(motion, speed) {
  const base = MOTION_DURATIONS[motion]
  if (!base) return 0
  const clamped = Math.min(BACKDROP_RANGES.motionSpeed.max, Math.max(BACKDROP_RANGES.motionSpeed.min, speed))
  return +(base * (MOTION_REFERENCE_SPEED / clamped)).toFixed(2)
}

// The four scheme colours are one decision with four ends, so one function takes the whole patch rather than four
// functions each taking one value. A key absent from the patch is left alone; a key present but unusable clears, which
// is how the studio's own clear button hands a pair back to the scheme.
export function withSchemeColors(theme, patch) {
  const next = { ...theme }
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return next
  for (const key of SCHEME_COLOR_KEYS) {
    if (!Object.hasOwn(patch, key)) continue
    next[key] = cleanHexColor(patch[key])
  }
  return next
}

// The page tokens for a chosen page colour. `--color-paper` is the colour the admin picked — that is the whole point of
// the control, and taking it from the palette instead would paint every choice the same two colours whatever was chosen.
// The rest of the palette is picked by measured contrast, because cards, chips and borders have to sit *off* the page to
// be seen at all, and the site's own two sets do that on a page of either kind. Leaving them on the site's colours is
// deliberate: an admin asking for a plum backdrop is asking for the backdrop, not to have every chip repainted with it.
export function themePageVars(page) {
  if (!isHexColor(page)) return {}
  const dark = contrastRatio(page, PAGE_DARK['ink-900']) > contrastRatio(page, PAGE_LIGHT['ink-900'])
  const palette = dark ? PAGE_DARK : PAGE_LIGHT
  const tokens = Object.fromEntries(Object.entries(palette).map(([token, value]) => [`--color-${token}`, value]))
  // Native controls follow the document's colour-scheme rather than our custom tokens, so a dark page leaves a light
  // text field in it unless this says otherwise. `colorScheme`, not `color-scheme`: React logs an error for a hyphenated
  // key that is not a custom property. The page scrollbar is not fixed by this — that comes from :root, and a
  // `display: contents` wrapper generates no box to set it on.
  return { ...tokens, colorScheme: dark ? 'dark' : 'light', '--color-paper': page }
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

// How readable one colour is on another (1 to 21). The card draws its score in the accent on the look's own dark
// background, and several looks are close in tone — mono grey on near-black, forest green on dark green — so it has
// to be able to ask whether the accent is legible there at all rather than assume it.
export function contrastRatio(a, b) {
  if (!isHexColor(a) || !isHexColor(b)) return 1
  const [light, dark] = luminance(a) > luminance(b) ? [luminance(a), luminance(b)] : [luminance(b), luminance(a)]
  return Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100
}

// The CSS variables a theme sets on the page. The accent replaces the site's orange everywhere in the quiz screens; a
// page colour replaces `--color-paper` and supplies the ink set that reads on it. With no page colour neither is emitted,
// so a quiz that has never been given one looks exactly as it did before this option existed.
export function themeCssVars(theme) {
  const t = sanitizeTheme(theme)
  const look = THEME_LOOKS[t.look]
  const accent = t.accent ?? look.accent
  return {
    '--color-orange-500': accent,
    '--color-orange-600': `color-mix(in srgb, ${accent} 72%, black)`,
    '--color-orange-100': `color-mix(in srgb, ${accent} 14%, white)`,
    '--color-brand-orange': accent,
    // The accent sits above the scheme's tint and below the admin's own, which is today's order with one step
    // added. The fallback is look.glow[0] and deliberately not `accent`: that variable holds the scheme's *button*
    // colour, which is a different value that merely happens to match on some looks.
    '--qz-glow-a': t.glowA ?? t.accent ?? look.glow[0],
    '--qz-glow-b': t.glowB ?? look.glow[1],
    '--qz-deep-a': t.deepA ?? look.deep[0],
    '--qz-deep-b': t.deepB ?? look.deep[1],
    ...themePageVars(t.page),
  }
}
