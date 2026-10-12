// The 50 quiz characters, as data, and the one place they are drawn.
//
// Every character is a spec: a body, a headpiece, a face, something to wear, maybe a floating prop, a colour, and its
// own moves. This module holds the part lists, the built-in roster, and the drawing itself, so the browser and the
// server-side result card draw from the same code instead of from a generated copy of it.
//
// It is imported by src/ as well as by api/, so it must stay pure: no window, no Supabase client, no Node built-ins,
// no React. The drawing returns SVG strings rather than React elements because react-dom/server inside a Vercel
// function is the failure mode recorded at api/_lib/characterSvg.js.

const CAMEL = /[A-Z]/g
const DROP = new Set(['key', 'ref'])

// React hyphenates strokeWidth into stroke-width, but it does NOT hyphenate this list — viewBox is not view-box, and a
// view-box attribute is silently ignored by every renderer. This is React's own list, copied rather than guessed,
// because getting one entry wrong is a character that draws slightly wrong and no test would say why.
const CAMEL_AS_IS = new Set([
  'allowReorder', 'attributeName', 'attributeType', 'autoReverse', 'baseFrequency', 'baseProfile', 'calcMode',
  'clipPathUnits', 'contentScriptType', 'contentStyleType', 'diffuseConstant', 'edgeMode', 'externalResourcesRequired',
  'filterRes', 'filterUnits', 'glyphRef', 'gradientTransform', 'gradientUnits', 'kernelMatrix', 'kernelUnitLength',
  'keyPoints', 'keySplines', 'keyTimes', 'lengthAdjust', 'limitingConeAngle', 'markerHeight', 'markerUnits',
  'markerWidth', 'maskContentUnits', 'maskUnits', 'numOctaves', 'pathLength', 'patternContentUnits',
  'patternTransform', 'patternUnits', 'pointsAtX', 'pointsAtY', 'pointsAtZ', 'preserveAlpha', 'preserveAspectRatio',
  'primitiveUnits', 'refX', 'refY', 'repeatCount', 'repeatDur', 'requiredExtensions', 'requiredFeatures',
  'specularConstant', 'specularExponent', 'spreadMethod', 'startOffset', 'stdDeviation', 'stitchTiles', 'surfaceScale',
  'systemLanguage', 'tableValues', 'targetX', 'targetY', 'textLength', 'viewBox', 'viewTarget', 'xChannelSelector',
  'yChannelSelector', 'zoomAndPan',
])

// React escapes these inside an attribute value, and the committed markup was produced by React, so escaping has to
// match it exactly or the parity test fails on characters nobody changed. React writes ' as &#x27; — confirmed
// against the font-family attribute in api/_lib/quizCharacterMarkup.js, not assumed.
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' }

export function h(tag, attrs = null, children = null) {
  return { tag, attrs, children }
}

