// Sound for the live quiz. Everything is made in the browser with the Web Audio API (tones and noise bursts for
// effects, a small generated loop for music), so there are no audio files to license, host or download. Browsers only
// allow sound after the person has clicked or tapped once, so nothing plays until unlock() has been called from such a
// click. If audio is missing or blocked every call quietly does nothing and the game is exactly the same without it.

export const MUSIC_STYLES = ['off', 'chill', 'hype', 'afro', 'disco', 'cinematic']

// How far the music bus is turned down while a question is on screen, and how long a stopped loop takes to fade
// out before its bus is cut.
const MUSIC_DUCK = 0.45
const MUSIC_FADE_MS = 700


// ---- Pure rules: which sound goes with which moment (tested without any audio) ----

// The sound for one second of the countdown: a tick in the last five seconds, faster in the last two.
export function tickSound(secondsLeft) {
  if (!Number.isFinite(secondsLeft) || secondsLeft <= 0 || secondsLeft > 5) return null
  return secondsLeft <= 2 ? 'tickFast' : 'tick'
}

// The sound for the game moving from one step to the next.
export function stateSound(prev, next) {
  if (!prev || prev === next) return null
  return { question: 'start', reveal: 'timeUp', leaderboard: 'whoosh', finished: 'fanfare' }[next] ?? null
}

// After "time's up": a happy sting if most people got it, a sad one if hardly anyone did.
export function revealSting(percentCorrect) {
  return percentCorrect >= 50 ? 'correct' : 'wrong'
}

// A crowd only cheers for a round most people got right. Cheering over a bad round sounds cruel.
export function applauseSound(percentCorrect) {
  return Number.isFinite(percentCorrect) && percentCorrect >= 50 ? 'applause' : null
}

// The leaderboard only shows a handful of rows, so that is the most chimes it can need, one per row that climbed.
export function leaderboardChimes(movedCount, shown = 5) {
  if (!Number.isFinite(movedCount) || movedCount <= 0) return 0
  return Math.min(shown, Math.floor(movedCount))
}

// Whether a sound is on for this game. `sound` is the cleaned `theme.sound`: `effects` is the master switch and `off`
// is the list of individual effects the admin has switched off, by name. No sound config means everything is on,
// which is what DEFAULT_THEME says.
export function effectOn(sound, name) {
  if (!sound || typeof sound !== 'object') return true
  if (sound.effects === false) return false
  return !(Array.isArray(sound.off) && sound.off.includes(name))
}

// The drum roll does not start the instant the reveal does: it gets a beat to build first, and the answer goes up on the
// hit at the end of it.
export const DRUMROLL_START_MS = 300

// How long the reveal screen must hold the answer back, which is the whole of the theatre: the roll, then the sting on
// its hit. The built-in hit is DRUMROLL_HIT_MS in, but an admin's own roll is however long they trimmed it to be, and a
// roll that has been switched off has no hit to wait for at all. This is the one place that is decided, so the answer
// cannot go up before the sound it belongs to, and so it can be checked without a browser.
export function revealHoldMs(sound, customDrumrollMs = 0) {
  if (!effectOn(sound, 'drumroll')) return 0
  const hit = Number.isFinite(customDrumrollMs) && customDrumrollMs > 0 ? Math.round(customDrumrollMs) : DRUMROLL_HIT_MS
  return DRUMROLL_START_MS + hit
}

// ---- Preferences (kept on this device) ----

const STORAGE_KEY = 'nammes-quiz-sound'
const DEFAULT_PREFS = { muted: false, volume: 0.7, unlocked: false }


function loadPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (saved && typeof saved === 'object') {
      return { ...DEFAULT_PREFS, muted: saved.muted === true, volume: Number.isFinite(saved.volume) ? Math.min(1, Math.max(0, saved.volume)) : 0.7 }
    }
  } catch {
    // private mode or no storage: fine, use the defaults
  }
  return { ...DEFAULT_PREFS }
}

function savePrefs(p) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ muted: p.muted, volume: p.volume }))
  } catch {
    // ignore
  }
}

// ---- Effects ----
// A recipe is a list of steps laid end to end. A step is a tone, a burst of filtered noise, or (for applause) a whole
// generated crowd, so drums and claps are written in the same shape as the pitched sounds.

function toneStep(freq, start, dur, type = 'sine', gain = 0.2, extra = {}) {
  return { kind: 'tone', freq, start, dur, type, gain, ...extra }
}

function noiseStep(start, dur, gain, centre, extra = {}) {
  return { kind: 'noise', start, dur, gain, centre, ...extra }
}

// A hand clap: a few very short snaps a few milliseconds apart, then a small tail. One burst on its own is a hiss; the
// quick repeats are what make it read as hands hitting together, and the tail is the room.
function clap(at, gain = 0.09, into = null) {
  for (const [offset, level, dur] of [[0, 1, 0.03], [0.009, 0.85, 0.03], [0.019, 0.7, 0.03], [0.03, 0.5, 0.16]]) {
    noise({ start: at + offset, dur, gain: gain * level, centre: 1500, q: 1.1 }, into)
  }
}

