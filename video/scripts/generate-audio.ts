// Generates the audio for the video into public/: voiceover.mp3, music.mp3, whoosh.mp3, pop.mp3.
//   - Voiceover: free Microsoft neural voice via the `edge-tts` Python package (pip install edge-tts). Each beat's line
//     is spoken, sped up slightly if it is too long for its beat, and placed at the beat's start time.
//   - Music and sound effects: synthesised here (no samples, no licensing).
// Usage: npx tsx scripts/generate-audio.ts [voice|music|sfx|all]   (default: all)
// Spoken clips are cached in out/audio-tmp; set REGEN=1 to re-speak every line (do this after editing src/script.ts).
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BEAT_SECONDS, FPS, SCENE_ORDER, SCENE_START, TOTAL_FRAMES } from '../src/constants'
import { VO } from '../src/script'

const root = join(__dirname, '..')
const pub = join(root, 'public')
const tmp = join(root, 'out', 'audio-tmp')
const VOICE = process.env.VOICE ?? 'en-NG-EzinneNeural'
const RATE = process.env.RATE ?? '+12%'
const SR = 44100
const TOTAL_S = TOTAL_FRAMES / FPS

function run(cmd: string, args: string[]) {
  const r = spawnSync(cmd, args, { shell: true, encoding: 'utf8', cwd: root })
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')}\n${r.stderr || r.stdout}`)
  return r.stdout
}
// Remotion bundles ffmpeg/ffprobe; call them directly (much faster than going through npx each time).
const BIN = join(root, 'node_modules', '@remotion', 'compositor-win32-x64-msvc')
const FFMPEG = `"${join(BIN, 'ffmpeg.exe')}"`
const FFPROBE = `"${join(BIN, 'ffprobe.exe')}"`
const ffmpeg = (args: string[]) => run(FFMPEG, ['-y', '-loglevel', 'error', ...args])
const duration = (file: string) =>
  Number(run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', `"${file}"`]).trim().split(/\s+/).pop())

/* ------------------------------------------------------------------ voiceover */

// Where the speech starts and ends inside a clip (the voice leaves a little silence at both ends).
function speechBounds(file: string): [number, number] {
  const total = duration(file)
  const r = spawnSync(FFMPEG, ['-hide_banner', '-i', `"${file}"`, '-af', 'silencedetect=n=-45dB:d=0.12', '-f', 'null', '-'], { shell: true, encoding: 'utf8', cwd: root })
  const log = r.stderr || ''
  let from = 0
  let to = total
  const starts = [...log.matchAll(/silence_start: (-?[d.]+)/g)].map((m) => Number(m[1]))
  const ends = [...log.matchAll(/silence_end: ([d.]+)/g)].map((m) => Number(m[1]))
  if (starts.length && starts[0] <= 0.05 && ends.length) from = Math.max(0, ends[0] - 0.04)
  const last = starts[starts.length - 1]
  if (last !== undefined && last > from + 0.2 && (ends.length < starts.length || ends[ends.length - 1] >= total - 0.05)) to = Math.min(total, last + 0.08)
  return [from, to]
}


function voice() {
  mkdirSync(tmp, { recursive: true })
  rmSync(join(pub, 'vo'), { recursive: true, force: true })
  mkdirSync(join(pub, 'vo'), { recursive: true })
    for (const scene of SCENE_ORDER) {
    let t = SCENE_START[scene] / FPS
    for (const [beat, seconds] of Object.entries(BEAT_SECONDS[scene])) {
      const text = (VO[scene] as Record<string, string>)[beat]
      const raw = join(tmp, `${scene}-${beat}.mp3`)
      if (!existsSync(raw) || process.env.REGEN) run('python', ['-m', 'edge_tts', '--voice', VOICE, `--rate=${RATE}`, '--text', JSON.stringify(text), '--write-media', `"${raw}"`])
      // trim the silence the voice leaves at both ends, then speed up a little if the line is too long for its beat
      const trimmed = join(tmp, `${scene}-${beat}.trim.wav`)
      const [from, to] = speechBounds(raw)
      ffmpeg(['-i', `"${raw}"`, '-af', `atrim=start=${from.toFixed(3)}:end=${to.toFixed(3)},asetpts=PTS-STARTPTS`, '-ar', String(SR), `"${trimmed}"`])
      let d = duration(trimmed)
      if (!(d > 0.3)) {
        ffmpeg(['-i', `"${raw}"`, '-ar', String(SR), `"${trimmed}"`])
        d = duration(trimmed)
      }
      const room = (seconds as number) - 0.2
      const tempo = d > room ? Math.min(1.25, d / room) : 1
      let file = trimmed
      if (tempo > 1.001) {
        file = join(tmp, `${scene}-${beat}.fit.wav`)
        ffmpeg(['-i', `"${trimmed}"`, '-af', `atempo=${tempo.toFixed(3)}`, `"${file}"`])
      }
      const fitted = d / tempo
      const flag = fitted > room + 0.05 ? '  <-- TOO LONG, shorten the line or lengthen the beat' : ''
      console.log(`${scene}/${beat}: ${d.toFixed(2)}s speech, beat ${seconds}s${tempo > 1.001 ? `, sped x${tempo.toFixed(2)}` : ''}${flag}`)
      copyFileSync(file, join(pub, 'vo', `${scene}-${beat}.wav`))
      t += seconds as number
    }
  }
  console.log('Wrote public/vo/ (one clip per beat; the video plays each at its beat start)')
}

/* ------------------------------------------------------------------ synthesis helpers */

function writeWav(file: string, left: Float32Array, right: Float32Array) {
  const n = left.length
  const buf = Buffer.alloc(44 + n * 4)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + n * 4, 4)
  buf.write('WAVEfmt ', 8)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(2, 22)
  buf.writeUInt32LE(SR, 24)
  buf.writeUInt32LE(SR * 4, 28)
  buf.writeUInt16LE(4, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(n * 4, 40)
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(left[i] * 32767))), 44 + i * 4)
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(right[i] * 32767))), 46 + i * 4)
  }
  writeFileSync(file, buf)
}

