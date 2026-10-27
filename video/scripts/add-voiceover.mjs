/**
 * Lays the ElevenLabs short-cut read over the two short explainers.
 *
 * The take is one continuous read of the 42 captions, but the picture is
 * 1:44.65: the voice is read with short breaths between lines, while the cut
 * gives each line 0.5-2.5s. Dropping it at 0:00 therefore runs ahead of the
 * burned-in captions. So the take is split at its own word boundaries and each
 * script line is placed at *its* caption's start frame. Every line lands with
 * the text on screen and the picture keeps its gaps.
 *
 * The split points come from an ElevenLabs word-timestamp transcript, not from
 * silence detection: several script lines are read in one breath (e.g. "…right
 * there, class and exam timetables"), so a silence split would glue two lines
 * together and shift everything after it. The transcript is cached under
 * out/voice-import/ because it is a paid call; delete the JSON or pass
 * --retranscribe to regenerate it.
 *
 * The music is the existing mix pulled 8 dB under each spoken line, with 250ms
 * ramps, rather than a flat -8 dB for the whole film — the bed is the only
 * sound in the gaps and should not sit low there. Nothing is re-encoded on the
 * picture side: video is stream-copied, only the audio is replaced.
 *
 * Usage: node scripts/add-voiceover.mjs [take.mp3] [--retranscribe] [--dry]
 *        [--tag live] [--cuts 19.3-20.6,56.95-60.45] [--tempo 1.05]
 *
 * The take defaults to the first Rho read in voice-elevenlabs/; pass another
 * file (a newer generation, say) and it gets its own transcript cache.
 *
 * --tag names the deliverables: the default "vo" writes -vo.mp4, "live" writes
 * -vo-live.mp4, and so on. --cuts removes repeated takes from the read before
 * it is transcribed, in source-timeline seconds. --tempo applies atempo to the
 * whole take before cutting; it is a last resort for a read that is uniformly
 * too slow, not a way to squeeze one long line.
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { basename, extname, join } from 'node:path'

const ffmpeg = fileURLToPath(
  new URL('../node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe', import.meta.url),
)
const ARGS = process.argv.slice(2)
const DRY = ARGS.includes('--dry')
const RETRANSCRIBE = ARGS.includes('--retranscribe')

/** Flags that consume the next argv entry, so it is not mistaken for the take. */
const VALUE_FLAGS = new Set(['--tag', '--cuts', '--tempo'])
function flagValue(name) {
  const at = ARGS.indexOf(name)
  return at >= 0 ? ARGS[at + 1] : undefined
}
const POSITIONAL = ARGS.filter((arg, i) => !arg.startsWith('--') && !VALUE_FLAGS.has(ARGS[i - 1]))

const SR = 48000
const CH = 2
const VO_SRC = POSITIONAL[0]
  ?? 'voice-elevenlabs/ElevenLabs_2026-10-25T20_26_44_Rho - Stories & Podcast_pvc_sp100_s50_sb70_se5_b_m2.mp3'
const SRT = 'out/nammes-hub-explainer-short.srt'
const WORK = 'out/voice-import'
/** Output suffix; the default keeps the names the ElevenLabs pass already wrote. */
const TAG = flagValue('--tag') ?? 'vo'
const SUFFIX = TAG === 'vo' ? '' : `-${TAG}`
const TEMPO = Number(flagValue('--tempo') ?? 1)
if (!(TEMPO >= 0.5 && TEMPO <= 2)) throw new Error('--tempo must be between 0.5 and 2')

/**
 * Ranges of the read to delete, in source seconds. Used for a live take where
 * the speaker repeated a line: the later take is kept and the earlier one goes.
 */
const CUTS = (flagValue('--cuts') ?? '')
  .split(',')
  .map((part) => part.trim())
  .filter(Boolean)
  .map((part) => {
    const m = part.match(/^([\d.]+)\s*-\s*([\d.]+)$/)
    if (!m) throw new Error(`bad --cuts range "${part}"`)
    const start = Number(m[1])
    const end = Number(m[2])
    if (!(end > start)) throw new Error(`bad --cuts range "${part}"`)
    return [start, end]
  })
  .sort((a, b) => a[0] - b[0])