// A kick drum. Laptop and projector speakers cannot play much below 100 Hz, so a kick that only lives down there is
// felt on a good sound system and simply missing everywhere else. This one starts high and falls fast, so the thump
// is in a range a small speaker can reproduce, and a tiny click on the front gives it an edge.
function kick(at, gain = 0.2, into = null) {
  tone({ freq: 190, slideTo: 48, start: at, dur: 0.24, type: 'sine', gain, attack: 0.002 }, into)
  tone({ freq: 1400, slideTo: 200, start: at, dur: 0.025, type: 'triangle', gain: gain * 0.5, attack: 0.001 }, into)
}

// A drum roll: snare hits that come faster and louder, then stop dead on a boom and a crash. The host screen holds the
// answer back until the boom, so the right answer lands on the hit. The numbers below are its shape, kept as names so
// that timing can never drift away from the sound.
const ROLL_COUNT = 28
const ROLL_HIT = 0.85

// How far into `drumroll` the boom lands, so the reveal can be timed to the hit rather than to a guess.
export const DRUMROLL_HIT_MS = Math.round(ROLL_HIT * 1000)

// When each hit of the roll lands, in seconds from the start. The gaps have to get shorter toward the end, because
// that is what a roll is. The first version spaced them with `(i / count) ** 1.7`, which does the opposite: it packs
// the hits together at the start and spreads them out at the end, so the roll slowed down.
export function rollTimes(count, span) {
  return Array.from({ length: count }, (_, i) => span * (1 - (1 - i / count) ** 1.7))
}

// One snare hit: a burst of high noise for the rattle of the wires and a short falling tone for the drum head. The
// head is what makes it a drum rather than a hiss, and it sits at 200 Hz so a small speaker can play it.
function snare(at, gain, dur = 0.14) {
  return [
    noiseStep(at, dur, gain, 1800, { type: 'highpass', q: 0.7 }),
    toneStep(200, at, dur * 0.6, 'triangle', gain * 0.9, { slideTo: 140, attack: 0.002 }),
  ]
}

// Every other hit a little softer, the way two hands alternate.
function roll(count, span, from, to) {
  return rollTimes(count, span).flatMap((at, i) => snare(at, (from + (to - from) * (i / (count - 1))) * (i % 2 ? 0.8 : 1)))
}

// ---- Applause ----
// Applause is a lot of hands, each one a tiny snap. One steady bed of noise sounds like wind, so the crowd is built the
// way it is made: many short claps, each with its own brightness and loudness, scattered at random, thin at the
// start, thickest in the middle and thinning out at the end. It is made fresh on every play, so no two cheers match.
const APPLAUSE_SECONDS = 2.6
const APPLAUSE_GAIN = 0.4
const CLAPS_PER_SECOND = 220

export function applauseSamples(rate, seconds, random = Math.random) {
  const n = Math.max(0, Math.floor(rate * seconds))
  const out = new Float32Array(n)
  // How many hands are going at time t, from 0 to 1: a quick build, a full middle and a long thinning-out.
  const crowd = (t) => Math.max(0.03, Math.min(1, t / (seconds * 0.15), (seconds - t) / (seconds * 0.4)))
  const pole = (hz) => 1 - Math.exp((-2 * Math.PI * hz) / rate)
  const target = Math.round(seconds * CLAPS_PER_SECOND * 0.55)
  for (let placed = 0, tries = 0; placed < target && tries < target * 30; tries += 1) {
    const at = random() * seconds
    if (random() > crowd(at)) continue
    placed += 1
    const first = Math.floor(at * rate)
    const len = Math.floor(rate * (0.012 + random() * 0.03))
    const decay = len / 4
    // Band-passing the noise by taking a dark copy away from a bright one gives each clap its own colour.
    const dark = pole(500 + random() * 900)
    const bright = pole(2400 + random() * 3200)
    const level = 0.25 + random() * 0.75
    let lo = 0
    let hi = 0
    for (let j = 0; j < len && first + j < n; j += 1) {
      const white = random() * 2 - 1
      lo += dark * (white - lo)
      hi += bright * (white - hi)
      // A hair of fade-in on the first samples, so the snap does not start with a click.
      const fade = Math.min(1, j / (rate * 0.0008))
      out[first + j] += (hi - lo) * Math.exp(-j / decay) * level * fade * 3
    }
  }
  // A faint low roar between the snaps, so the gaps are a room full of people and not silence.
  let bed = 0
  const roar = pole(1800)
  for (let i = 0; i < n; i += 1) {
    bed += roar * (random() * 2 - 1 - bed)
    out[i] += bed * crowd(i / rate) * 0.2
  }
  // Set the loudness, then let the loudest peaks bend instead of clip.
  let sum = 0
  for (let i = 0; i < n; i += 1) sum += out[i] * out[i]
  const rms = Math.sqrt(sum / Math.max(1, n))
  const scale = rms > 0 ? 0.2 / rms : 0
  for (let i = 0; i < n; i += 1) out[i] = Math.tanh(out[i] * scale)
  return out
}

