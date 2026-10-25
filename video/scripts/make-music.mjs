import fs from 'node:fs'
import path from 'node:path'

// An original bed with everything synthesised here, so there is no sample or
// licence to trace: pads, plucks, bass, kick, hats, claps and a bell resolution.
//
//   node scripts/make-music.mjs                                  the 60s launch bed (defaults below)
//   node scripts/make-music.mjs --duration 104.65 --out out/audio-gen/music-short.wav \
//     --sections 0:intro,1.6:groove,10.9:lift,51.1:peak,98.4:resolve \
//     --breakdown 96:98.4 --resolve-at 98.4 --risers 9.9:1:0.1,...
//
// Every mark is seconds on the FINAL cut's timeline. Generating the bed for
// that timeline directly is what keeps the music continuous: a bed sliced up
// to follow a cut jumps at every splice, which is exactly what gave the first
// short cut away.
const SR = 48000
const arg = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`)
  return at === -1 ? fallback : process.argv[at + 1]
}
const DURATION = Number(arg('duration', 60))
const TOTAL = SR * DURATION
const BPM = 112
const BEAT = 60 / BPM
const BAR = BEAT * 4

const L = new Float32Array(TOTAL)
const R = new Float32Array(TOTAL)

const panGain = (pan) => {
  const p = (Math.max(-1, Math.min(1, pan)) + 1) / 2
  return [Math.cos((p * Math.PI) / 2), Math.sin((p * Math.PI) / 2)]
}

function add(i, value, pan = 0) {
  if (i < 0 || i >= TOTAL) return
  const [gl, gr] = panGain(pan)
  L[i] += value * gl
  R[i] += value * gr
}

function pad(start, duration, freqs, gain, pan = 0) {
  const attack = 0.7
  const release = 1.1
  const total = duration + release
  const from = Math.floor(start * SR)
  const count = Math.floor(total * SR)
  for (let n = 0; n < count; n++) {
    const t = n / SR
    const env =
      t < attack
        ? t / attack
        : t < duration
          ? 1
          : Math.max(0, 1 - (t - duration) / release)
    const fade = env * env * (3 - 2 * env)
    let value = 0
    for (const f of freqs) {
      const detune = f * 0.0015
      value += Math.sin(2 * Math.PI * (f - detune) * t) * 0.55
      value += Math.sin(2 * Math.PI * (f + detune) * t) * 0.55
      value += Math.sin(2 * Math.PI * f * 2 * t) * 0.22
      value += Math.sin(2 * Math.PI * f * 3 * t) * 0.07
    }
    add(from + n, value * fade * gain, pan)
  }
}

function pluck(start, freq, gain, pan = 0, decay = 0.3) {
  const from = Math.floor(start * SR)
  const count = Math.floor(0.9 * SR)
  for (let n = 0; n < count; n++) {
    const t = n / SR
    const env = Math.exp(-t / decay) * Math.min(1, t / 0.006)
    const value =
      Math.sin(2 * Math.PI * freq * t) +
      0.38 * Math.sin(2 * Math.PI * freq * 2 * t) * Math.exp(-t / (decay * 0.5)) +
      0.12 * Math.sin(2 * Math.PI * freq * 3 * t) * Math.exp(-t / (decay * 0.35))
    add(from + n, value * env * gain, pan)
  }
}

function bass(start, freq, duration, gain) {
  const from = Math.floor(start * SR)
  const count = Math.floor((duration + 0.25) * SR)
  for (let n = 0; n < count; n++) {
    const t = n / SR
    const env =
      t < 0.01 ? t / 0.01 : t < duration ? 0.85 + 0.15 * Math.exp(-(t - 0.01) / 0.12) : Math.max(0, 1 - (t - duration) / 0.25)
    const value = Math.sin(2 * Math.PI * freq * t) + 0.28 * Math.sin(2 * Math.PI * freq * 2 * t)
    add(from + n, value * env * gain, 0)
  }
}

let noiseState = 12345
function noise() {
  noiseState = (noiseState * 1664525 + 1013904223) >>> 0
  return (noiseState / 4294967296) * 2 - 1
}

function kick(start, gain) {
  const from = Math.floor(start * SR)
  const count = Math.floor(0.34 * SR)
  for (let n = 0; n < count; n++) {
    const t = n / SR
    const f = 128 * Math.exp(-t / 0.045) + 46
    const phase = 2 * Math.PI * (46 * t + (128 - 46) * 0.045 * (1 - Math.exp(-t / 0.045)))
    const env = Math.exp(-t / 0.16)
    add(from + n, (Math.sin(phase) + 0.12 * noise() * Math.exp(-t / 0.01)) * env * gain, 0)
    void f
  }
}

function hat(start, gain, pan = 0.18) {
  const from = Math.floor(start * SR)
  const count = Math.floor(0.07 * SR)
  let prev = 0
  for (let n = 0; n < count; n++) {
    const t = n / SR
    const raw = noise()
    const high = raw - prev
    prev = raw
    add(from + n, high * Math.exp(-t / 0.022) * gain, pan)
  }
}

function clap(start, gain) {
  const from = Math.floor(start * SR)
  const count = Math.floor(0.22 * SR)
  for (let n = 0; n < count; n++) {
    const t = n / SR
    const tap = t < 0.05 ? Math.exp(-((t % 0.013) / 0.004)) : 0
    const tail = t >= 0.05 ? Math.exp(-(t - 0.05) / 0.07) : 0
    add(from + n, noise() * (tap + tail * 0.8) * gain, -0.08)
  }
}

function riser(start, duration, gain) {
  const from = Math.floor(start * SR)
  const count = Math.floor(duration * SR)
  let prev = 0
  for (let n = 0; n < count; n++) {
    const t = n / count
    const raw = noise()
    const high = raw - prev * 0.98
    prev = raw
    add(from + n, high * t * t * gain, Math.sin(t * 6) * 0.3)
  }
}

function bell(start, freq, gain) {
  const from = Math.floor(start * SR)
  const count = Math.floor(2.6 * SR)
  for (let n = 0; n < count; n++) {
    const t = n / SR
    const env = Math.exp(-t / 0.8) * Math.min(1, t / 0.008)
    const value =
      Math.sin(2 * Math.PI * freq * t) +
      0.45 * Math.sin(2 * Math.PI * freq * 2.01 * t) +
      0.2 * Math.sin(2 * Math.PI * freq * 3.02 * t)
    add(from + n, value * env * gain, -0.1 + 0.2 * Math.sin(t))
  }
}

const CHORDS = [
  { name: 'Am', pad: [220.0, 261.63, 329.63], bass: 55.0, arp: [440.0, 523.25, 659.25] },
  { name: 'F', pad: [174.61, 220.0, 261.63], bass: 43.65, arp: [349.23, 440.0, 523.25] },
  { name: 'C', pad: [261.63, 329.63, 392.0], bass: 65.41, arp: [523.25, 659.25, 783.99] },
  { name: 'G', pad: [196.0, 246.94, 293.66], bass: 49.0, arp: [392.0, 493.88, 587.33] },
]

// Cut marks: the bed changes on the ones the picture changes hardest on. The
// defaults are the launch video's (logo 3.6, academics 19.0, drop 25.0,
// dashboard 43.0, endcard 53.0); --sections passes another cut's out-times.
const parseSections = (spec) =>
  spec.split(',').map((part) => {
    const [at, name] = part.split(':')
    return { at: Number(at), name }
  })
const SECTIONS = parseSections(arg('sections', '0:intro,3.6:groove,13.0:lift,25.0:peak,53.0:resolve'))
const sectionAt = (t) => SECTIONS.filter((section) => section.at <= t).pop().name
/** A short drum pull-out before the endcard: --breakdown start:end */
const [BREAKDOWN_FROM, BREAKDOWN_TO] = arg('breakdown', '48.6:53.0').split(':').map(Number)
const breakdown = (t) => t >= BREAKDOWN_FROM && t < BREAKDOWN_TO
/** Where the resolving pad and bell figure take over from the groove. */
const RESOLVE_AT = Number(arg('resolve-at', 53.0))
const ARP_PATTERN = [0, 1, 2, 1, 0, 2, 1, 2]

const bars = Math.ceil(DURATION / BAR)
for (let bar = 0; bar < bars; bar++) {
  const barStart = bar * BAR
  if (barStart >= DURATION) break
  const section = sectionAt(barStart)
  const quiet = breakdown(barStart)
  const chord = CHORDS[bar % 4]
  if (section === 'resolve') continue

  const padGain = section === 'intro' ? 0.055 : section === 'groove' ? 0.06 : 0.07
  pad(barStart, BAR, chord.pad, padGain, bar % 2 === 0 ? -0.18 : 0.18)

  if (section !== 'intro') {
    bass(barStart, chord.bass, BAR * 0.42, quiet ? 0.13 : 0.2)
    bass(barStart + BAR * 0.55, chord.bass, BAR * 0.38, quiet ? 0.11 : 0.17)
  } else if (bar >= 1) {
    bass(barStart, chord.bass, BAR * 0.6, 0.12)
  }

  for (let step = 0; step < 8; step++) {
    const t = barStart + step * (BEAT / 2)
    if (t >= DURATION) break
    if (section === 'intro') {
      if (step % 4 === 0 && bar >= 1) pluck(t, chord.arp[step % 3], 0.05, step % 2 ? 0.3 : -0.3, 0.42)
      continue
    }
    const note = chord.arp[ARP_PATTERN[step] % chord.arp.length] * (section === 'lift' || section === 'peak' ? 2 : 1)
    pluck(t, note, section === 'lift' || section === 'peak' ? 0.062 : 0.048, step % 2 ? 0.34 : -0.34, 0.26)
  }

  const groove = section !== 'intro' && !quiet
  if (groove) {
    kick(barStart, 0.62)
    kick(barStart + BAR * 0.5, 0.55)
    if (section === 'peak') kick(barStart + BAR * 0.75, 0.34)
    for (let step = 0; step < 8; step++) {
      const t = barStart + step * (BEAT / 2)
      if (t >= DURATION) break
      hat(t, step % 2 === 0 ? 0.1 : 0.055, step % 2 ? 0.26 : -0.2)
    }
    if (section !== 'groove') {
      clap(barStart + BAR * 0.5, 0.12)
      clap(barStart, 0.1)
    }
  } else if (quiet) {
    hat(barStart, 0.035)
    hat(barStart + BAR * 0.5, 0.03)
  } else if (bar === 2) {
    hat(barStart, 0.05)
    hat(barStart + BEAT, 0.04)
  }
}

// The risers land exactly on the cuts the visuals are built around, each
// written start:duration:gain and cresting on its mark.
for (const entry of arg('risers', '2.7:1:0.09,11.9:1.1:0.1,23.6:1.4:0.13,51.4:1.5:0.12').split(',')) {
  const [at, duration, gain] = entry.split(':').map(Number)
  riser(at, duration, gain)
}

// Resolve: C major pad and a rising bell figure from RESOLVE_AT to the fade.
pad(RESOLVE_AT, 4.6, [261.63, 329.63, 392.0, 523.25], 0.085, 0.1)
pad(RESOLVE_AT, 4.2, [130.81, 196.0], 0.06, -0.15)
bass(RESOLVE_AT, 65.41, 3.8, 0.15)
;[523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => bell(RESOLVE_AT + index * 0.55, freq, 0.105))

// Soft top-and-tail so the bed starts on the downbeat and ends cleanly at 60.00.
for (let n = 0; n < TOTAL; n++) {
  const t = n / SR
  const fadeIn = Math.min(1, t / 0.4)
  const fadeOut = Math.min(1, Math.max(0, (DURATION - t) / 1.6))
  L[n] *= fadeIn * fadeOut
  R[n] *= fadeIn * fadeOut
}

let peak = 0
for (let n = 0; n < TOTAL; n++) peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n]))
const normalise = peak > 0 ? 0.89 / peak : 1

const outPath = path.resolve(arg('out', 'out/audio-gen/music-60s.wav'))
fs.mkdirSync(path.dirname(outPath), { recursive: true })
const buffer = Buffer.alloc(44 + TOTAL * 4)
buffer.write('RIFF', 0)
buffer.writeUInt32LE(36 + TOTAL * 4, 4)
buffer.write('WAVE', 8)
buffer.write('fmt ', 12)
buffer.writeUInt32LE(16, 16)
buffer.writeUInt16LE(1, 20)
buffer.writeUInt16LE(2, 22)
buffer.writeUInt32LE(SR, 24)
buffer.writeUInt32LE(SR * 4, 28)
buffer.writeUInt16LE(4, 32)
buffer.writeUInt16LE(16, 34)
buffer.write('data', 36)
buffer.writeUInt32LE(TOTAL * 4, 40)
for (let n = 0; n < TOTAL; n++) {
  const l = Math.max(-1, Math.min(1, L[n] * normalise))
  const r = Math.max(-1, Math.min(1, R[n] * normalise))
  buffer.writeInt16LE(Math.round(l * 32767), 44 + n * 4)
  buffer.writeInt16LE(Math.round(r * 32767), 46 + n * 4)
}
fs.writeFileSync(outPath, buffer)
console.log('wrote', outPath, (buffer.length / 1024 / 1024).toFixed(1) + 'MB')