/** Per-take cache, so trying a second read never reuses the first's timings. */
const TAKE = basename(VO_SRC).replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '')
const CUT_TAG = `${CUTS.length ? '-cut' : ''}${TEMPO !== 1 ? `-t${TEMPO}` : ''}`
const DECODED = join(WORK, `${TAKE}-48k.wav`)
const CUT_WAV = join(WORK, `${TAKE}${CUT_TAG}.wav`)
const WORDS = join(WORK, `${TAKE}${CUT_TAG}.words.json`)
const RETIMED = join(WORK, `short-vo-${TAG}-retimed.wav`)
const FINAL_AUDIO = join(WORK, `short-vo-${TAG}-mix.wav`)

const TARGETS = [
  { src: 'out/nammes-hub-explainer-short-16x9.mp4', out: `out/nammes-hub-explainer-short-16x9-vo${SUFFIX}.mp4` },
  { src: 'out/nammes-hub-explainer-short-9x16.mp4', out: `out/nammes-hub-explainer-short-9x16-vo${SUFFIX}.mp4` },
]

/** The voice's first word sits this far after the caption appears. */
const LEAD = 0.03
/** Music under a spoken line: -8 dB. */
const DUCK = 10 ** (-8 / 20)
const RAMP = 0.25
/** Speech level target for the whole take; the bed was mixed at -16 LUFS. */
const VO_LUFS = -15

function run(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpeg, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let err = ''
    p.stdout.on('data', (d) => { err += d })
    p.stderr.on('data', (d) => { err += d })
    p.on('close', (code) => (code === 0 ? resolve(err) : reject(new Error(`ffmpeg exit ${code}\n${err.slice(-2000)}`))))
  })
}

function probeDuration(path) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpeg, ['-hide_banner', '-i', path], { stdio: ['ignore', 'pipe', 'pipe'] })
    let err = ''
    p.stderr.on('data', (d) => { err += d })
    p.on('close', () => {
      const m = err.match(/Duration: (\d+):(\d+):([\d.]+)/)
      if (!m) return reject(new Error(`no duration for ${path}`))
      resolve(Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]))
    })
  })
}

function parseWav(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error('not RIFF')
  let pos = 12
  let fmt = null
  let data = null
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4)
    const size = buf.readUInt32LE(pos + 4)
    if (id === 'fmt ') fmt = { pos: pos + 8 }
    if (id === 'data') data = { pos: pos + 8, size }
    pos += 8 + size + (size % 2)
  }
  if (!fmt || !data) throw new Error('missing fmt/data')
  const format = buf.readUInt16LE(fmt.pos)
  const channels = buf.readUInt16LE(fmt.pos + 2)
  const rate = buf.readUInt32LE(fmt.pos + 4)
  const bits = buf.readUInt16LE(fmt.pos + 14)
  if (format !== 1 || bits !== 16 || channels !== CH || rate !== SR) {
    throw new Error(`unexpected wav: fmt=${format} ch=${channels} rate=${rate} bits=${bits}`)
  }
  return { buf, off: data.pos, frames: data.size / (CH * 2) }
}

function writeWav(path, pcm) {
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(CH, 22)
  header.writeUInt32LE(SR, 24)
  header.writeUInt32LE(SR * CH * 2, 28)
  header.writeUInt16LE(CH * 2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)
  writeFileSync(path, Buffer.concat([header, pcm]))
}

/**
 * Delete [start, end] ranges from a 48k stereo take. Each edge gets a 10ms
 * fade so the join does not click; the fade lives on the kept side of the cut.
 */
function cutAudio(pcm, frames, cuts) {
  const fade = Math.round(0.01 * SR)
  const gain = new Float32Array(frames).fill(1)
  const keep = []
  let from = 0
  for (const [start, end] of cuts) {
    const a = Math.max(0, Math.min(frames, Math.round(start * SR)))
    const b = Math.max(a, Math.min(frames, Math.round(end * SR)))
    if (a > from) keep.push([from, a])
    for (let f = Math.max(0, a - fade); f < a; f++) gain[f] = Math.min(gain[f], (a - f) / fade)
    for (let f = b; f < Math.min(frames, b + fade); f++) gain[f] = Math.min(gain[f], (f - b) / fade)
    from = b
  }
  if (from < frames) keep.push([from, frames])
  const total = keep.reduce((sum, [a, b]) => sum + (b - a), 0)
  const out = new Int16Array(total * CH)
  let at = 0
  for (const [a, b] of keep) {
    for (let f = a; f < b; f++) {
      for (let c = 0; c < CH; c++) out[at * CH + c] = Math.round(pcm[f * CH + c] * gain[f])
      at++
    }
  }
  return out
}