const EFFECTS = {
  tick: [toneStep(880, 0, 0.06, 'square', 0.1)],
  tickFast: [toneStep(1320, 0, 0.05, 'square', 0.14)],
  timeUp: [toneStep(240, 0, 0.55, 'sawtooth', 0.2, { slideTo: 110 })],
  correct: [523, 659, 784, 1047].map((freq, i) => toneStep(freq, i * 0.09, 0.16, 'triangle', 0.22)),
  wrong: [toneStep(196, 0, 0.22, 'sawtooth', 0.18), toneStep(147, 0.2, 0.38, 'sawtooth', 0.18)],
  lock: [toneStep(660, 0, 0.08, 'sine', 0.2), toneStep(990, 0.07, 0.12, 'sine', 0.2)],
  start: [392, 523, 659].map((freq, i) => toneStep(freq, i * 0.07, 0.12, 'square', 0.1)),
  whoosh: [toneStep(300, 0, 0.35, 'sine', 0.16, { slideTo: 1400 })],
  fanfare: [
    [523, 0], [523, 0.14], [523, 0.28], [659, 0.46], [784, 0.7], [659, 0.9], [784, 1.1], [1047, 1.4],
  ].map(([freq, start]) => toneStep(freq, start, start === 1.4 ? 0.9 : 0.16, 'triangle', 0.24)),
  drumroll: [
    ...roll(ROLL_COUNT, ROLL_HIT - 0.05, 0.05, 0.17),
    // The hit: a boom that starts high enough for a laptop speaker to play, a crack, and a crash that rings out.
    toneStep(150, ROLL_HIT, 0.6, 'sine', 0.4, { slideTo: 42, attack: 0.003 }),
    ...snare(ROLL_HIT, 0.2, 0.25),
    noiseStep(ROLL_HIT, 1.1, 0.2, 4000, { type: 'highpass', q: 0.5, attack: 0.003 }),
  ],
  applause: [{ kind: 'crowd', start: 0, dur: APPLAUSE_SECONDS, gain: APPLAUSE_GAIN }],
  join: [toneStep(880, 0, 0.1, 'sine', 0.15), toneStep(1318.5, 0.09, 0.22, 'sine', 0.13)],
  points: [toneStep(1046.5, 0, 0.06, 'triangle', 0.15), toneStep(1568, 0.05, 0.19, 'triangle', 0.12)],
}

// Every effect, with the moment it belongs to. The studio sound lab lists these groups, so a new effect can never
// be added without somewhere to hear it.
export const EFFECT_GROUPS = [
  { group: 'Countdown', items: [['tick', 'Tick, last 5 seconds'], ['tickFast', 'Fast tick, last 2 seconds'], ['timeUp', "Time's up horn"]] },
  { group: 'Questions', items: [['start', 'Question starts'], ['lock', 'Answer locked in']] },
  { group: 'Lobby', items: [['join', 'A player joined']] },
  { group: 'Reveal', items: [['drumroll', 'Drum roll'], ['correct', 'Right answer'], ['wrong', 'Wrong answer'], ['applause', 'Crowd applause']] },
  { group: 'Leaderboard', items: [['whoosh', 'Board whoosh'], ['points', 'Points chime']] },
  { group: 'Ending', items: [['fanfare', 'Fanfare']] },
]

// ---- Music: a small generated loop per style ----
// A style is a repeating grid of steps. `lead` and `bass` are the two melodic layers, `pads` lays a chord at the top
// of each bar and `drums` puts kick, hat, clap and cymbal on the grid. Anything left out is silence, so the two
// original styles (chill, hype) set only lead and bass and play exactly as they always have.
//
// A lead pattern of -1 is a rest, which is how a line gets space in it.

const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25]
const BASS_NOTES = [65.41, 65.41, 98.0, 87.31]
// Each loop gets the pentatonic that fits the chords underneath it rather than sharing one: a C minor pentatonic
// over Am F G Em fights the E and B naturals in those chords, and the same goes for the cinematic loop over
// Dm Cm Bbm Am. Sharing a single scale is what makes generated loops sound wrong.
const PENTA_A_MINOR = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33]
const PENTA_MAJOR = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25]
const PENTA_D_MINOR = [293.66, 349.23, 392.0, 440.0, 523.25, 587.33, 698.46, 783.99]
// Chord roots, one bar each: Am F G Em for afrobeat, Am F C G for disco, Dm Cm Bbm Am for the cinematic one. The
// bass stays on the root for the same bar, so the two always agree on what the chord is.
const AFRO_ROOTS = [110.0, 87.31, 98.0, 82.41]
const DISCO_BASS = [220.0, 174.61, 261.63, 196.0]
const DISCO_ROOTS = [110.0, 87.31, 130.81, 98.0]
// The cinematic one keeps its sub bass an octave below the chords, or the whole thing turns to mud.
const EPIC_SUB = [73.42, 65.41, 58.27, 55.0]
const EPIC_ROOTS = [146.83, 130.81, 116.54, 110.0]
// Chord shapes in semitones above the root. The minor seventh is what keeps the pads from sounding like a test tone.
const MINOR_SEVENTH = [0, 3, 7, 10]
const MAJOR_SEVENTH = [0, 4, 7, 9]

