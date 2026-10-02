// Turns the audio you generated in the ElevenLabs web app into the per-beat clips the video plays (public/vo/*.wav).
// Two ways to supply audio, in video/voice-elevenlabs/:
//   1. ONE file (any name, mp3 or wav) made from voiceover-elevenlabs.txt: it is split at the long pauses into 35 clips.
//   2. One file per beat named <scene>-<beat>.mp3 (e.g. cold-chat.mp3): used as they are.
// Each clip is trimmed of silence and sped up slightly (max x1.25) if it is longer than its beat.
// Usage: npx tsx scripts/import-voice.ts
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { BEAT_SECONDS, SCENE_ORDER } from '../src/constants'
import { VO } from '../src/script'

const root = join(__dirname, '..')
const src = join(root, 'voice-elevenlabs')
const tmp = join(root, 'out', 'voice-import')
const pub = join(root, 'public', 'vo')
const BIN = join(root, 'node_modules', '@remotion', 'compositor-win32-x64-msvc')
const FFMPEG = join(BIN, 'ffmpeg.exe')
const FFPROBE = join(BIN, 'ffprobe.exe')
const SR = 44100

const run = (bin: string, args: string[]) => {
  const r = spawnSync(`"${bin}"`, args, { shell: true, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`${bin} ${args.join(' ')}\n${r.stderr}`)
  return r
}
const ff = (args: string[]) => run(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args])
const dur = (f: string) => Number(run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', `"${f}"`]).stdout.trim())

// speech regions in a file: [start, end] pairs between silences of at least `minGap` seconds
function regions(file: string, minGap: number, db = -42): [number, number][] {
  const total = dur(file)
  const r = spawnSync(`"${FFMPEG}"`, ['-hide_banner', '-i', `"${file}"`, '-af', `silencedetect=n=${db}dB:d=${minGap}`, '-f', 'null', '-'], { shell: true, encoding: 'utf8' })
  const log = r.stderr || ''
  const starts = [...log.matchAll(/silence_start: (-?[\d.]+)/g)].map((m) => Math.max(0, Number(m[1])))
  const ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]))
  const out: [number, number][] = []
  let from = 0
  // the first silence may start at 0 (leading silence)
  for (let i = 0; i < starts.length; i++) {
    if (starts[i] > from + 0.15) out.push([from, starts[i]])
    from = ends[i] ?? total
  }
  if (total - from > 0.15) out.push([from, total])
  return out
}