/** SRT -> [{ start, end, text }] in output-timeline seconds. */
function parseSrt(text) {
  return text
    .trim()
    .split(/\r?\n\r?\n/)
    .map((block) => {
      const lines = block.split(/\r?\n/)
      const m = lines[1].match(/(\d+):(\d+):(\d+),(\d+) --> (\d+):(\d+):(\d+),(\d+)/)
      const toSec = (h, mi, s, ms) => Number(h) * 3600 + Number(mi) * 60 + Number(s) + Number(ms) / 1000
      return {
        start: toSec(m[1], m[2], m[3], m[4]),
        end: toSec(m[5], m[6], m[7], m[8]),
        text: lines.slice(2).join(' ').trim(),
      }
    })
}

const ONES = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
}
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }

/** "twenty-six" -> "26" so the script's "26/27" can match the read's number words. */
function numberWord(word) {
  if (TENS[word] !== undefined) return String(TENS[word])
  for (const [tens, base] of Object.entries(TENS)) {
    if (word.startsWith(tens) && word.length > tens.length) {
      const rest = word.slice(tens.length)
      if (ONES[rest] !== undefined) return String(base + ONES[rest])
    }
  }
  return ONES[word] !== undefined ? String(ONES[word]) : null
}

/**
 * One token per word, digits for number words, punctuation stripped. "26/27"
 * and the read's "twenty-six/twenty-seven" both become ["26", "27"].
 */
function tokenize(text) {
  return text
    .replace(/[’‘]/g, "'")
    .split(/[\s/]+/)
    .map((raw) => {
      const clean = raw.toLowerCase().replace(/[^a-z0-9]/g, '')
      return clean ? numberWord(clean) ?? clean : ''
    })
    .filter(Boolean)
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
  }
  return dp[a.length][b.length]
}

function similarity(a, b) {
  if (a === b) return 1
  const longest = Math.max(a.length, b.length)
  return longest === 0 ? 1 : 1 - levenshtein(a, b) / longest
}

/**
 * Global alignment of the script's tokens against the read's words. Similar
 * spellings are cheap substitutions (NAMES/NAMMES, EGs/AEGIS); anything else
 * costs more than two gaps, so a word the read dropped becomes a gap rather
 * than being matched onto its neighbour.
 */
function align(scriptTokens, asrTokens) {
  const n = scriptTokens.length
  const m = asrTokens.length
  const GAP = 1
  const cost = (a, b) => {
    const s = similarity(a, b)
    if (s === 1) return 0
    return s >= 0.55 ? 0.35 : 1.4
  }
  const dp = Array.from({ length: n + 1 }, () => new Float64Array(m + 1))
  const move = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1))
  for (let i = 1; i <= n; i++) { dp[i][0] = i * GAP; move[i][0] = 1 }
  for (let j = 1; j <= m; j++) { dp[0][j] = j * GAP; move[0][j] = 2 }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const diag = dp[i - 1][j - 1] + cost(scriptTokens[i - 1], asrTokens[j - 1])
      const up = dp[i - 1][j] + GAP
      const left = dp[i][j - 1] + GAP
      if (diag <= up && diag <= left) { dp[i][j] = diag; move[i][j] = 0 }
      else if (up <= left) { dp[i][j] = up; move[i][j] = 1 }
      else { dp[i][j] = left; move[i][j] = 2 }
    }
  }
  const map = new Array(n).fill(-1)
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    const dir = move[i][j]
    if (dir === 0) { map[i - 1] = j - 1; i--; j-- }
    else if (dir === 1) i--
    else j--
  }
  return map
}