const STYLES = {
  chill: { bpm: 84, wave: 'triangle', gain: 0.05, bass: 'sine', bassGain: 0.08, pattern: [0, 2, 4, 2, 3, 1, 4, 2] },
  hype: { bpm: 126, wave: 'sawtooth', gain: 0.035, bass: 'square', bassGain: 0.05, pattern: [0, 3, 5, 3, 2, 4, 5, 4] },

  // Afrobeat: a syncopated guitar line over a bass that slides into the next chord a bar later, hats on the offbeats
  // and claps on the backbeat. Warm and busy, the one people tap along to.
  afro: {
    bpm: 104,
    steps: 16,
    scale: PENTA_A_MINOR,
    lead: { wave: 'triangle', gain: 0.055, durMul: 1.7, pattern: [3, -1, 4, -1, 2, 5, -1, 4, 3, -1, 6, 5, 4, -1, 2, -1] },
    bass: { wave: 'sine', gain: 0.085, durMul: 2.8, roots: AFRO_ROOTS, slide: true },
    drums: { kick: [0, 3, 6, 10], hat: [2, 6, 10, 14], clap: [4, 12] },
  },

  // Disco: a kick on every beat, a bright octave bass pulsing on the chord under it, and a shimmer pad behind both.
  disco: {
    bpm: 118,
    steps: 16,
    scale: PENTA_MAJOR,
    lead: { wave: 'square', gain: 0.03, durMul: 1.1, pattern: [4, -1, 7, 6, 4, -1, 2, -1, 5, -1, 7, -1, 6, 4, -1, -1] },
    bass: { wave: 'sawtooth', gain: 0.06, durMul: 2.2, bassEvery: 2, roots: DISCO_BASS, lowpass: 900 },
    pads: { wave: 'triangle', gain: 0.03, intervals: MAJOR_SEVENTH, roots: DISCO_ROOTS, attack: 0.08, barMul: 0.95 },
    drums: { kick: [0, 4, 8, 12], hat: [2, 6, 10, 14], clap: [4, 12] },
  },

  // Cinematic: slow chords swelling under a sparse melody, one boom and a cymbal wash a bar. Made to sit under
  // people talking, which is what a lobby full of arrivals needs.
  cinematic: {
    bpm: 72,
    steps: 16,
    scale: PENTA_D_MINOR,
    lead: { wave: 'triangle', gain: 0.04, durMul: 2.6, pattern: [0, -1, -1, -1, 3, -1, -1, -1, 2, -1, -1, -1, 4, -1, -1, -1] },
    bass: { wave: 'sine', gain: 0.11, durMul: 14, bassEvery: 16, roots: EPIC_SUB },
    pads: { wave: 'sawtooth', gain: 0.03, intervals: MINOR_SEVENTH, roots: EPIC_ROOTS, attack: 0.7, barMul: 1.25, detune: 9, lowpass: 1500 },
    drums: { kick: [0], cymbal: [0] },
  },
}

// What a style actually plays, resolved into one shape however the style was written. Exported and pure so it can
// be checked without an AudioContext, which is the only way to catch a layer that silently resolves to the wrong
// values. The original two styles describe lead and bass with flat keys (chill's bass is the string 'sine'), so
// those have to be lifted into objects before anything can read a field off them.
export function layersFor(style) {
  if (!style || typeof style !== 'object') return null
  const bass = typeof style.bass === 'object' && style.bass !== null ? style.bass : { wave: style.bass, gain: style.bassGain }
  const lead = style.lead ?? { wave: style.wave, gain: style.gain, pattern: style.pattern }
  const steps = style.steps ?? lead.pattern.length
  // How many steps pass between bass hits. The original styles hit every four, as always.
  const every = bass.bassEvery ?? 4
  return {
    lead,
    bass,
    scale: style.scale ?? PENTATONIC,
    roots: bass.roots ?? BASS_NOTES,
    every,
    // How many steps the bass stays on one root, which is not the same as how often it is hit. The original styles
    // move to the next root on every hit, as they always have. A style that declares a grid holds one root for the
    // whole bar, because its pads change chord once a bar and a bass that moved faster played notes outside them.
    rootEvery: style.steps ? steps : every,
    steps,
    // A style that declares a `steps` grid writes those steps as sixteenths, so sixteen of them is one bar. The
    // original two declare no `steps` and play eighths, which is what the flat `60 / bpm / 2` has always meant.
    stepDur: 60 / style.bpm / (style.steps ? 4 : 2),
  }
}

// Which bass root is playing at this step. The scheduler and the tests both read it, so the bass can be checked
// against the chord the pads are holding without needing an AudioContext.
export function rootIndexAt(layers, beatIndex) {
  return Math.floor(beatIndex / layers.rootEvery) % layers.roots.length
}