function attribute(name, value) {
  if (value === null || value === undefined || value === false) return null
  const text = String(value).replace(/[&<>"']/g, (c) => ESCAPES[c])
  return `${CAMEL_AS_IS.has(name) ? name : name.replace(CAMEL, (c) => `-${c.toLowerCase()}`)}="${text}"`
}

function children(node) {
  if (node === null || node === undefined || node === false) return ''
  if (Array.isArray(node)) return node.map(children).join('')
  return node.tag ? toSvg(node) : String(node)
}

// Takes a node or a list of them. A list is what a part that draws several shapes returns, and what a group with a
// conditional branch in it returns, so it is a normal thing to hand over rather than an edge case.
export function toSvg(node) {
  if (Array.isArray(node)) return children(node)
  const attrs = Object.entries(node.attrs ?? {})
    .filter(([name]) => !DROP.has(name))
    .map(([name, value]) => attribute(name, value))
    .filter(Boolean)
    .join(' ')
  const open = attrs ? `<${node.tag} ${attrs}>` : `<${node.tag}>`
  return `${open}${children(node.children)}</${node.tag}>`
}

// ---- the drawer ----------------------------------------------------------------------------------------------------
//
// Six lists of parts, and four lists of moves. Anything in here can be combined with anything else in here, which is
// what the cast editor in the studio builds from.

export const BODIES = ['blob', 'box', 'round', 'bean', 'ghost', 'onigiri', 'cloud', 'drop', 'loaf', 'hexagon', 'pear', 'jelly', 'diamond']
export const TOPPERS = ['none', 'cat', 'bunny', 'bear', 'horns', 'antenna', 'bugs', 'sprout', 'spikes', 'floppy', 'halo', 'tuft']
export const EYES = ['round', 'dot', 'sleepy', 'wide', 'wink', 'star', 'slit', 'lash', 'cyclops', 'spiral']
export const MOUTHS = ['smile', 'grin', 'cat', 'o', 'smirk', 'tongue', 'fang', 'flat']
export const ACCESSORIES = [
  'none', 'sunglasses', 'glasses', 'headphones', 'bowtie', 'tie', 'scarf', 'monocle', 'eyepatch', 'ninja',
  'hero', 'flower', 'crown', 'gradcap', 'partyhat', 'goggles', 'mustache', 'cap', 'chef', 'beanie',
]
export const PROPS = ['none', 'bulb', 'book', 'star', 'heart', 'note', 'pi', 'sigma', 'sqrt', 'infinity', 'balloon', 'trophy']

export const IDLE_MOVES = ['bob', 'sway', 'breathe', 'hover', 'nervous', 'hop', 'tilt', 'pulse', 'doze', 'glitch', 'wobble']
export const WIN_MOVES = ['jump', 'spin', 'flip', 'shimmy', 'pogo', 'headbang', 'stretch', 'zoom', 'moonwalk', 'tada']
export const SAD_MOVES = ['droop', 'shake', 'sink', 'tremble']
export const HELLO_MOVES = ['wave', 'salute', 'flex', 'cheer', 'point', 'hips', 'clap', 'shrug']

const IDLE_LABELS = ['Bobs gently', 'Sways side to side', 'Breathes deeply', 'Hovers', 'Shivers nervously', 'Hops on the spot', 'Tilts its head', 'Pulses', 'Dozes off', 'Glitches', 'Wobbles']
const WIN_LABELS = ['Jumps for joy', 'Spins', 'Backflips', 'Shimmies', 'Pogo-hops', 'Headbangs', 'Stretches', 'Zooms', 'Moonwalks', 'Does a ta-da']
const HELLO_LABELS = ['Waves', 'Salutes', 'Flexes', 'Cheers', 'Points', 'Strikes a pose', 'Claps', 'Shrugs']

// ---- the 50 built-in characters ------------------------------------------------------------------------------------
//
// Each one is its own design: a name, a body, a headpiece, a face, something to wear, maybe a floating maths symbol or
// prop, a colour, and its own set of moves (how it idles, how it celebrates, how it says hello). Nothing here is
// shared between two characters, which quizCharacterArt.test.js checks.
//
// These 50 are code and are always available. A quiz can add its own characters on top; those live in a database and
// resolve through characterSpec, not through this table.

const ROSTER = [
  ['Pixel', 'box', 'antenna', 'round', 'flat', 'none', 'bulb'],
  ['Mochi', 'round', 'bear', 'sleepy', 'smile', 'scarf', 'none'],
  ['Zippy', 'blob', 'spikes', 'wide', 'grin', 'goggles', 'star'],
  ['Professor Pi', 'pear', 'none', 'round', 'smile', 'glasses', 'pi'],
  ['Blaze', 'drop', 'tuft', 'wink', 'smirk', 'none', 'none'],
  ['Nimbus', 'cloud', 'halo', 'sleepy', 'o', 'none', 'note'],
  ['Boo', 'ghost', 'none', 'dot', 'o', 'bowtie', 'none'],
  ['Sir Sigma', 'hexagon', 'none', 'round', 'smile', 'monocle', 'sigma'],
  ['Captain Root', 'loaf', 'none', 'wide', 'grin', 'cap', 'sqrt'],
  ['Jellybean', 'jelly', 'sprout', 'dot', 'smile', 'none', 'none'],
  ['Whiskers', 'blob', 'cat', 'slit', 'cat', 'none', 'none'],
  ['Hopper', 'bean', 'bunny', 'round', 'smile', 'headphones', 'note'],
  ['Ninja Nori', 'onigiri', 'none', 'round', 'flat', 'ninja', 'none'],
  ['Duke', 'round', 'floppy', 'round', 'tongue', 'bowtie', 'none'],
  ['Sparkle', 'diamond', 'none', 'star', 'grin', 'crown', 'star'],
  ['Gizmo', 'box', 'bugs', 'cyclops', 'flat', 'none', 'bulb'],
  ['Sunny', 'blob', 'sprout', 'lash', 'smile', 'flower', 'none'],
  ['Chef Pear', 'pear', 'floppy', 'wide', 'smile', 'chef', 'none'],
  ['Dash', 'bean', 'tuft', 'wink', 'smirk', 'sunglasses', 'none'],
  ['Moonbeam', 'drop', 'halo', 'lash', 'smile', 'none', 'star'],
  ['Grumble', 'loaf', 'horns', 'round', 'smirk', 'none', 'none'],
  ['Sprout', 'onigiri', 'sprout', 'round', 'smile', 'none', 'none'],
  ['Ziggy', 'hexagon', 'bugs', 'spiral', 'tongue', 'none', 'none'],
  ['Gadget', 'box', 'spikes', 'wide', 'grin', 'goggles', 'none'],
  ['Fuzz', 'round', 'bunny', 'dot', 'o', 'none', 'none'],
  ['Bubbles', 'jelly', 'none', 'wide', 'o', 'none', 'balloon'],
  ['Wizzle', 'ghost', 'tuft', 'sleepy', 'smirk', 'none', 'infinity'],
  ['Coco', 'loaf', 'bear', 'lash', 'smile', 'beanie', 'none'],
  ['Ollie', 'pear', 'cat', 'round', 'cat', 'bowtie', 'none'],
  ['Rocket', 'bean', 'antenna', 'wide', 'grin', 'none', 'trophy'],
  ['Pepper', 'drop', 'spikes', 'slit', 'fang', 'none', 'none'],
  ['Waffle', 'loaf', 'cat', 'dot', 'smile', 'scarf', 'none'],
  ['Nebula', 'cloud', 'bugs', 'star', 'smile', 'none', 'pi'],
  ['Trixie', 'diamond', 'tuft', 'lash', 'smirk', 'hero', 'none'],
  ['Bolt', 'hexagon', 'antenna', 'round', 'flat', 'none', 'none'],
  ['Tofu', 'round', 'none', 'dot', 'flat', 'partyhat', 'none'],
  ['Gus', 'ghost', 'horns', 'round', 'fang', 'tie', 'none'],
  ['Skye', 'cloud', 'sprout', 'wide', 'smile', 'none', 'balloon'],
  ['Cleo', 'diamond', 'cat', 'lash', 'cat', 'scarf', 'none'],
  ['Buzz', 'jelly', 'bugs', 'wide', 'grin', 'goggles', 'none'],
  ['Finn', 'drop', 'floppy', 'round', 'tongue', 'none', 'none'],
  ['Lumi', 'bean', 'halo', 'sleepy', 'smile', 'none', 'bulb'],
  ['Rex', 'onigiri', 'spikes', 'round', 'fang', 'none', 'none'],
  ['Scholar', 'box', 'bear', 'dot', 'smile', 'gradcap', 'book'],
  ['Marvin', 'blob', 'none', 'sleepy', 'flat', 'mustache', 'book'],
  ['Penny', 'pear', 'bunny', 'lash', 'smile', 'none', 'heart'],
  ['Quill', 'bean', 'none', 'round', 'smirk', 'monocle', 'book'],
  ['Echo', 'ghost', 'antenna', 'dot', 'o', 'headphones', 'note'],
  ['Vex', 'diamond', 'horns', 'slit', 'smirk', 'eyepatch', 'none'],
  ['Glow', 'jelly', 'halo', 'star', 'smile', 'none', 'infinity'],
]

export const BUILTIN_COUNT = ROSTER.length

// A few characters are not a bright colour on purpose (a white ghost, a charcoal ninja, an off-white tofu).
const SPECIAL_COLOURS = {
  6: { main: '#f9fafb', dark: '#9ca3af', light: '#ffffff' },
  12: { main: '#4b5563', dark: '#111827', light: '#9ca3af' },
  35: { main: '#f3f4f6', dark: '#6b7280', light: '#ffffff' },
}
const TONES = [
  { s: 88, l: 66 },
  { s: 72, l: 74 },
  { s: 78, l: 56 },
  { s: 58, l: 50 },
  { s: 92, l: 62 },
]

function hsl(h, s, l) {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100)
  const f = (n) => {
    const k = (n + h / 30) % 12
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(255 * c).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

// The golden angle spreads the hues evenly, and cycling through five tones keeps neighbours from looking alike. This is
// the built-ins' colour only: a cast character brings its own hex and deriveColour turns it into the same three values.
function builtinColour(id) {
  if (SPECIAL_COLOURS[id]) return SPECIAL_COLOURS[id]
  const hue = (id * 137.508) % 360
  const tone = TONES[id % TONES.length]
  return { main: hsl(hue, tone.s, tone.l), dark: hsl(hue, tone.s, 28), light: hsl(hue, tone.s - 12, 90) }
}

export function normalizeAvatarId(id) {
  return Number.isInteger(id) && id >= 0 && id < BUILTIN_COUNT ? id : 0
}

// Every (idle, win) pair is different for all 50 ids, because 11 and 10 share no factor and 50 is less than 110.
export function avatarInfo(id) {
  const n = normalizeAvatarId(id)
  const [name, body, topper, eyes, mouth, accessory, prop] = ROSTER[n]
  const idle = IDLE_MOVES[n % IDLE_MOVES.length]
  const win = WIN_MOVES[n % WIN_MOVES.length]
  const hello = HELLO_MOVES[(n * 3 + Math.floor(n / 8)) % HELLO_MOVES.length]
  return {
    id: n,
    name,
    body,
    topper,
    eyes,
    mouth,
    accessory,
    prop,
    color: builtinColour(n),
    idle,
    win,
    sad: SAD_MOVES[n % SAD_MOVES.length],
    hello,
    moves: {
      idle: IDLE_LABELS[n % IDLE_MOVES.length],
      win: WIN_LABELS[n % WIN_MOVES.length],
      hello: HELLO_LABELS[(n * 3 + Math.floor(n / 8)) % HELLO_MOVES.length],
    },
  }
}

export function randomAvatarId() {
  return Math.floor(Math.random() * BUILTIN_COUNT)
}

// ---- the drawing ----------------------------------------------------------------------------------------------------
//
// One of the 50, drawn as SVG. Which character it is comes from the spec; `mood` changes the face and the movement:
// idle, happy, dance, sad or wave. Every character moves in its own way, through the qz-* classes the browser's
// characters.css animates.

const INK = '#1f2937'

// Per body: its outline, the row the eyes sit on, where the top of the head is (hats sit there), where ears and horns
// attach (half-width, row), where the neck items go, and where the arms start (half-width, row).
const BODY = {
  blob: { eyeY: 50, top: 18, ear: [20, 26], neckY: 76, arm: [28, 66] },
  box: { eyeY: 48, top: 26, ear: [22, 28], neckY: 75, arm: [28, 62] },
  round: { eyeY: 50, top: 21, ear: [22, 28], neckY: 80, arm: [27, 66] },
  bean: { eyeY: 44, top: 16, ear: [16, 24], neckY: 72, arm: [24, 62] },
  ghost: { eyeY: 50, top: 18, ear: [22, 26], neckY: 76, arm: [29, 66] },
  onigiri: { eyeY: 58, top: 14, ear: [13, 30], neckY: 77, arm: [31, 70] },
  cloud: { eyeY: 54, top: 24, ear: [20, 34], neckY: 70, arm: [30, 64] },
  drop: { eyeY: 60, top: 12, ear: [12, 36], neckY: 77, arm: [27, 70] },
  loaf: { eyeY: 54, top: 30, ear: [26, 34], neckY: 78, arm: [36, 66] },
  hexagon: { eyeY: 50, top: 14, ear: [26, 30], neckY: 75, arm: [30, 62] },
  pear: { eyeY: 56, top: 16, ear: [14, 28], neckY: 78, arm: [30, 70] },
  jelly: { eyeY: 46, top: 16, ear: [22, 26], neckY: 68, arm: [30, 60] },
  diamond: { eyeY: 46, top: 12, ear: [12, 36], neckY: 66, arm: [31, 52] },
}

function body(kind, color) {
  const line = { stroke: color.dark, strokeWidth: 2.5, strokeLinejoin: 'round' }
  const fill = { fill: color.main, ...line }
  switch (kind) {
    case 'blob':
      return [
        h('ellipse', { cx: 38, cy: 86, rx: 9, ry: 5, fill: color.dark }),
        h('ellipse', { cx: 62, cy: 86, rx: 9, ry: 5, fill: color.dark }),
        h('path', { d: 'M50 18c-19 0-30 15-30 34 0 17 11 30 30 30s30-13 30-30c0-19-11-34-30-34z', ...fill }),
      ]
    case 'box':
      return [
        h('rect', { x: 22, y: 26, width: 56, height: 56, rx: 15, ...fill }),
        h('rect', { x: 31, y: 82, width: 10, height: 6, rx: 2, fill: color.dark }),
        h('rect', { x: 59, y: 82, width: 10, height: 6, rx: 2, fill: color.dark }),
      ]
    case 'round':
      return h('circle', { cx: 50, cy: 52, r: 31, ...fill })
    case 'bean':
      return h('rect', { x: 26, y: 16, width: 48, height: 68, rx: 24, ...fill })
    case 'ghost':
      return h('path', { d: 'M21 86V52c0-19 13-34 29-34s29 15 29 34v34l-9.7-7-9.7 7-9.6-7-9.6 7-9.7-7-9.7 7z', ...fill })
    case 'onigiri':
      return h('path', { d: 'M50 14c10 0 16 12 24 32 8 20 10 34-4 38H30c-14-4-12-18-4-38 8-20 14-32 24-32z', ...fill })
    case 'cloud':
      return [
        h('g', { stroke: color.dark, strokeWidth: 5 }, [
          h('circle', { cx: 33, cy: 58, r: 18, fill: color.dark }),
          h('circle', { cx: 50, cy: 45, r: 21, fill: color.dark }),
          h('circle', { cx: 68, cy: 58, r: 18, fill: color.dark }),
          h('rect', { x: 30, y: 56, width: 40, height: 26, rx: 13, fill: color.dark }),
        ]),
        h('circle', { cx: 33, cy: 58, r: 18, fill: color.main }),
        h('circle', { cx: 50, cy: 45, r: 21, fill: color.main }),
        h('circle', { cx: 68, cy: 58, r: 18, fill: color.main }),
        h('rect', { x: 30, y: 56, width: 40, height: 26, rx: 13, fill: color.main }),
      ]
    case 'drop':
      return h('path', { d: 'M50 12S22 44 22 62c0 14 12 24 28 24s28-10 28-24C78 44 50 12 50 12z', ...fill })
    case 'loaf':
      return [
        h('rect', { x: 12, y: 30, width: 76, height: 54, rx: 22, ...fill }),
        h('path', { d: 'M22 40q6-6 14-2', fill: 'none', stroke: color.light, strokeWidth: 3, strokeLinecap: 'round' }),
      ]
    case 'hexagon':
      return h('polygon', { points: '50,14 80,30 80,68 50,86 20,68 20,30', ...fill, strokeWidth: 3 })
    case 'pear':
      return h('path', { d: 'M50 16c12 0 16 14 16 24 16 8 18 24 14 34-4 12-56 12-60 0-4-10-2-26 14-34 0-10 4-24 16-24z', ...fill })
    case 'jelly':
      return h('path', {
        d: 'M20 56C20 32 32 16 50 16s30 16 30 40v16c0 12-10 16-14 6-4 10-12 10-16 0-4 10-12 10-16 0-4 10-14 6-14-6z',
        ...fill,
      })
    default:
      return h('path', { d: 'M50 12 84 50 50 88 16 50z', ...fill, strokeWidth: 3 })
  }
}

// Ears, horns, antennae and so on. They sit behind the body.
function topper(kind, shape, color) {
  const { top, ear: [ex, ey] } = shape
  const line = { stroke: color.dark, strokeWidth: 2.5, strokeLinejoin: 'round', strokeLinecap: 'round' }
  switch (kind) {
    case 'cat':
      return [
        h('polygon', { points: `${50 - ex - 7},${ey + 8} ${50 - ex - 4},${ey - 14} ${50 - ex + 12},${ey - 2}`, fill: color.main, ...line }),
        h('polygon', { points: `${50 + ex + 7},${ey + 8} ${50 + ex + 4},${ey - 14} ${50 + ex - 12},${ey - 2}`, fill: color.main, ...line }),
        h('polygon', { points: `${50 - ex - 3},${ey + 2} ${50 - ex - 2},${ey - 8} ${50 - ex + 5},${ey - 1}`, fill: color.light }),
        h('polygon', { points: `${50 + ex + 3},${ey + 2} ${50 + ex + 2},${ey - 8} ${50 + ex - 5},${ey - 1}`, fill: color.light }),
      ]
    case 'bunny': {
      const y = Math.max(2, top - 20)
      return [
        h('rect', { x: 31, y, width: 14, height: 38, rx: 7, fill: color.main, ...line }),
        h('rect', { x: 55, y, width: 14, height: 38, rx: 7, fill: color.main, ...line }),
        h('rect', { x: 35, y: y + 5, width: 6, height: 24, rx: 3, fill: color.light }),
        h('rect', { x: 59, y: y + 5, width: 6, height: 24, rx: 3, fill: color.light }),
      ]
    }
    case 'bear':
      return [
        h('circle', { cx: 50 - ex - 3, cy: ey + 1, r: 10, fill: color.main, ...line }),
        h('circle', { cx: 50 + ex + 3, cy: ey + 1, r: 10, fill: color.main, ...line }),
        h('circle', { cx: 50 - ex - 3, cy: ey + 1, r: 5, fill: color.light }),
        h('circle', { cx: 50 + ex + 3, cy: ey + 1, r: 5, fill: color.light }),
      ]
    case 'horns':
      return [
        h('path', { d: `M${50 - ex + 4} ${ey + 8}Q${50 - ex - 8} ${ey - 4} ${50 - ex + 2} ${ey - 16}Q${50 - ex + 12} ${ey - 4} ${50 - ex + 14} ${ey + 4}z`, fill: '#fde68a', stroke: '#b45309', strokeWidth: 2, strokeLinejoin: 'round' }),
        h('path', { d: `M${50 + ex - 4} ${ey + 8}Q${50 + ex + 8} ${ey - 4} ${50 + ex - 2} ${ey - 16}Q${50 + ex - 12} ${ey - 4} ${50 + ex - 14} ${ey + 4}z`, fill: '#fde68a', stroke: '#b45309', strokeWidth: 2, strokeLinejoin: 'round' }),
      ]
    case 'antenna':
      return [
        h('line', { x1: 50, y1: top + 6, x2: 50, y2: top - 8, stroke: color.dark, strokeWidth: 3, strokeLinecap: 'round' }),
        h('circle', { cx: 50, cy: top - 10, r: 5, fill: color.light, stroke: color.dark, strokeWidth: 2.5 }),
      ]
    case 'bugs':
      return [
        h('path', { d: `M43 ${top + 6}Q36 ${top - 6} 33 ${top - 12}`, fill: 'none', stroke: color.dark, strokeWidth: 2.6, strokeLinecap: 'round' }),
        h('path', { d: `M57 ${top + 6}Q64 ${top - 6} 67 ${top - 12}`, fill: 'none', stroke: color.dark, strokeWidth: 2.6, strokeLinecap: 'round' }),
        h('circle', { cx: 32, cy: top - 14, r: 4, fill: color.light, stroke: color.dark, strokeWidth: 2.2 }),
        h('circle', { cx: 68, cy: top - 14, r: 4, fill: color.light, stroke: color.dark, strokeWidth: 2.2 }),
      ]
    case 'sprout':
      return [
        h('path', { d: `M50 ${top + 5}Q50 ${top - 4} 52 ${top - 9}`, fill: 'none', stroke: '#15803d', strokeWidth: 2.6, strokeLinecap: 'round' }),
        h('ellipse', { cx: 44, cy: top - 11, rx: 8, ry: 4.2, transform: `rotate(-28 44 ${top - 11})`, fill: '#4ade80', stroke: '#15803d', strokeWidth: 1.8 }),
        h('ellipse', { cx: 59, cy: top - 11, rx: 8, ry: 4.2, transform: `rotate(28 59 ${top - 11})`, fill: '#86efac', stroke: '#15803d', strokeWidth: 1.8 }),
      ]
    case 'spikes':
      return [
        h('g', { fill: color.dark, stroke: color.dark, strokeWidth: 2, strokeLinejoin: 'round' }, [
          h('polygon', { points: `34,${top + 6} 38,${top - 10} 46,${top + 2}` }),
          h('polygon', { points: `43,${top + 3} 50,${top - 15} 57,${top + 3}` }),
          h('polygon', { points: `54,${top + 2} 62,${top - 10} 66,${top + 6}` }),
        ]),
      ]
    case 'floppy':
      return [
        h('ellipse', { cx: 50 - ex - 8, cy: ey + 12, rx: 8, ry: 16, transform: `rotate(14 ${50 - ex - 8} ${ey + 12})`, fill: color.dark }),
        h('ellipse', { cx: 50 + ex + 8, cy: ey + 12, rx: 8, ry: 16, transform: `rotate(-14 ${50 + ex + 8} ${ey + 12})`, fill: color.dark }),
      ]
    case 'halo':
      return h('ellipse', { class: 'qz-halo', cx: 50, cy: top - 9, rx: 14, ry: 4.4, fill: 'none', stroke: '#fbbf24', strokeWidth: 3.2 })
    case 'tuft':
      return h('path', {
        d: `M50 ${top + 4}c-8-5-4-14 4-13 6 1 5 8 0 9`,
        fill: 'none', stroke: color.dark, strokeWidth: 3.2, strokeLinecap: 'round',
      })
    default:
      return null
  }
}

const STAR = 'M0-6L1.47-2.02 5.71-1.85 2.38.77 3.53 4.85 0 2.5-3.53 4.85-2.38.77-5.71-1.85-1.47-2.02z'

function eye(kind, x, y) {
  switch (kind) {
    case 'dot':
      return [
        h('ellipse', { cx: x, cy: y, rx: 3.8, ry: 5, fill: INK }),
        h('circle', { cx: x + 1.2, cy: y - 1.8, r: 1.3, fill: '#fff' }),
      ]
    case 'sleepy':
      return [
        h('circle', { cx: x, cy: y, r: 7, fill: '#fff' }),
        h('circle', { cx: x + 0.5, cy: y + 2.2, r: 3.4, fill: INK }),
        h('path', { d: `M${x - 7.6} ${y + 0.6}h15.2`, stroke: INK, strokeWidth: 2.6, strokeLinecap: 'round' }),
      ]
    case 'wide':
      return [
        h('circle', { cx: x, cy: y, r: 8.6, fill: '#fff', stroke: INK, strokeWidth: 1.2 }),
        h('circle', { cx: x + 0.6, cy: y + 0.6, r: 5, fill: INK }),
        h('circle', { cx: x + 2.4, cy: y - 1.6, r: 1.7, fill: '#fff' }),
        h('circle', { cx: x - 1.4, cy: y + 2.2, r: 0.9, fill: '#fff' }),
      ]
    case 'star':
      return [
        h('circle', { cx: x, cy: y, r: 8, fill: '#fff', stroke: INK, strokeWidth: 1.2 }),
        h('path', { d: STAR, transform: `translate(${x} ${y + 0.4}) scale(0.95)`, fill: '#f59e0b', stroke: '#b45309', strokeWidth: 1, strokeLinejoin: 'round' }),
      ]
    case 'slit':
      return [
        h('ellipse', { cx: x, cy: y, rx: 7, ry: 7.6, fill: '#fde047', stroke: INK, strokeWidth: 1.6 }),
        h('ellipse', { cx: x, cy: y, rx: 1.7, ry: 6, fill: INK }),
      ]
    case 'lash':
      return [
        h('circle', { cx: x, cy: y, r: 7, fill: '#fff' }),
        h('circle', { cx: x + 0.6, cy: y + 0.5, r: 3.6, fill: INK }),
        h('circle', { cx: x + 2, cy: y - 1.3, r: 1.2, fill: '#fff' }),
        h('path', {
          d: x < 50 ? `M${x - 6} ${y - 4}l-4-3M${x - 3} ${y - 7}l-2-4M${x + 1} ${y - 8}l0-4` : `M${x + 6} ${y - 4}l4-3M${x + 3} ${y - 7}l2-4M${x - 1} ${y - 8}l0-4`,
          stroke: INK, strokeWidth: 1.8, strokeLinecap: 'round',
        }),
      ]
    case 'spiral':
      return [
        h('circle', { cx: x, cy: y, r: 7.4, fill: '#fff' }),
        h('path', { d: `M${x} ${y}m0-1.2a1.2 1.2 0 1 1-1.2 1.2a3 3 0 1 1 3 3a5 5 0 1 1-5-5`, fill: 'none', stroke: INK, strokeWidth: 1.6, strokeLinecap: 'round' }),
      ]
    default:
      return [
        h('circle', { cx: x, cy: y, r: 7, fill: '#fff' }),
        h('circle', { cx: x + 1, cy: y + 0.5, r: 3.6, fill: INK }),
        h('circle', { cx: x + 2.4, cy: y - 1.3, r: 1.2, fill: '#fff' }),
      ]
  }
}

function mouth(kind, y) {
  const stroke = { fill: 'none', stroke: INK, strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (kind) {
    case 'grin':
      return h('path', { d: `M41 ${y - 1}q9 13 18 0z`, fill: '#7f1d1d', stroke: INK, strokeWidth: 2.2, strokeLinejoin: 'round' })
    case 'cat':
      return h('path', { d: `M41 ${y}q4.5 6 9 0q4.5 6 9 0`, ...stroke })
    case 'o':
      return h('ellipse', { cx: 50, cy: y + 2, rx: 3.6, ry: 4.4, fill: '#7f1d1d', stroke: INK, strokeWidth: 2 })
    case 'smirk':
      return h('path', { d: `M42 ${y + 3}q9 6 17-3`, ...stroke })
    case 'tongue':
      return [
        h('path', { d: `M41 ${y}q9 9 18 0`, ...stroke }),
        h('path', { d: `M47 ${y + 4.6}v4.4a3 3 0 0 0 6 0v-4.4z`, fill: '#f472b6', stroke: INK, strokeWidth: 1.6, strokeLinejoin: 'round' }),
      ]
    case 'fang':
      return [
        h('path', { d: `M41 ${y}q9 8 18 0`, ...stroke }),
        h('path', { d: `M44.5 ${y + 3.4}l2.6 5 2.6-3.6zM55.5 ${y + 3.4}l-2.6 5-2.6-3.6z`, fill: '#fff', stroke: INK, strokeWidth: 1.2, strokeLinejoin: 'round' }),
      ]
    case 'flat':
      return h('path', { d: `M43 ${y + 3}h14`, ...stroke })
    default:
      return h('path', { d: `M42 ${y}q8 7 16 0`, ...stroke })
  }
}

function face(mood, eyes, mouthKind, eyeY, color) {
  const happy = mood === 'happy' || mood === 'dance'
  const sad = mood === 'sad'
  const mouthY = eyeY + 15
  const cyclops = eyes === 'cyclops'
  let eyesArt
  if (happy) {
    eyesArt = cyclops
      ? h('path', { d: `M41 ${eyeY + 3}q9-13 18 0`, fill: 'none', stroke: INK, strokeWidth: 3.6, strokeLinecap: 'round' })
      : [
        h('path', { d: `M31 ${eyeY + 2}q7-10 14 0`, fill: 'none', stroke: INK, strokeWidth: 3.4, strokeLinecap: 'round' }),
        h('path', { d: `M55 ${eyeY + 2}q7-10 14 0`, fill: 'none', stroke: INK, strokeWidth: 3.4, strokeLinecap: 'round' }),
      ]
  } else if (sad) {
    eyesArt = [
      h('circle', { cx: 38, cy: eyeY + 1, r: 7, fill: '#fff' }),
      h('circle', { cx: 62, cy: eyeY + 1, r: 7, fill: '#fff' }),
      h('circle', { cx: 38, cy: eyeY + 3.5, r: 3.6, fill: INK }),
      h('circle', { cx: 62, cy: eyeY + 3.5, r: 3.6, fill: INK }),
      h('path', { d: `M32 ${eyeY - 6}l10-4M68 ${eyeY - 6}l-10-4`, stroke: INK, strokeWidth: 2.6, strokeLinecap: 'round' }),
      h('path', { d: `M33 ${eyeY + 9}q-3 6 0 9q3-3 0-9z`, fill: '#7dd3fc' }),
    ]
  } else if (cyclops) {
    eyesArt = [
      h('circle', { cx: 50, cy: eyeY, r: 11, fill: '#fff', stroke: INK, strokeWidth: 1.4 }),
      h('circle', { cx: 51, cy: eyeY + 0.6, r: 6, fill: INK }),
      h('circle', { cx: 53.4, cy: eyeY - 1.8, r: 2, fill: '#fff' }),
    ]
  } else if (eyes === 'wink') {
    eyesArt = [
      eye('round', 38, eyeY),
      h('path', { d: `M56 ${eyeY + 1}q6-8 12 0`, fill: 'none', stroke: INK, strokeWidth: 3.2, strokeLinecap: 'round' }),
    ]
  } else {
    eyesArt = [eye(eyes, 38, eyeY), eye(eyes, 62, eyeY)]
  }
  let mouthArt
  if (happy) {
    mouthArt = h('path', { d: `M40 ${mouthY - 2}q10 16 20 0z`, fill: '#7f1d1d', stroke: INK, strokeWidth: 2, strokeLinejoin: 'round' })
  } else if (sad) {
    mouthArt = h('path', { d: `M42 ${mouthY + 5}q8-8 16 0`, fill: 'none', stroke: INK, strokeWidth: 3, strokeLinecap: 'round' })
  } else {
    mouthArt = mouth(mouthKind, mouthY)
  }
  return [
    eyesArt,
    h('circle', { cx: 27, cy: eyeY + 10, r: 4.5, fill: color.dark, opacity: '0.2' }),
    h('circle', { cx: 73, cy: eyeY + 10, r: 4.5, fill: color.dark, opacity: '0.2' }),
    mouthArt,
  ]
}

function accessory(kind, top, eyeY, neckY) {
  switch (kind) {
    case 'cap':
      return h('g', null, [
        h('path', { d: `M33 ${top + 6}q0-14 17-14t17 14z`, fill: '#2563eb', stroke: '#1e3a8a', strokeWidth: 2, strokeLinejoin: 'round' }),
        h('path', { d: `M58 ${top + 4}h20q2 0 2 3h-22z`, fill: '#1d4ed8', stroke: '#1e3a8a', strokeWidth: 2, strokeLinejoin: 'round' }),
        h('circle', { cx: 50, cy: top - 9, r: 2, fill: '#93c5fd' }),
      ])
    case 'chef':
      return [
        h('g', { fill: '#fff', stroke: '#9ca3af', strokeWidth: 2, strokeLinejoin: 'round' }, [
          h('path', { d: `M36 ${top + 6}v-8c-8-2-10-14-2-16 4-8 14-8 16-3 2-5 12-5 16 3 8 2 6 14-2 16v8z` }),
          h('line', { x1: 36, y1: top + 2, x2: 64, y2: top + 2 }),
        ]),
      ]
    case 'beanie':
      return h('g', null, [
        h('path', { d: `M33 ${top + 8}q0-18 17-18t17 18z`, fill: '#dc2626', stroke: '#7f1d1d', strokeWidth: 2, strokeLinejoin: 'round' }),
        h('rect', { x: 31, y: top + 4, width: 38, height: 8, rx: 4, fill: '#ef4444', stroke: '#7f1d1d', strokeWidth: 2 }),
        h('circle', { cx: 50, cy: top - 11, r: 4.6, fill: '#fecaca', stroke: '#7f1d1d', strokeWidth: 1.8 }),
      ])
    case 'gradcap':
      return h('g', null, [
        h('path', { d: `M37 ${top + 4}v10q13 8 26 0v-10z`, fill: '#1f2937' }),
        h('path', { d: `M50 ${top - 10}L79 ${top + 2}L50 ${top + 13}L21 ${top + 2}z`, fill: '#374151', stroke: '#111827', strokeWidth: 1.5, strokeLinejoin: 'round' }),
        h('line', { x1: 74, y1: top + 3, x2: 74, y2: top + 17, stroke: '#fbbf24', strokeWidth: 2 }),
        h('circle', { cx: 74, cy: top + 19, r: 2.6, fill: '#fbbf24' }),
      ])
    case 'partyhat':
      return h('g', null, [
        h('path', { d: `M50 ${top - 16}L65 ${top + 5}Q50 ${top + 10} 35 ${top + 5}z`, fill: '#f59e0b', stroke: '#b45309', strokeWidth: 1.5, strokeLinejoin: 'round' }),
        h('path', { d: `M44 ${top - 4}l12 4M41 ${top + 1}l18 5`, stroke: '#fff', strokeWidth: 2, opacity: '0.8' }),
        h('circle', { cx: 50, cy: top - 17, r: 3.5, fill: '#ec4899' }),
      ])
    case 'crown':
      return [
        h('g', { fill: '#fbbf24', stroke: '#b45309', strokeWidth: 2, strokeLinejoin: 'round' }, [
          h('path', { d: `M35 ${top + 6}l-3-16 10 7 8-12 8 12 10-7-3 16z` }),
          h('circle', { cx: 50, cy: top - 2, r: 2.4, fill: '#ef4444', stroke: 'none' }),
        ]),
      ]
    case 'glasses':
      return [
        h('g', { fill: 'rgba(186,230,253,0.25)', stroke: '#111827', strokeWidth: 2.8 }, [
          h('circle', { cx: 38, cy: eyeY, r: 10.5 }),
          h('circle', { cx: 62, cy: eyeY, r: 10.5 }),
          h('line', { x1: 48.5, y1: eyeY, x2: 51.5, y2: eyeY }),
        ]),
      ]
    case 'sunglasses':
      return [
        h('g', { fill: '#111827', stroke: '#111827', strokeWidth: 2.6, strokeLinejoin: 'round' }, [
          h('path', { d: `M27 ${eyeY - 7}h21v7q0 8-10 8t-11-8z` }),
          h('path', { d: `M52 ${eyeY - 7}h21v7q0 8-10 8t-11-8z` }),
          h('line', { x1: 48, y1: eyeY - 4, x2: 52, y2: eyeY - 4 }),
          h('path', { d: `M31 ${eyeY - 4}l6 0M56 ${eyeY - 4}l6 0`, stroke: '#6b7280', strokeWidth: 1.8, strokeLinecap: 'round' }),
        ]),
      ]
    case 'monocle':
      return [
        h('g', { fill: 'rgba(253,230,138,0.25)', stroke: '#b45309', strokeWidth: 2.6 }, [
          h('circle', { cx: 62, cy: eyeY, r: 10.5 }),
          h('path', { d: `M68 ${eyeY + 9}q8 10 4 20`, fill: 'none', strokeWidth: 1.8 }),
        ]),
      ]
    case 'eyepatch':
      return h('g', null, [
        h('path', { d: `M24 ${eyeY - 12}L72 ${eyeY - 4}`, stroke: '#111827', strokeWidth: 2.4 }),
        h('ellipse', { cx: 38, cy: eyeY, rx: 9.5, ry: 9, fill: '#111827' }),
      ])
    case 'goggles':
      return h('g', null, [
        h('path', { d: `M22 ${eyeY - 12}Q50 ${eyeY - 20} 78 ${eyeY - 12}`, fill: 'none', stroke: '#7c2d12', strokeWidth: 5, strokeLinecap: 'round' }),
        h('circle', { cx: 38, cy: eyeY - 12, r: 8, fill: 'rgba(125,211,252,0.55)', stroke: '#374151', strokeWidth: 3 }),
        h('circle', { cx: 62, cy: eyeY - 12, r: 8, fill: 'rgba(125,211,252,0.55)', stroke: '#374151', strokeWidth: 3 }),
      ])
    case 'hero':
      return h('path', {
        d: `M24 ${eyeY - 7}q26-12 52 0v6q-6 12-16 8l-10-4-10 4q-10 4-16-8z M32 ${eyeY}a6.5 6 0 1 0 13 0a6.5 6 0 1 0-13 0z M55 ${eyeY}a6.5 6 0 1 0 13 0a6.5 6 0 1 0-13 0z`,
        fillRule: 'evenodd', fill: '#dc2626', stroke: '#7f1d1d', strokeWidth: 2, strokeLinejoin: 'round',
      })
    case 'ninja':
      return h('g', null, [
        h('path', { d: `M22 ${eyeY - 12}h56v9H22z`, fill: '#dc2626', stroke: '#7f1d1d', strokeWidth: 2, strokeLinejoin: 'round' }),
        h('path', { d: `M76 ${eyeY - 8}l12 4-8 4zM76 ${eyeY - 8}l10-7-2 11z`, fill: '#dc2626', stroke: '#7f1d1d', strokeWidth: 1.6, strokeLinejoin: 'round' }),
        h('circle', { cx: 50, cy: eyeY - 7.5, r: 3, fill: '#fde047' }),
      ])
    case 'headphones':
      return h('g', null, [
        h('path', { d: `M22 ${eyeY - 4}C22 ${top - 10} 78 ${top - 10} 78 ${eyeY - 4}`, fill: 'none', stroke: '#111827', strokeWidth: 5, strokeLinecap: 'round' }),
        h('rect', { x: 15, y: eyeY - 4, width: 10, height: 18, rx: 4, fill: '#ef4444', stroke: '#111827', strokeWidth: 2 }),
        h('rect', { x: 75, y: eyeY - 4, width: 10, height: 18, rx: 4, fill: '#ef4444', stroke: '#111827', strokeWidth: 2 }),
      ])
    case 'bowtie':
      return [
        h('g', { stroke: '#7f1d1d', strokeWidth: 1.5, strokeLinejoin: 'round' }, [
          h('path', { d: `M50 ${neckY}l-12-7v14z`, fill: '#dc2626' }),
          h('path', { d: `M50 ${neckY}l12-7v14z`, fill: '#dc2626' }),
          h('circle', { cx: 50, cy: neckY, r: 3.4, fill: '#b91c1c' }),
        ]),
      ]
    case 'tie':
      return [
        h('g', { stroke: '#1e3a8a', strokeWidth: 1.6, strokeLinejoin: 'round' }, [
          h('path', { d: `M46 ${neckY - 2}h8l-1.6 4h-4.8z`, fill: '#2563eb' }),
          h('path', { d: `M47.2 ${neckY + 2}h5.6l3 12-5.8 4-5.8-4z`, fill: '#3b82f6' }),
        ]),
      ]
    case 'scarf':
      return [
        h('g', { stroke: '#7f1d1d', strokeWidth: 1.8, strokeLinejoin: 'round' }, [
          h('path', { d: `M33 ${neckY - 3}q17 9 34 0v8q-17 9-34 0z`, fill: '#ef4444' }),
          h('path', { d: `M58 ${neckY + 3}l2 14h9l-2-12z`, fill: '#dc2626' }),
          h('path', { d: `M40 ${neckY + 1}v4M50 ${neckY + 3}v4M60 ${neckY + 1}v4`, stroke: '#fecaca', strokeWidth: 1.6 }),
        ]),
      ]
    case 'mustache':
      return h('path', {
        d: `M50 ${eyeY + 13}q-4-5-12-3q-4 1-3 5q8 2 15-2zM50 ${eyeY + 13}q4-5 12-3q4 1 3 5q-8 2-15-2z`,
        fill: '#3f2a1d', stroke: '#1f140c', strokeWidth: 1.2, strokeLinejoin: 'round',
      })
    case 'flower':
      return h('g', { transform: `translate(70 ${top + 2})` }, [
        ...[0, 72, 144, 216, 288].map((deg) => h('ellipse', {
          cx: 0, cy: -6, rx: 3.6, ry: 5.4, transform: `rotate(${deg})`, fill: '#f9a8d4', stroke: '#be185d', strokeWidth: 1.2,
        })),
        h('circle', { r: 3.4, fill: '#fde047', stroke: '#b45309', strokeWidth: 1.2 }),
      ])
    default:
      return null
  }
}

// A little something floating beside the character. A nod to the department: pi, sigma, square root, infinity.
function prop(kind) {
  if (kind === 'none') return null
  const ink = { stroke: '#7c2d12', strokeWidth: 1.4, strokeLinejoin: 'round', strokeLinecap: 'round' }
  const symbol = (glyph) => h('text', {
    x: 11, y: 17, textAnchor: 'middle', fontSize: 20, fontWeight: 700, fill: '#0b2417',
    fontFamily: "Georgia, 'Times New Roman', serif",
  }, glyph)
  let art
  switch (kind) {
    case 'bulb':
      art = [
        h('circle', { cx: 11, cy: 9, r: 7, fill: '#fde047', ...ink }),
        h('rect', { x: 8, y: 15, width: 6, height: 5, rx: 1.5, fill: '#d1d5db', stroke: '#6b7280', strokeWidth: 1.2 }),
        h('path', { d: 'M11 -4v-3M2 0l-2-2M20 0l2-2', stroke: '#f59e0b', strokeWidth: 1.6, strokeLinecap: 'round' }),
      ]
      break
    case 'book':
      art = [
        h('path', { d: 'M1 4q5-2 10 1 5-3 10-1v14q-5-2-10 1-5-3-10-1z', fill: '#60a5fa', stroke: '#1e3a8a', strokeWidth: 1.4, strokeLinejoin: 'round' }),
        h('path', { d: 'M11 5v14', stroke: '#1e3a8a', strokeWidth: 1.4 }),
      ]
      break
    case 'star':
      art = h('path', { d: STAR, transform: 'translate(11 10) scale(1.25)', fill: '#fde047', ...ink })
      break
    case 'heart':
      art = h('path', { d: 'M11 19C2 13 1 6 6 4q4-1 5 3 1-4 5-3c5 2 4 9-5 15z', fill: '#f43f5e', stroke: '#9f1239', strokeWidth: 1.4, strokeLinejoin: 'round' })
      break
    case 'note':
      art = [
        h('path', { d: 'M8 16V3l10-2v13', fill: 'none', stroke: '#6d28d9', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
        h('ellipse', { cx: 6, cy: 16, rx: 3.6, ry: 2.8, fill: '#8b5cf6', stroke: '#4c1d95', strokeWidth: 1.2 }),
        h('ellipse', { cx: 16, cy: 14, rx: 3.6, ry: 2.8, fill: '#8b5cf6', stroke: '#4c1d95', strokeWidth: 1.2 }),
      ]
      break
    case 'pi':
      art = symbol('π')
      break
    case 'sigma':
      art = symbol('Σ')
      break
    case 'sqrt':
      art = symbol('√')
      break
    case 'infinity':
      art = symbol('∞')
      break
    case 'balloon':
      art = [
        h('ellipse', { cx: 11, cy: 8, rx: 7, ry: 8, fill: '#38bdf8', stroke: '#0369a1', strokeWidth: 1.4 }),
        h('path', { d: 'M11 16l-2 3h4z', fill: '#0369a1' }),
        h('path', { d: 'M11 19q-4 4 0 8', fill: 'none', stroke: '#6b7280', strokeWidth: 1.2 }),
      ]
      break
    default:
      art = [
        h('path', { d: 'M5 2h12v7q0 7-6 8-6-1-6-8z', fill: '#fbbf24', stroke: '#b45309', strokeWidth: 1.4, strokeLinejoin: 'round' }),
        h('path', { d: 'M5 4H1q0 7 5 7M17 4h4q0 7-5 7', fill: 'none', stroke: '#b45309', strokeWidth: 1.4 }),
        h('rect', { x: 8, y: 17, width: 6, height: 3, fill: '#b45309' }),
        h('rect', { x: 5, y: 20, width: 12, height: 3, rx: 1, fill: '#92400e' }),
      ]
  }
  return h('g', { transform: 'translate(78 10)' }, h('g', { class: 'qz-prop' }, art))
}

function arms(shape, color) {
  const [dx, y] = shape.arm
  const stroke = (x1, x2, which) => h('g', {
    class: `qz-arm qz-arm-${which}`,
    style: `transform-origin:${x1}px ${y}px`,
  }, [
    h('line', { x1, y1: y, x2, y2: y + 12, stroke: color.dark, strokeWidth: 9, strokeLinecap: 'round' }),
    h('line', { x1, y1: y, x2, y2: y + 12, stroke: color.main, strokeWidth: 5.5, strokeLinecap: 'round' }),
  ])
  return [stroke(50 - dx, 50 - dx - 12, 'l'), stroke(50 + dx, 50 + dx + 12, 'r')]
}

// Everything inside the <svg>, so Character.jsx can own the root element and its animation classes itself.
export function characterSvgBody(spec, mood = 'idle') {
  const shape = BODY[spec.body] ?? BODY.blob
  return toSvg([
    h('ellipse', { cx: 50, cy: 90, rx: 24, ry: 4, fill: '#000', opacity: '0.12' }),
    prop(spec.prop),
    h('g', { class: 'qz-body' }, [
      topper(spec.topper, shape, spec.color),
      body(spec.body, spec.color),
      arms(shape, spec.color),
      face(mood, spec.eyes, spec.mouth, shape.eyeY, spec.color),
      accessory(spec.accessory, shape.top, shape.eyeY, shape.neckY),
    ]),
  ])
}

// The whole character, animation classes and all. The card uses this; the browser builds the same thing by putting the
// root svg in JSX and injecting characterSvgBody into it.
//
// The root carries no role or aria-label: labelling belongs to whoever renders it, and Character.jsx already owns that.
// A function of spec.name would put aria-label on all 50 and break parity with the committed markup, which was
// generated with no title.
export function characterSvgMarkup(spec, mood = 'happy') {
  const classes = [
    'qz-char', `qz-mood-${mood}`, `qz-i-${spec.idle}`, `qz-w-${spec.win}`, `qz-s-${spec.sad}`, `qz-h-${spec.hello}`,
  ].join(' ')
  return toSvg(h('svg', { class: classes, viewBox: '0 0 100 100' }, characterSvgBody(spec, mood)))
}