async function transcribe(sourcePath) {
  const env = Object.fromEntries(
    readFileSync(new URL('../.env', import.meta.url), 'utf8')
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const eq = line.indexOf('=')
        return [line.slice(0, eq).trim(), line.slice(eq + 1).trim()]
      }),
  )
  if (!env.ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY is missing from video/.env')
  const ext = extname(sourcePath).toLowerCase()
  const mime = ext === '.wav' ? 'audio/wav' : ext === '.opus' ? 'audio/ogg' : 'audio/mpeg'
  const form = new FormData()
  form.append('file', new Blob([readFileSync(sourcePath)], { type: mime }), `vo${ext}`)
  form.append('model_id', 'scribe_v1')
  form.append('timestamps_granularity', 'word')
  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': env.ELEVENLABS_API_KEY },
    body: form,
  })
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`)
  const json = await res.json()
  writeFileSync(WORDS, JSON.stringify(json, null, 2))
  console.log(`transcribed ${json.words.filter((w) => w.type === 'word').length} words -> ${WORDS}`)
  return json
}

async function main() {
  mkdirSync(WORK, { recursive: true })
  console.log(`take: ${VO_SRC}`)

  const captions = parseSrt(readFileSync(SRT, 'utf8'))

  // Decode once at the output format, then remove the repeated takes before
  // transcription: the word timings have to describe the audio that is placed,
  // not the uncut read they were recorded against.
  const decodeArgs = ['-y', '-i', VO_SRC, '-ar', String(SR), '-ac', String(CH), '-c:a', 'pcm_s16le']
  if (TEMPO !== 1) decodeArgs.push('-af', `atempo=${TEMPO}`)
  decodeArgs.push(DECODED)
  await run(decodeArgs)

  let voWavPath = DECODED
  if (CUTS.length) {
    const decoded = parseWav(readFileSync(DECODED))
    const pcm = new Int16Array(decoded.buf.buffer, decoded.buf.byteOffset + decoded.off, decoded.frames * CH)
    const cut = cutAudio(pcm, decoded.frames, CUTS)
    writeWav(CUT_WAV, Buffer.from(cut.buffer, cut.byteOffset, cut.byteLength))
    voWavPath = CUT_WAV
    console.log(`cut ${CUTS.map(([a, b]) => `${a}-${b}s`).join(', ')} -> ${(cut.length / CH / SR).toFixed(2)}s`)
  }

  const wordsJson = !RETRANSCRIBE && existsSync(WORDS) ? JSON.parse(readFileSync(WORDS, 'utf8')) : await transcribe(voWavPath)
  const words = wordsJson.words.filter((w) => w.type === 'word')
  if (!words.length) throw new Error('transcript has no words')

  const scriptTokens = captions.flatMap((c) => tokenize(c.text))
  const lineTokenCounts = captions.map((c) => tokenize(c.text).length)
  // One spoken word can carry more than one script token ("26/27" is spoken as
  // "twenty-six/twenty-seven"), so the alignment runs on tokens and is folded
  // back to word indices afterwards.
  const asrTokens = []
  const asrWord = []
  words.forEach((word, index) => {
    for (const token of tokenize(word.text)) {
      asrTokens.push(token)
      asrWord.push(index)
    }
  })
  const map = align(scriptTokens, asrTokens).map((index) => (index >= 0 ? asrWord[index] : -1))

  const bounds = []
  let cursor = 0
  for (const count of lineTokenCounts) {
    const hits = map.slice(cursor, cursor + count).filter((idx) => idx >= 0)
    if (!hits.length) throw new Error(`line ${bounds.length + 1} matched no spoken words`)
    bounds.push({ first: Math.min(...hits), last: Math.max(...hits) })
    cursor += count
  }
  // A mismatch that runs backwards would place a later line before an earlier
  // one; the read is in script order, so this is always a bad alignment.
  for (let i = 1; i < bounds.length; i++) {
    if (bounds[i].first <= bounds[i - 1].last) {
      throw new Error(`alignment not monotonic at line ${i + 1}`)
    }
  }

  const lines = captions.map((caption, i) => {
    const startAudio = words[bounds[i].first].start
    const endAudio = words[bounds[i].last].end
    const prevEnd = i > 0 ? words[bounds[i - 1].last].end : 0
    const nextStart = i + 1 < bounds.length
      ? words[bounds[i + 1].first].start
      : (wordsJson.audio_duration_secs ?? words[words.length - 1].end + 0.5)
    return {
      ...caption,
      startAudio,
      endAudio,
      first: bounds[i].first,
      last: bounds[i].last,
      padBefore: Math.max(0, Math.min(0.1, (startAudio - prevEnd) / 2)),
      padAfter: Math.max(0, Math.min(0.2, (nextStart - endAudio) / 2)),
    }
  })

  console.log(`${lines.length} lines matched to ${words.length} spoken words`)
  for (const [i, line] of lines.entries()) {
    const slot = (lines[i + 1]?.start ?? 104.65) - line.start
    const spoken = line.endAudio - line.startAudio
    const flag = spoken > slot - LEAD ? '  <-- LONGER THAN ITS SLOT' : ''
    console.log(
      `  ${String(i + 1).padStart(2)} ${line.start.toFixed(2).padStart(6)}s ` +
      `spoken ${spoken.toFixed(2)}s / slot ${slot.toFixed(2)}s  "${line.text}"` +
      `  [${words[bounds[i].first].text} … ${words[bounds[i].last].text}]${flag}`,
    )
  }

  const duration = await probeDuration(TARGETS[0].src)
  console.log(`picture: ${duration.toFixed(2)}s`)

  if (DRY) {
    console.log('dry run — nothing written')
    return
  }

  const voWav = parseWav(readFileSync(voWavPath))
  const src = new Int16Array(voWav.buf.buffer, voWav.buf.byteOffset + voWav.off, voWav.frames * CH)

  const outFrames = Math.round(duration * SR)
  const out = new Int16Array(outFrames * CH)
  const speech = []
  let lastPlacedEnd = 0

  for (const [index, line] of lines.entries()) {
    const nextStart = lines[index + 1]?.start ?? duration
    // Time between this line's first word and the next line's first word. A
    // line that is naturally longer than that has its internal pauses closed
    // up (never the words themselves), so the next line still lands on its own
    // caption. "Academics, Community, Forms, Contact." is the one that needs
    // it: read as a list, it carries ~1.4s of breath the cut does not have.
    const available = nextStart - line.start - LEAD - 0.02
    const natural = line.endAudio - line.startAudio + line.padBefore + line.padAfter

    if (natural <= available) {
      const from = Math.max(0, Math.round((line.startAudio - line.padBefore) * SR))
      const to = Math.min(voWav.frames, Math.round((line.endAudio + line.padAfter) * SR))
      let at = Math.round((line.start + LEAD - line.padBefore) * SR)
      // Two lines read in one breath can leave no room for both pads; the next
      // line always wins, so a line is trimmed rather than overlapped.
      at = Math.max(at, lastPlacedEnd)
      const frames = Math.min(to - from, outFrames - at)
      if (frames <= 0) throw new Error(`line does not fit: "${line.text}"`)

      const fade = Math.min(Math.round(0.012 * SR), Math.floor(frames / 2))
      for (let f = 0; f < frames; f++) {
        const gain = f < fade ? f / fade : f >= frames - fade ? (frames - 1 - f) / fade : 1
        for (let c = 0; c < CH; c++) {
          out[(at + f) * CH + c] = Math.round(src[(from + f) * CH + c] * gain)
        }
      }
      speech.push({ start: line.start + LEAD, end: line.start + LEAD + (line.endAudio - line.startAudio) })
      lastPlacedEnd = at + frames
      continue
    }

    const spoken = words.slice(line.first, line.last + 1)
    const parts = spoken.map((word, k) => {
      const prevEnd = k === 0 ? word.start : spoken[k - 1].end
      const nextWord = k === spoken.length - 1 ? word.end : spoken[k + 1].start
      const before = Math.min(0.012, Math.max(0, (word.start - prevEnd) / 2))
      const after = Math.min(0.012, Math.max(0, (nextWord - word.end) / 2))
      return { from: word.start - before, to: word.end + after, frames: (word.end - word.start + before + after) * SR }
    })
    const speechFrames = parts.reduce((sum, part) => sum + part.frames, 0)
    const gaps = Math.max(0, parts.length - 1)
    const gapFrames = gaps ? Math.max(0, Math.min(0.12 * SR, (available * SR - speechFrames) / gaps)) : 0

    let at = Math.max(Math.round((line.start + LEAD) * SR), lastPlacedEnd)
    const firstAt = at
    const fade = Math.round(0.008 * SR)
    for (const part of parts) {
      const frames = Math.min(Math.round(part.frames), outFrames - at)
      const from = Math.round(part.from * SR)
      for (let f = 0; f < frames; f++) {
        const gain = f < fade ? f / fade : f >= frames - fade ? (frames - 1 - f) / fade : 1
        for (let c = 0; c < CH; c++) {
          out[(at + f) * CH + c] = Math.round(src[(from + f) * CH + c] * gain)
        }
      }
      at += Math.round(part.frames) + Math.round(gapFrames)
    }
    if ((at - firstAt) / SR > available + 0.05) {
      console.warn(`  squeezed line still overruns by ${((at - firstAt) / SR - available).toFixed(2)}s: "${line.text}"`)
    }
    speech.push({ start: firstAt / SR, end: (at - (gaps ? Math.round(gapFrames) : 0)) / SR })
    lastPlacedEnd = at
  }

  writeWav(RETIMED, Buffer.from(out.buffer, out.byteOffset, out.byteLength))

  // Measure, then apply one static gain. A loudnorm pass on a track that is
  // half silence would pump the gaps; the level is fixed and known.
  const analysis = await run([
    '-hide_banner', '-i', RETIMED, '-af', `loudnorm=I=${VO_LUFS}:TP=-1.5:LRA=11:print_format=json`, '-f', 'null', '-',
  ])
  const measured = Number(analysis.match(/"input_i"\s*:\s*"?(-?[\d.]+)"?/)?.[1])
  if (!Number.isFinite(measured)) throw new Error('could not measure the voice track')
  const voGain = 10 ** ((VO_LUFS - measured) / 20)
  console.log(`voice: ${measured.toFixed(1)} LUFS -> ${VO_LUFS} LUFS (${(20 * Math.log10(voGain)).toFixed(1)} dB)`)

  // The bed is the picture's own audio, so nothing about the existing mix moves
  // except the 8 dB under each line.
  const musicWavPath = join(WORK, `short-music-${TAG}-48k.wav`)
  await run(['-y', '-i', TARGETS[0].src, '-vn', '-ar', String(SR), '-ac', String(CH), '-c:a', 'pcm_s16le', musicWavPath])
  const musicWav = parseWav(readFileSync(musicWavPath))
  const music = new Int16Array(musicWav.buf.buffer, musicWav.buf.byteOffset + musicWav.off, musicWav.frames * CH)

  const env = new Float32Array(outFrames).fill(1)
  const rampFrames = Math.round(RAMP * SR)
  for (const span of speech) {
    const start = Math.max(0, Math.round(span.start * SR))
    const end = Math.min(outFrames, Math.round(span.end * SR))
    for (let f = Math.max(0, start - rampFrames); f < start; f++) {
      env[f] = Math.min(env[f], 1 + (DUCK - 1) * ((f - (start - rampFrames)) / rampFrames))
    }
    for (let f = start; f < end; f++) env[f] = Math.min(env[f], DUCK)
    for (let f = end; f < Math.min(outFrames, end + rampFrames); f++) {
      env[f] = Math.min(env[f], DUCK + (1 - DUCK) * ((f - end) / rampFrames))
    }
  }

  const mix = new Float32Array(outFrames * CH)
  let peak = 0
  for (let f = 0; f < outFrames; f++) {
    for (let c = 0; c < CH; c++) {
      const i = f * CH + c
      const v = (music[i] ?? 0) / 32768 * env[f] + (out[i] ?? 0) / 32768 * voGain
      mix[i] = v
      peak = Math.max(peak, Math.abs(v))
    }
  }
  // Peak-guard rather than a limiter: the two sources never both peak, so a
  // single scalar keeps the voice/bed relationship the ducking just set. The
  // ceiling is -1.5 dBFS, not 0, because the deliverable is an AAC file that
  // platforms will transcode again.
  const guard = peak > 0.84 ? 0.84 / peak : 1
  if (guard < 1) console.log(`peak ${(20 * Math.log10(peak)).toFixed(1)} dBFS -> guard ${(20 * Math.log10(guard)).toFixed(1)} dB`)
  const mixed = new Int16Array(outFrames * CH)
  for (let i = 0; i < mixed.length; i++) mixed[i] = Math.round(Math.max(-1, Math.min(1, mix[i] * guard)) * 32767)
  writeWav(FINAL_AUDIO, Buffer.from(mixed.buffer, mixed.byteOffset, mixed.byteLength))

  for (const target of TARGETS) {
    if (!existsSync(target.src)) throw new Error(`missing ${target.src}`)
    await run([
      '-y', '-i', target.src, '-i', FINAL_AUDIO,
      '-map', '0:v:0', '-map', '1:a:0',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k',
      '-shortest', '-movflags', '+faststart', target.out,
    ])
    console.log(`-> ${target.out}`)
  }
}

await main()