// Whether the engine can actually play a music style or an effect. The studio lists what it offers and the server
// accepts what a quiz saved, so both are checked against these to stop the two lists drifting apart.
export function hasMusicStyle(style) {
  return Object.hasOwn(STYLES, style)
}

// The raw definition behind a style name, or null. Exported so a test can check that a style resolves to what it was
// written to say, which is the only way to catch a loop that plays at the wrong tempo or the wrong volume.
export function styleFor(name) {
  return Object.hasOwn(STYLES, name) ? STYLES[name] : null
}

export function hasEffect(name) {
  return Object.hasOwn(EFFECTS, name)
}

let ctx = null
let master = null
let musicGain = null
let prefs = loadPrefs()
let snapshot = { ...prefs }
const listeners = new Set()
let musicTimer = null
let musicStyle = null
let musicQuiet = false
let nextBeat = 0
let beatIndex = 0
// The admin's own track, when there is one. It is streamed from a blob address rather than decoded, because a three
// minute track decoded into memory is about sixty megabytes, and it is connected to the same bus as a generated loop so
// that the duck during a question, the volume, the mute and the fade all behave exactly as they already do.
let musicElement = null

// What this screen is allowed to play, set once from the cleaned `theme.sound`: which effects the admin switched off,
// and which of their own clips stand in for a built-in one. A phone sets only the master switch and the off list, so it
// never reads the music choice or an imported clip.
let soundCfg = { effects: true, off: [], custom: { music: null, effects: {} } }

function publish() {
  snapshot = { ...prefs }
  listeners.forEach((l) => l())
}

function audioContext() {
  if (ctx) return ctx
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  try {
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = prefs.muted ? 0 : prefs.volume
    master.connect(ctx.destination)
  } catch {
    ctx = null
  }
  return ctx
}

// Every run of a loop gets its own bus, and stopping fades that bus out and then cuts it. Sharing one bus and ducking
// it is not enough: notes already handed to the audio clock keep ringing for seconds afterwards (a cinematic pad is
// over four), and ramping a shared bus back up brings the previous loop's tail in under the new one.
function newMusicBus(quiet) {
  const previous = musicGain
  const bus = ctx.createGain()
  bus.gain.value = 0
  bus.connect(master)
  musicGain = bus
  bus.gain.setTargetAtTime(quiet ? MUSIC_DUCK : 1, ctx.currentTime, 0.2)
  if (previous) {
    previous.gain.cancelScheduledValues(ctx.currentTime)
    previous.gain.setTargetAtTime(0, ctx.currentTime, 0.1)
    setTimeout(() => {
      try {
        previous.disconnect()
      } catch {
        // the context may already be closed, which is fine
      }
    }, MUSIC_FADE_MS)
  }
  return bus
}

function fadeOutMusicBus() {
  const bus = musicGain
  musicGain = null
  if (!bus || !ctx) return
  bus.gain.cancelScheduledValues(ctx.currentTime)
  bus.gain.setTargetAtTime(0, ctx.currentTime, 0.1)
  setTimeout(() => {
    try {
      bus.disconnect()
    } catch {
      // the context may already be closed, which is fine
    }
  }, MUSIC_FADE_MS)
}

function tone({ freq, start = 0, dur = 0.15, type = 'sine', gain = 0.2, slideTo = null, attack = null, detune = 0, lowpass = 0 }, into) {
  const c = ctx
  const t0 = c.currentTime + Math.max(0, start)
  const osc = c.createOscillator()
  const amp = c.createGain()
  osc.type = type
  osc.detune.setValueAtTime(detune, t0)
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  amp.gain.setValueAtTime(0.0001, t0)
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + envelope(dur, attack))
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  // A sawtooth played on its own is harsh. Bass notes and chords pass a lowpass to take the fizz off, which is the
  // difference between a warm pad and a buzz.
  if (lowpass) {
    const filter = c.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(lowpass, t0)
    osc.connect(filter)
    filter.connect(amp)
  } else {
    osc.connect(amp)
  }
  amp.connect(into ?? master)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

// One second of white noise, made once and shared by every burst. Hats, claps, cymbals, drum rolls and the crowd
// all read from the same buffer, so this is the only place any of them costs anything.
let noiseBuf = null

function noiseBuffer() {
  if (noiseBuf || !ctx) return noiseBuf
  try {
    const frames = Math.floor(ctx.sampleRate)
    noiseBuf = ctx.createBuffer(1, frames, ctx.sampleRate)
    const data = noiseBuf.getChannelData(0)
    for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1
  } catch {
    noiseBuf = null
  }
  return noiseBuf
}

// How long a note or burst takes to reach full level. The default is near-instant, which is right for a tick; a pad
// passes a long attack so it swells instead of appearing.
function envelope(dur, attack) {
  const a = Math.max(0.001, attack ?? Math.min(0.02, dur / 3))
  return Math.min(a, dur * 0.9)
}