// deterministic noise so renders are repeatable
let seed = 1234567
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

function toMp3(wav: string, mp3: string, extra: string[] = []) {
  ffmpeg(['-i', `"${wav}"`, ...extra, '-b:a', '160k', `"${mp3}"`])
}

/* ------------------------------------------------------------------ music */

// A bouncy, afrobeat-flavoured loop: kick, clap, hats, off-beat bass, chord stabs and a little arpeggio.
function music() {
  mkdirSync(tmp, { recursive: true })
  const bpm = 108
  const beat = 60 / bpm
  const total = Math.ceil(TOTAL_S * SR)
  const L = new Float32Array(total)
  const R = new Float32Array(total)
  const add = (i: number, l: number, r = l) => {
    if (i >= 0 && i < total) {
      L[i] += l
      R[i] += r
    }
  }
  // chords per bar: Am, F, C, G (roots + triad)
  const bars = [
    { root: 45, chord: [57, 60, 64] },
    { root: 41, chord: [53, 57, 60] },
    { root: 48, chord: [55, 60, 64] },
    { root: 43, chord: [55, 59, 62] },
  ]
  const nBeats = Math.floor(TOTAL_S / beat)
  for (let b = 0; b < nBeats; b++) {
    const t0 = b * beat
    const i0 = Math.round(t0 * SR)
    const bar = Math.floor(b / 4) % 4
    const inBar = b % 4
    const section = t0 / TOTAL_S
    const energy = section < 0.06 ? 0.55 : section > 0.93 ? 0.5 : 1 // gentle intro and outro
    // kick on 1 and 3 (and a pickup on the "and" of 4 for bounce)
    if (inBar === 0 || inBar === 2) {
      for (let k = 0; k < SR * 0.22; k++) {
        const t = k / SR
        const f = 55 + 110 * Math.exp(-t * 28)
        add(i0 + k, Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 11) * 0.9 * energy)
      }
    }
    // clap on 2 and 4
    if (inBar === 1 || inBar === 3) {
      for (let k = 0; k < SR * 0.14; k++) {
        const t = k / SR
        add(i0 + k, rnd() * Math.exp(-t * 32) * 0.32 * energy, rnd() * Math.exp(-t * 32) * 0.32 * energy)
      }
    }
    // hats on every half-beat, accent the off-beats
    for (let h = 0; h < 2; h++) {
      const ih = i0 + Math.round(h * beat * 0.5 * SR)
      const acc = h === 1 ? 0.2 : 0.1
      let prev = 0
      for (let k = 0; k < SR * 0.05; k++) {
        const t = k / SR
        const n = rnd()
        const hp = n - prev // crude high-pass
        prev = n
        add(ih + k, hp * Math.exp(-t * 90) * acc * energy)
      }
    }
    // bass: root on 1, then syncopated hits on the "and" of 2 and on 4
    const bassHits = inBar === 0 ? [0] : inBar === 1 ? [0.5] : inBar === 3 ? [0, 0.5] : []
    for (const off of bassHits) {
      const ib = i0 + Math.round(off * beat * SR)
      const note = midi(bars[bar].root + (off === 0.5 && inBar === 3 ? 12 : 0))
      for (let k = 0; k < SR * 0.32; k++) {
        const t = k / SR
        const env = Math.min(1, t * 120) * Math.exp(-t * 6)
        add(ib + k, (Math.sin(2 * Math.PI * note * t) + 0.25 * Math.sin(4 * Math.PI * note * t)) * env * 0.42 * energy)
      }
    }
    // chord stabs on the "and" of 1 and on beat 3's "and"
    if (inBar === 0 || inBar === 2) {
      const is = i0 + Math.round(0.5 * beat * SR)
      for (const n of bars[bar].chord) {
        const f = midi(n)
        for (let k = 0; k < SR * 0.28; k++) {
          const t = k / SR
          const env = Math.min(1, t * 200) * Math.exp(-t * 9)
          const w = Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * f * 2 * t) + 0.12 * Math.sin(2 * Math.PI * f * 3 * t)
          add(is + k, w * env * 0.075 * energy, w * env * 0.06 * energy)
        }
      }
    }
    // arpeggio, once the intro is over: four 16ths per beat
    if (section > 0.04 && section < 0.95) {
      for (let s = 0; s < 4; s++) {
        const ia = i0 + Math.round(s * beat * 0.25 * SR)
        const f = midi(bars[bar].chord[(s + inBar) % 3] + 12)
        const pan = s % 2 ? 0.7 : 1.1
        for (let k = 0; k < SR * 0.12; k++) {
          const t = k / SR
          const env = Math.min(1, t * 300) * Math.exp(-t * 20)
          const w = Math.sin(2 * Math.PI * f * t) * env * 0.05
          add(ia + k, w * pan, w * (2 - pan))
        }
      }
    }
  }
  // fade in/out and normalise
  let peak = 0
  for (let i = 0; i < total; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]))
  const fadeIn = SR * 1.5
  const fadeOut = SR * 3
  for (let i = 0; i < total; i++) {
    const g = (0.85 / peak) * Math.min(1, i / fadeIn) * Math.min(1, (total - i) / fadeOut)
    L[i] *= g
    R[i] *= g
  }
  const wav = join(tmp, 'music.wav')
  writeWav(wav, L, R)
  toMp3(wav, join(pub, 'music.mp3'))
  console.log('Wrote public/music.mp3')
}