function main() {
  if (!existsSync(src)) {
    mkdirSync(src, { recursive: true })
    console.log('Created video/voice-elevenlabs/. Put your downloaded ElevenLabs audio in it, then run this again.')
    return
  }
  mkdirSync(tmp, { recursive: true })
  rmSync(pub, { recursive: true, force: true })
  mkdirSync(pub, { recursive: true })

  const beats = SCENE_ORDER.flatMap((scene) => Object.entries(BEAT_SECONDS[scene]).map(([beat, seconds]) => ({ id: `${scene}-${beat}`, seconds: seconds as number })))
  const files = readdirSync(src).filter((f) => /\.(mp3|wav|m4a)$/i.test(f))
  const perBeat = beats.every((b) => files.some((f) => f.toLowerCase().startsWith(b.id + '.')))
  const raw: Record<string, string> = {}

  if (perBeat) {
    for (const b of beats) raw[b.id] = join(src, files.find((f) => f.toLowerCase().startsWith(b.id + '.'))!)
    console.log('Using one file per beat.')
  } else if (files.length === 1) {
    const file = join(src, files[0])
    // Cut at every long pause (>= 0.9 s), then group neighbouring pieces into one clip per line. Which pieces belong
    // together is decided by matching each group's length to the length of its text (a line the voice paused in the middle of
    // would otherwise be split in two).
    const pieces = regions(file, 0.9)
    const N = beats.length
    if (pieces.length < N) {
      console.error(`Found only ${pieces.length} speech pieces but need ${N}. Check that every line kept its <break time="1.5s" /> tag, or supply one file per beat.`)
      process.exit(1)
    }
    const chars = beats.map((bt) => {
      const [scene, beat] = [bt.id.slice(0, bt.id.indexOf('-')), bt.id.slice(bt.id.indexOf('-') + 1)]
      return ((VO as Record<string, Record<string, string>>)[scene][beat] as string).length + 8
    })
    const speech = pieces.reduce((a, [x, y]) => a + (y - x), 0)
    const k = speech / chars.reduce((a, c) => a + c, 0)
    const P = pieces.length
    const cost = (i: number, j: number, line: number) => {
      const len = pieces[j][1] - pieces[i][0]
      return (len - k * chars[line]) ** 2
    }
    // dp[line][end] = best cost placing lines 0..line using pieces 0..end
    const INF = 1e18
    const dp = Array.from({ length: N }, () => new Array(P).fill(INF))
    const from = Array.from({ length: N }, () => new Array(P).fill(-1))
    for (let e = 0; e < P; e++) dp[0][e] = cost(0, e, 0)
    for (let l = 1; l < N; l++)
      for (let e = l; e < P; e++)
        for (let st = l; st <= e; st++) {
          const c = dp[l - 1][st - 1] + cost(st, e, l)
          if (c < dp[l][e]) {
            dp[l][e] = c
            from[l][e] = st
          }
        }
    const segs: [number, number][] = new Array(N)
    let e = P - 1
    for (let l = N - 1; l >= 0; l--) {
      const st = l === 0 ? 0 : from[l][e]
      segs[l] = [pieces[st][0], pieces[e][1]]
      e = st - 1
    }
    console.log(`Split ${files[0]} into ${N} clips (${P} pieces found).`)
    beats.forEach((b, i) => {
      const out = join(tmp, `${b.id}.cut.wav`)
      ff(['-i', `"${file}"`, '-af', `atrim=start=${Math.max(0, segs[i][0] - 0.03).toFixed(3)}:end=${(segs[i][1] + 0.05).toFixed(3)},asetpts=PTS-STARTPTS`, '-ar', String(SR), '-ac', '1', `"${out}"`])
      raw[b.id] = out
    })
  } else {
    console.error(`Expected one combined file or ${beats.length} per-beat files in voice-elevenlabs/, found ${files.length} files.`)
    process.exit(1)
  }

  for (const b of beats) {
    const trimmed = join(tmp, `${b.id}.trim.wav`)
    ff(['-i', `"${raw[b.id]}"`, '-ar', String(SR), '-ac', '1', `"${trimmed}"`])
    const spans = regions(trimmed, 0.4, -45)
    const d = dur(trimmed)
    const from = spans.length ? Math.max(0, spans[0][0] - 0.03) : 0
    const to = spans.length ? Math.min(d, spans[spans.length - 1][1] + 0.05) : d
    const cut = join(tmp, `${b.id}.final.wav`)
    ff(['-i', `"${trimmed}"`, '-af', `atrim=start=${from.toFixed(3)}:end=${to.toFixed(3)},asetpts=PTS-STARTPTS`, `"${cut}"`])
    const len = dur(cut)
    const room = b.seconds - 0.2
    const tempo = len > room ? Math.min(1.25, len / room) : 1
    const out = join(pub, `${b.id}.wav`)
    if (tempo > 1.001) ff(['-i', `"${cut}"`, '-af', `atempo=${tempo.toFixed(3)}`, `"${out}"`])
    else copyFileSync(cut, out)
    const fitted = len / tempo
    console.log(`${b.id}: ${len.toFixed(2)}s, beat ${b.seconds}s${tempo > 1.001 ? `, sped x${tempo.toFixed(2)}` : ''}${fitted > room + 0.05 ? '  <-- TOO LONG: lengthen this beat in constants.ts or shorten the line' : ''}`)
  }
  console.log('Wrote public/vo/. Run `npm run docs` then render.')
}

main()