// A burst of filtered noise, which is what drums and crowds are made of. `centre` is the frequency it is tuned to
// and `q` how sharp that is: a hat is a high narrow one, a crowd is a low wide one. `spread` and `gainSpread`
// scatter the burst a little each time, so a long cheer never sounds like the same second on a loop.
function noise({ start = 0, dur = 0.15, gain = 0.1, centre = 1000, q = 1, type = 'bandpass', attack = null, spread = 0, gainSpread = 0 }, into) {
  const buf = noiseBuffer()
  if (!buf) return
  if (spread) start += (Math.random() * 2 - 1) * spread
  if (gainSpread) gain *= 1 + (Math.random() * 2 - 1) * gainSpread
  const c = ctx
  const t0 = c.currentTime + Math.max(0, start)
  const src = c.createBufferSource()
  const filter = c.createBiquadFilter()
  const amp = c.createGain()
  src.buffer = buf
  src.loop = true
  filter.type = type
  filter.frequency.setValueAtTime(centre, t0)
  filter.Q.setValueAtTime(q, t0)
  amp.gain.setValueAtTime(0.0001, t0)
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + envelope(dur, attack ?? 0.002))
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(filter)
  filter.connect(amp)
  amp.connect(into ?? master)
  // Looping raw noise can land on a repeating grain, so each burst starts from a different point in the buffer.
  src.start(t0, Math.random() * (buf.duration - 0.05))
  src.stop(t0 + dur + 0.05)
}

// The applause step: build a fresh crowd, a separate one in each ear so the room has width, and play it.
function crowd({ start = 0, dur = APPLAUSE_SECONDS, gain = APPLAUSE_GAIN }, into) {
  const c = ctx
  const buf = c.createBuffer(2, Math.floor(c.sampleRate * dur), c.sampleRate)
  for (let channel = 0; channel < 2; channel += 1) buf.getChannelData(channel).set(applauseSamples(c.sampleRate, dur))
  const src = c.createBufferSource()
  const amp = c.createGain()
  const t0 = c.currentTime + Math.max(0, start)
  src.buffer = buf
  amp.gain.setValueAtTime(gain, t0)
  src.connect(amp)
  amp.connect(into ?? master)
  src.start(t0)
}

// ---- Imported clips ----
// An admin's own effects, decoded once into audio this engine can play like a built-in one. The decode happens when the
// host screen loads its theme rather than at the moment of a reveal, so a reveal is never late waiting for a file, and a
// clip that cannot be decoded is left out so the built-in sound stands in instead.
const customEffects = new Map()
const customEffectLengths = new Map()
let loadGeneration = 0

// An import can be a whisper or a recording of the whole hall, and the built-in sounds are all written at a known modest
// level, so the loudest sample in the clip decides how loud it plays: without this, one imported effect could be several
// times louder than everything else on the projector with nothing the host could do about it.
const IMPORTED_PEAK = 0.25
// The first version capped the gain at 1, so it could only ever turn a clip down, and only one that peaked above its
// target: everything quieter than that played exactly as recorded. A quiet recording is brought up to the target here,
// but only so far, so a clip that is mostly hiss is not turned into a wall of it.
const MAX_BOOST = 4

export function importedGain(buffer) {
  let peak = 0
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < data.length; i += 1) {
      const level = Math.abs(data[i])
      if (level > peak) peak = level
    }
  }
  return peak > 0 ? Math.min(MAX_BOOST, IMPORTED_PEAK / peak) : 1
}

function playBuffer({ data, gain = 1, start = 0 }) {
  const c = ctx
  const src = c.createBufferSource()
  const amp = c.createGain()
  const t0 = c.currentTime + Math.max(0, start)
  src.buffer = data
  amp.gain.setValueAtTime(gain, t0)
  src.connect(amp)
  amp.connect(master)
  src.start(t0)
}

// Read every clip the theme names, once. `load` is handed a clip id and answers with the record or null, which is how a
// clip this device never imported simply comes back empty: the built-in sound is then used, and nothing is said about it
// on the projector. A quiz never fails because a browser lost some files.
async function loadCustomEffects(ids, load) {
  loadGeneration += 1
  const mine = loadGeneration
  customEffects.clear()
  customEffectLengths.clear()
  const c = audioContext()
  if (!c || !ids || typeof ids !== 'object' || typeof load !== 'function') return
  const wanted = Object.entries(ids).filter(([name, id]) => hasEffect(name) && typeof id === 'string' && id)
  await Promise.all(wanted.map(async ([name, id]) => {
    try {
      const record = await load(id)
      const blob = record?.blob
      if (!blob) return
      const bytes = await blob.arrayBuffer()
      const decoded = await c.decodeAudioData(bytes)
      if (mine !== loadGeneration || !decoded?.duration) return
      customEffects.set(name, { buffer: decoded, gain: importedGain(decoded) })
      // The reveal is timed off the drum roll's own length, so an imported roll has to say how long it is.
      customEffectLengths.set(name, Math.round(decoded.duration * 1000))
    } catch {
      // a clip that will not decode is skipped, and the built-in sound plays instead
    }
  }))
  // The drum roll's length is only known once it has been decoded, and the reveal times its hold off that, so whoever
  // is listening has to be told the engine changed even though the preferences themselves have not.
  if (mine === loadGeneration) publish()
}

