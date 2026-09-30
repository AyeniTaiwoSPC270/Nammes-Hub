// Sound for the live quiz. Everything is made in the browser with the Web Audio API (short tones for effects, a small
// generated loop for music), so there are no audio files to license, host or download. Browsers only allow sound
// after the person has clicked or tapped once, so nothing plays until unlock() has been called from such a click.
// If audio is missing or blocked every call quietly does nothing and the game is exactly the same without it.

export const MUSIC_STYLES = ['off', 'chill', 'hype']

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

const EFFECTS = {
  tick: [{ freq: 880, dur: 0.06, type: 'square', gain: 0.1 }],
  tickFast: [{ freq: 1320, dur: 0.05, type: 'square', gain: 0.14 }],
  timeUp: [{ freq: 240, dur: 0.55, type: 'sawtooth', gain: 0.2, slideTo: 110 }],
  correct: [523, 659, 784, 1047].map((freq, i) => ({ freq, start: i * 0.09, dur: 0.16, type: 'triangle', gain: 0.22 })),
  wrong: [
    { freq: 196, dur: 0.22, type: 'sawtooth', gain: 0.18 },
    { freq: 147, start: 0.2, dur: 0.38, type: 'sawtooth', gain: 0.18 },
  ],
  lock: [
    { freq: 660, dur: 0.08, type: 'sine', gain: 0.2 },
    { freq: 990, start: 0.07, dur: 0.12, type: 'sine', gain: 0.2 },
  ],
  start: [392, 523, 659].map((freq, i) => ({ freq, start: i * 0.07, dur: 0.12, type: 'square', gain: 0.1 })),
  whoosh: [{ freq: 300, dur: 0.35, type: 'sine', gain: 0.16, slideTo: 1400 }],
  fanfare: [
    [523, 0], [523, 0.14], [523, 0.28], [659, 0.46], [784, 0.7], [659, 0.9], [784, 1.1], [1047, 1.4],
  ].map(([freq, start]) => ({ freq, start, dur: start === 1.4 ? 0.9 : 0.16, type: 'triangle', gain: 0.24 })),
}

// ---- Music: a small generated loop per style ----

const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25]
const STYLES = {
  chill: { bpm: 84, wave: 'triangle', gain: 0.05, bass: 'sine', bassGain: 0.08, pattern: [0, 2, 4, 2, 3, 1, 4, 2] },
  hype: { bpm: 126, wave: 'sawtooth', gain: 0.035, bass: 'square', bassGain: 0.05, pattern: [0, 3, 5, 3, 2, 4, 5, 4] },
}
const BASS_NOTES = [65.41, 65.41, 98.0, 87.31]

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
    musicGain = ctx.createGain()
    musicGain.gain.value = 1
    musicGain.connect(master)
  } catch {
    ctx = null
  }
  return ctx
}

function tone({ freq, start = 0, dur = 0.15, type = 'sine', gain = 0.2, slideTo = null }, into) {
  const c = ctx
  const t0 = c.currentTime + start
  const osc = c.createOscillator()
  const amp = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  amp.gain.setValueAtTime(0.0001, t0)
  amp.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.02, dur / 3))
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(amp)
  amp.connect(into ?? master)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

function scheduleMusic() {
  const style = STYLES[musicStyle]
  if (!style || !ctx) return
  const beat = 60 / style.bpm / 2 // eighth notes
  while (nextBeat < ctx.currentTime + 0.35) {
    const step = beatIndex % style.pattern.length
    const start = Math.max(0, nextBeat - ctx.currentTime)
    tone({ freq: PENTATONIC[style.pattern[step]], start, dur: beat * 1.6, type: style.wave, gain: style.gain }, musicGain)
    if (step % 4 === 0) {
      const bassFreq = BASS_NOTES[Math.floor(beatIndex / 4) % BASS_NOTES.length]
      tone({ freq: bassFreq, start, dur: beat * 3.4, type: style.bass, gain: style.bassGain }, musicGain)
    }
    nextBeat += beat
    beatIndex += 1
  }
}

export const quizSound = {
  isSupported() {
    return typeof window !== 'undefined' && Boolean(window.AudioContext || window.webkitAudioContext)
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
    if (!prefs.unlocked || prefs.muted || !ctx || !Object.hasOwn(EFFECTS, name)) return
    try {
      for (const t of EFFECTS[name]) tone(t)
    } catch {
      // a blocked or closed audio context must never break the game
    }
  },

  startMusic(style, { quiet = false } = {}) {
    if (!prefs.unlocked || !ctx || !Object.hasOwn(STYLES, style)) return
    if (musicGain) musicGain.gain.setTargetAtTime(quiet ? 0.45 : 1, ctx.currentTime, 0.3)
    musicQuiet = quiet
    if (musicStyle === style && musicTimer) return
    this.stopMusic()
    musicStyle = style
    nextBeat = ctx.currentTime + 0.05
    beatIndex = 0
    scheduleMusic()
    musicTimer = setInterval(scheduleMusic, 120)
  },

  stopMusic() {
    if (musicTimer) clearInterval(musicTimer)
    musicTimer = null
    musicStyle = null
  },

  isMusicPlaying() {
    return Boolean(musicTimer)
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
