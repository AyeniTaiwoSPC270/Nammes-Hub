// @ts-nocheck
// The 50 quiz characters. Each one is its own design: a name, a body, a headpiece, a face, something to wear,
// maybe a floating maths symbol or prop, a colour, and its own set of moves (how it idles, how it celebrates,
// how it says hello). Nothing here is shared between two characters: src/data/quizCharacters.test.js checks that.
// Drawn in code by src/components/quiz/Character.jsx; moves are CSS animations in characters.css.

export const BODIES = ['blob', 'box', 'round', 'bean', 'ghost', 'onigiri', 'cloud', 'drop', 'loaf', 'hexagon', 'pear', 'jelly', 'diamond']
export const TOPPERS = ['none', 'cat', 'bunny', 'bear', 'horns', 'antenna', 'bugs', 'sprout', 'spikes', 'floppy', 'halo', 'tuft']
export const EYES = ['round', 'dot', 'sleepy', 'wide', 'wink', 'star', 'slit', 'lash', 'cyclops', 'spiral']
export const MOUTHS = ['smile', 'grin', 'cat', 'o', 'smirk', 'tongue', 'fang', 'flat']
export const ACCESSORIES = [
  'none', 'sunglasses', 'glasses', 'headphones', 'bowtie', 'tie', 'scarf', 'monocle', 'eyepatch', 'ninja',
  'hero', 'flower', 'crown', 'gradcap', 'partyhat', 'goggles', 'mustache', 'cap', 'chef', 'beanie',
]
export const PROPS = ['none', 'bulb', 'book', 'star', 'heart', 'note', 'pi', 'sigma', 'sqrt', 'infinity', 'balloon', 'trophy']

// How a character moves while waiting, when it is right (or on the podium), and how it greets you.
export const IDLE_MOVES = ['bob', 'sway', 'breathe', 'hover', 'nervous', 'hop', 'tilt', 'pulse', 'doze', 'glitch', 'wobble']
export const WIN_MOVES = ['jump', 'spin', 'flip', 'shimmy', 'pogo', 'headbang', 'stretch', 'zoom', 'moonwalk', 'tada']
export const SAD_MOVES = ['droop', 'shake', 'sink', 'tremble']
export const HELLO_MOVES = ['wave', 'salute', 'flex', 'cheer', 'point', 'hips', 'clap', 'shrug']

const IDLE_LABELS = ['Bobs gently', 'Sways side to side', 'Breathes deeply', 'Hovers', 'Shivers nervously', 'Hops on the spot', 'Tilts its head', 'Pulses', 'Dozes off', 'Glitches', 'Wobbles']
const WIN_LABELS = ['Jumps for joy', 'Spins', 'Backflips', 'Shimmies', 'Pogo-hops', 'Headbangs', 'Stretches', 'Zooms', 'Moonwalks', 'Does a ta-da']
const HELLO_LABELS = ['Waves', 'Salutes', 'Flexes', 'Cheers', 'Points', 'Strikes a pose', 'Claps', 'Shrugs']

// name, body, topper, eyes, mouth, accessory, prop. Hats only go on bodies with no tall headpiece.
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

export const AVATAR_COUNT = ROSTER.length

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

// The golden angle spreads the hues evenly, and cycling through five tones keeps neighbours from looking alike.
function colourFor(id) {
  if (SPECIAL_COLOURS[id]) return SPECIAL_COLOURS[id]
  const hue = (id * 137.508) % 360
  const tone = TONES[id % TONES.length]
  return { main: hsl(hue, tone.s, tone.l), dark: hsl(hue, tone.s, 28), light: hsl(hue, tone.s - 12, 90) }
}

export function normalizeAvatarId(id) {
  return Number.isInteger(id) && id >= 0 && id < AVATAR_COUNT ? id : 0
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
    color: colourFor(n),
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
  return Math.floor(Math.random() * AVATAR_COUNT)
}