function clearCustomEffects() {
  loadGeneration += 1
  customEffects.clear()
  customEffectLengths.clear()
}

// The admin's own track, on the same bus as a generated loop, so ducking it for a question, turning it down, muting it
// and fading it out all reach it by exactly the path they always have.
//
// Two things a generated loop does not need. First, level: a mastered track peaks near 1.0 and a generated loop near
// 0.15, so left alone an imported track sits about 20 dB above everything else on the bus and buries the ticks. Second,
// place: music stops for every reveal and leaderboard, and a track that restarted from its first second each time
// would only ever play its intro, so the element is kept and simply resumes where it left off.
const CUSTOM_MUSIC_GAIN = 0.25
let customTrack = null

function startCustomMusic(bus, address) {
  stopCustomMusic()
  if (typeof Audio === 'undefined') return
  try {
    if (!customTrack || customTrack.address !== address) {
      dropCustomTrack()
      const audio = new Audio()
      audio.src = address
      // A lobby with music stops and starts across a whole evening, so the track runs on rather than playing out.
      audio.loop = true
      audio.preload = 'auto'
      // Routing the element through Web Audio is what puts it under the music bus. A source can be made for an element
      // only once, which is why the pair is kept together and dropped together.
      const source = ctx.createMediaElementSource(audio)
      const trim = ctx.createGain()
      trim.gain.value = CUSTOM_MUSIC_GAIN
      source.connect(trim)
      customTrack = { address, audio, source, trim }
    }
    customTrack.trim.connect(bus)
    // A browser that refuses to stream the blob simply plays nothing rather than throwing at the host.
    customTrack.audio.play().catch(() => {})
    musicElement = customTrack.audio
  } catch {
    dropCustomTrack()
    musicElement = null
  }
}

// Pause, and keep the place.
function stopCustomMusic() {
  if (customTrack && musicElement) {
    try {
      customTrack.audio.pause()
      customTrack.trim.disconnect()
    } catch {
      // an element or a node that will not stop is already stopped
    }
  }
  musicElement = null
}

// Let go of the track for good: the host screen or the studio is going away.
function dropCustomTrack() {
  if (!customTrack) return
  try {
    customTrack.audio.pause()
    customTrack.trim.disconnect()
    customTrack.source.disconnect()
  } catch {
    // already gone
  }
  customTrack = null
  musicElement = null
}

function scheduleMusic() {
  const style = STYLES[musicStyle]
  const layers = layersFor(style)
  if (!layers || !ctx) return
  const { lead, bass, scale, roots, every, steps, stepDur } = layers
  while (nextBeat < ctx.currentTime + 0.35) {
    const step = beatIndex % steps
    const start = Math.max(0, nextBeat - ctx.currentTime)
    const note = lead.pattern[step]
    if (note >= 0) {
      tone({ freq: scale[note % scale.length], start, dur: stepDur * (lead.durMul ?? 1.6), type: lead.wave, gain: lead.gain }, musicGain)
    }
    if (step % every === 0) {
      const root = roots[rootIndexAt(layers, beatIndex)]
      const next = roots[rootIndexAt(layers, beatIndex + every)]
      tone({
        freq: root,
        start,
        dur: stepDur * (bass.durMul ?? 3.4),
        type: bass.wave,
        gain: bass.gain,
        lowpass: bass.lowpass ?? 0,
        // A sliding bass is what tells the ear the chord moved, so it only slides into the note before a change.
        slideTo: bass.slide && next !== root ? next * 2 : null,
      }, musicGain)
    }
    if (style.pads && step === 0) {
      const root = style.pads.roots[Math.floor(beatIndex / steps) % style.pads.roots.length]
      const dur = stepDur * steps * (style.pads.barMul ?? 1.1)
      const attack = style.pads.attack ?? 0.4
      const lowpass = style.pads.lowpass ?? 0
      for (const semis of style.pads.intervals) {
        const freq = root * 2 ** (semis / 12)
        tone({ freq, start, dur, type: style.pads.wave, gain: style.pads.gain, attack, lowpass }, musicGain)
        // A second voice a few cents sharp makes a chord breathe instead of sounding like one flat synth tone.
        tone({ freq, start, dur, type: style.pads.wave, gain: style.pads.gain * 0.7, attack, detune: style.pads.detune ?? 7, lowpass }, musicGain)
      }
    }
    if (style.drums) {
      const d = style.drums
      if (d.kick?.includes(step)) kick(start, d.kickGain ?? 0.2, musicGain)
      if (d.hat?.includes(step)) noise({ start, dur: 0.05, gain: d.hatGain ?? 0.045, centre: 7000, type: 'highpass', q: 0.7 }, musicGain)
      if (d.clap?.includes(step)) clap(start, d.clapGain ?? 0.08, musicGain)
      if (d.cymbal?.includes(step)) noise({ start, dur: d.cymbalDur ?? 1.1, gain: d.cymbalGain ?? 0.05, centre: 5000, type: 'highpass', q: 0.5, attack: 0.003 }, musicGain)
    }
    nextBeat += stepDur
    beatIndex += 1
  }
}