/* ------------------------------------------------------------------ sound effects */

function sfx() {
  mkdirSync(tmp, { recursive: true })
  // whoosh: noise through a low-pass whose cutoff sweeps up then down
  {
    const n = Math.round(SR * 0.7)
    const L = new Float32Array(n)
    const R = new Float32Array(n)
    let y1 = 0
    let y2 = 0
    for (let i = 0; i < n; i++) {
      const t = i / n
      const cut = 0.02 + 0.5 * Math.sin(Math.PI * t) ** 2
      const env = Math.sin(Math.PI * t) ** 1.5
      y1 += cut * (rnd() - y1)
      y2 += cut * (y1 - y2)
      L[i] = y2 * env * 1.8
      R[i] = y2 * env * 1.8 * (1 - 0.15 * Math.sin(t * 6))
    }
    writeWav(join(tmp, 'whoosh.wav'), L, R)
    toMp3(join(tmp, 'whoosh.wav'), join(pub, 'whoosh.mp3'), ['-af', 'loudnorm=I=-18:TP=-2'])
  }
  // pop: a quick falling sine plus a tiny click
  {
    const n = Math.round(SR * 0.22)
    const L = new Float32Array(n)
    const R = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const t = i / SR
      const f = 220 + 700 * Math.exp(-t * 38)
      const v = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 22) * 0.9 + (i < 60 ? rnd() * 0.3 : 0)
      L[i] = v
      R[i] = v
    }
    writeWav(join(tmp, 'pop.wav'), L, R)
    toMp3(join(tmp, 'pop.wav'), join(pub, 'pop.mp3'), ['-af', 'loudnorm=I=-18:TP=-2'])
  }
  console.log('Wrote public/whoosh.mp3 and public/pop.mp3')
}

const what = process.argv[2] ?? 'all'
if (what === 'voice' || what === 'all') voice()
if (what === 'music' || what === 'all') music()
if (what === 'sfx' || what === 'all') sfx()