export const quizSound = {
  isSupported() {
    return typeof window !== 'undefined' && Boolean(window.AudioContext || window.webkitAudioContext)
  },

  hasMusicStyle(style) {
    return hasMusicStyle(style)
  },

  hasEffect(name) {
    return hasEffect(name)
  },

  // The cleaned `theme.sound` for the screen being played. Called once when the screen loads its theme, so every
  // effect asked for afterwards knows whether this quiz wants it at all.
  setSoundConfig(sound) {
    soundCfg = {
      effects: sound?.effects !== false,
      off: Array.isArray(sound?.off) ? sound.off : [],
      custom: sound?.custom && typeof sound.custom === 'object' ? sound.custom : { music: null, effects: {} },
    }
  },

  // Call from a click or tap. Until then the browser keeps audio switched off.
  unlock() {
    const c = audioContext()
    if (!c) return false
    if (c.state === 'suspended') c.resume().catch(() => {})
    if (!prefs.unlocked) {
      prefs = { ...prefs, unlocked: true }
      publish()
    }
    return true
  },

  play(name) {
    this.soundEffect(name)
  },

  // The studio sound lab: the same effect, but auditioning it must ignore this quiz's own switches. A Play button that
  // did nothing next to the switch that turned it off would look broken, and there is no other way to hear what you
  // just turned off.
  previewEffect(name) {
    this.soundEffect(name, { ignoringSwitches: true })
  },

  soundEffect(name, { ignoringSwitches = false } = {}) {
    if (!prefs.unlocked || prefs.muted || !ctx || !hasEffect(name)) return
    if (!ignoringSwitches && !effectOn(soundCfg, name)) return
    try {
      // The admin's own clip for this sound, if it decoded and is still on this device. Otherwise the built-in.
      const clip = customEffects.get(name)
      if (clip) {
        playBuffer(clip)
        return
      }
      // Each helper reads only the fields it cares about, so a step can go straight in whichever kind it is.
      for (const step of EFFECTS[name]) {
        if (step.kind === 'noise') noise(step)
        else if (step.kind === 'crowd') crowd(step)
        else tone(step)
      }
    } catch {
      // a blocked or closed audio context must never break the game
    }
  },

  // How long an imported clip for this sound runs for, in milliseconds, or 0 when the built-in one is in use. The reveal
  // asks for this so it can wait for the drum roll that will really play.
  customEffectMs(name) {
    return customEffectLengths.get(name) ?? 0
  },

  loadCustomEffects,
  clearCustomEffects,
  releaseCustomMusic: dropCustomTrack,

  // Start a loop. 'custom' is the one style the engine cannot generate: it plays the admin's own track from the address
  // it was given, which the caller resolved from the local library, because getting at the file is the store's job and
  // not the engine's. Without that address there is nothing to play, so nothing starts and the quiz is simply quiet.
  startMusic(style, { quiet = false, address = null } = {}) {
    const custom = style === 'custom'
    if (!prefs.unlocked || !ctx) return
    if (!custom && !hasMusicStyle(style)) return
    if (custom && !address) return
    musicQuiet = quiet
    // Already on this loop: the call is only ducking it for a question, so the run and its bus are left alone.
    if (musicStyle === style && this.isMusicPlaying() && (!custom || musicElement?.src === address)) {
      if (musicGain) musicGain.gain.setTargetAtTime(quiet ? MUSIC_DUCK : 1, ctx.currentTime, 0.3)
      return
    }
    this.stopMusic()
    musicStyle = style
    const bus = newMusicBus(quiet)
    if (custom) {
      startCustomMusic(bus, address)
      return
    }
    nextBeat = ctx.currentTime + 0.05
    beatIndex = 0
    scheduleMusic()
    musicTimer = setInterval(scheduleMusic, 120)
  },

  // The studio audition buttons use this to swap one loop for another without the tail of the last one ringing out.
  previewMusic(style, options = {}) {
    this.stopMusic()
    this.startMusic(style, options)
  },

  stopMusic() {
    if (musicTimer) clearInterval(musicTimer)
    musicTimer = null
    stopCustomMusic()
    musicStyle = null
    fadeOutMusicBus()
  },

  isMusicPlaying() {
    return Boolean(musicTimer || musicElement)
  },

  isMusicQuiet() {
    return musicQuiet
  },

  setMuted(muted) {
    prefs = { ...prefs, muted: Boolean(muted) }
    if (master) master.gain.setTargetAtTime(prefs.muted ? 0 : prefs.volume, ctx.currentTime, 0.05)
    savePrefs(prefs)
    publish()
  },

  setVolume(volume) {
    const v = Math.min(1, Math.max(0, Number(volume) || 0))
    prefs = { ...prefs, volume: v }
    if (master && !prefs.muted) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05)
    savePrefs(prefs)
    publish()
  },

  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  getSnapshot() {
    return snapshot
  },
}

// A short phone buzz for right and wrong answers, where the browser allows it.
export function buzz(pattern) {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern)
  } catch {
    // ignore
  }
}
