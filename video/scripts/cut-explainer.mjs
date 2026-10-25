/**
 * Cuts the 2:38 explainer down to a ~104.7s short cut: the live-quiz block, the
 * Annual Departmental Poll, the admin awards/quiz beat and the quiz-battle
 * "No account / Just a nickname" card are removed; everything else is kept.
 *
 * HOW THE SEAMS STAY INVISIBLE (second pass — the first one read as chopped):
 *   - There are only four drop points and every one sits exactly on a wipe the
 *     source already has (the `wipes` list in
 *     out/review/caption-scan/windows.json). The outgoing segment ends on the
 *     frame before a wipe starts and the incoming one opens on that wipe, so a
 *     join reads as a transition the original edit made — never a mid-scene
 *     jump. The earlier table trimmed ~0.2s slivers out of continuous scenes
 *     at a dozen seams; those are gone.
 *   - The quiz seam is 87.70, the wipe where the LIVE QUIZ lobby appears. The
 *     first pass ran to 88.78 because "Live quiz!" cross-fades in *during*
 *     that wipe, which the old detector could not see — so ~1s of the quiz
 *     scene survived the cut.
 *   - Every seam also sits in a caption gap, so no burned caption is cut
 *     mid-read, and the cold open keeps its 2.0s freeze on the stamps (the one
 *     hold in the piece).
 *   - Nothing is sped up: every segment plays at 1x.
 *
 * The VO stays dropped, and the music is no longer sliced to follow the cut at
 * all: out/audio-gen/music-short.wav is *generated* for this exact timeline by
 * `node scripts/make-music.mjs --duration 104.65 …`, so the bed is one
 * continuous performance and nothing in the audio can give away a splice.
 *
 * SOURCE_CAPTIONS mirrors the burned-in pill exactly (regenerated from
 * out/review/caption-scan/windows.json after the wipe-tolerant re-scan; it now
 * carries "Live quiz!" and the endcard's typed URL). Captions inside dropped
 * regions fall out of the mapping automatically, and the SRT is generated from
 * the same mapping the video is cut by.
 *
 * Segment/caption times are seconds in the SOURCE explainer (both ratios share
 * one timeline).
 *
 * Usage: node scripts/cut-explainer.mjs [--dry]
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'

const ffmpeg = fileURLToPath(
  new URL('../node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe', import.meta.url),
)
const DRY = process.argv.includes('--dry')

const FPS = 30

/**
 * source start, source end, optional freeze-frame hold (seconds).
 * Every `e` except the last sits on a wipe start and every `s` except the
 * first sits on a wipe start, so each join is a transition, not a splice.
 */
const SEGMENTS = [
  { s: 0.0, e: 8.9, hold: 2.0 }, // cold open: chat → timetable → deadline → both stamps, then hold
  { s: 9.2, e: 73.70 },          // logo → meet → academics → outlines → timetables → CGPA → resources → events → news → opportunities
  { s: 82.70, e: 87.70 },        // forms fill + share by QR (opened by its 82.70 wipe, closed by the 87.70 quiz wipe)
  { s: 127.70, e: 136.70 },      // admin dashboard → publish news → design a form
  { s: 142.70, e: 157.95 },      // excos → built for the chapter → endcard
]
// The four dropped spans: 73.70–82.70 poll, 87.70–127.70 quiz,
// 136.70–142.70 awards/quiz-admin, plus 8.90–9.20 which the freeze covers.

/** Burned-in caption windows in SOURCE time: [from, to, text] (blank windows omitted). */
const SOURCE_CAPTIONS = [
  [0.27, 1.97, 'Who has the outline?'],
  [2.47, 3.97, 'Is this the timetable?'],
  [4.43, 5.97, 'Due today?!'],
  [6.47, 7.7, "Where's the outline?"],
  [7.93, 8.97, "When's the exam?"],
  [9.47, 10.57, 'NAMMES Hub.'],
  [10.8, 11.97, 'One address.'],
  [12.47, 14.67, 'Meet NAMMES Hub, the website'],
  [14.9, 16.97, 'of NAMMES, UNILAG chapter.'],
  [17.47, 20.4, 'Academics, Community, Forms, Contact.'],
  [20.6, 21.97, 'No more wahala.'],
  [22.47, 24.73, "You don't need an account to browse."],
  [24.97, 26.97, 'Signing up takes about a minute.'],
  [27.47, 31.1, 'Pick your level, then semester, then course.'],
  [31.33, 33.97, 'C is compulsory, E is elective.'],
  [34.47, 36.8, 'Open a course for its topics,'],
  [37.17, 39.97, 'recommended texts and past questions.'],
  [40.47, 43.97, 'The official CCMAS curriculum, right there.'],
  [44.47, 46.77, 'Class and exam timetables.'],
  [47.0, 48.97, 'No more asking around.'],
  [49.47, 51.17, 'Punch in your grades and'],
  [51.4, 53.17, 'watch your CGPA count up.'],
  [53.4, 54.9, 'Sign in to save them,'],
  [55.13, 56.97, 'then download your report.'],
  [57.43, 58.27, 'Resources:'],
  [58.5, 60.07, 'Shared Drive links and'],
  [60.3, 62.0, 'materials, one tap away.'],
  [62.47, 64.6, 'Events, with photo galleries so'],
  [64.83, 66.47, 'you can relive the day.'],
  [66.97, 69.47, 'News, straight from the excos.'],
  [70.1, 73.47, 'Opportunities, sorted by soonest deadline.'],
  [73.97, 77.27, 'Five stages, from nominating to revealed.'], // poll — cut
  [77.5, 80.13, 'Members with a department matric'], // poll — cut
  [80.37, 82.47, 'number get one vote each.'], // poll — cut
  [82.93, 83.63, 'Forms:'],
  [83.87, 85.7, 'fill one in, or share'],
  [85.93, 87.47, 'it by link or QR.'],
  [87.9, 88.7, 'Live quiz!'], // quiz — cut; missed by the old detector, leaked into pass 1
  [88.93, 90.67, 'Scan the code, pop into the'], // quiz — cut
  [90.9, 92.7, 'lobby and pick your fighter.'], // quiz — cut
  [92.93, 94.97, 'Fifty characters to choose from.'], // quiz — cut
  [95.47, 98.1, 'Question up, timer running.'], // quiz — cut
  [98.33, 100.47, 'Tap your answer fast!'], // quiz — cut
  [101.1, 104.0, 'Bars rise, the leaderboard shuffles.'], // quiz — cut
  [104.23, 105.47, "Who's on top?"], // quiz — cut
  [105.97, 108.1, 'Play in teams, build a streak for'], // quiz — cut
  [108.33, 110.47, 'bonus points, go double or 50/50.'], // quiz — cut
  [110.97, 112.03, 'Quiz battles:'], // quiz — cut
  [112.27, 114.47, 'challenge a friend to a duel.'], // quiz — cut
  [114.97, 118.47, 'Or run a knockout bracket.'], // quiz — cut
  [119.1, 121.97, 'Last one standing takes the podium.'], // quiz — cut
  [122.4, 123.47, 'No account.'], // quiz-battle card — cut
  [123.67, 125.03, 'Just a nickname.'], // quiz-battle card — cut
  [125.27, 127.47, 'Send the link and let us go.'], // quiz — cut
  [127.97, 129.13, 'The excos run it'],
  [129.37, 130.97, 'all from one dashboard.'],
  [131.43, 133.47, 'Publish news.'],
  [133.97, 136.47, 'Design a form.'],
  [136.97, 139.47, 'Move awards through the stages'], // awards beat — cut
  [139.97, 142.47, 'Host a live quiz.'], // awards beat — cut
  [142.97, 147.97, 'Meet the excos, the AEGIS 26/27 council.'],
  [148.47, 151.47, 'Built by students, for students.'],
  // The source types the domain across three pills ("…nammeshub." / "com." /
  // "ng."); the SRT says it once, whole, over that run.
  [151.97, 155.37, 'NAMMES Hub, at nammeshub.com.ng'],
  [155.5, 157.97, 'Grab the Handbook in the footer.'],
]

const SOURCES = [
  { name: '169', src: 'out/nammes-hub-explainer-16x9-v2.mp4', out: 'out/nammes-hub-explainer-short-16x9.mp4' },
  { name: '916', src: 'out/nammes-hub-explainer-9x16.mp4', out: 'out/nammes-hub-explainer-short-9x16.mp4' },
]
/**
 * Same crest-and-wordmark beat the previous poster used: source 11.2s now
 * lands at out 12.9 after the cold open grew by the hold + seam repairs.
 */
const POSTER_TIME = 12.9
/**
 * Voice-free music bed, generated for this cut's own timeline rather than
 * sliced from the source's — see make-music.mjs, called with --duration 104.65
 * and the section marks from this table's out-times.
 */
const MUSIC_BED = 'out/audio-gen/music-short.wav'
const AUDIO_SR = 48000
const CH = 2

function run(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpeg, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let err = ''
    p.stdout.on('data', (d) => { err += d })
    p.stderr.on('data', (d) => { err += d })
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}\n${err.slice(-2000)}`))))
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
    if (id === 'fmt ') fmt = { pos: pos + 8, size }
    if (id === 'data') data = { pos: pos + 8, size }
    pos += 8 + size + (size % 2)
  }
  if (!fmt || !data) throw new Error('missing fmt/data')
  const format = buf.readUInt16LE(fmt.pos)
  const channels = buf.readUInt16LE(fmt.pos + 2)
  const rate = buf.readUInt32LE(fmt.pos + 4)
  const bits = buf.readUInt16LE(fmt.pos + 14)
  if (format !== 1 || bits !== 16 || channels !== CH || rate !== AUDIO_SR) {
    throw new Error(`unexpected wav: fmt=${format} ch=${channels} rate=${rate} bits=${bits}`)
  }
  return { samples: data.size / 4, buf, off: data.pos }
}

function writeWav(path, data) {
  const dataBytes = data.length // data is the raw interleaved s16 frame buffer
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataBytes, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(CH, 22)
  header.writeUInt32LE(AUDIO_SR, 24)
  header.writeUInt32LE(AUDIO_SR * CH * 2, 28)
  header.writeUInt16LE(CH * 2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataBytes, 40)
  writeFileSync(path, Buffer.concat([header, data]))
}

const stamp = (t) => {
  const ms = Math.round(t * 1000)
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const rest = String(ms % 1000).padStart(3, '0')
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${rest}`
}

/**
 * Maps every source caption onto output time by walking the segment table the
 * video is actually cut with. A caption sliced by a seam comes back as one
 * merged out range (out time is contiguous across a seam), a caption inside a
 * dropped region never appears, and a caption covering a frozen frame keeps
 * showing for the hold.
 */
function mapCaptions() {
  const emissions = []
  let cursor = 0
  for (const seg of SEGMENTS) {
    const hold = seg.hold ?? 0
    for (const [from, to, text] of SOURCE_CAPTIONS) {
      const visFrom = Math.max(from, seg.s)
      const visTo = Math.min(to, seg.e)
      if (visTo <= visFrom) continue
      const coversEnd = from < seg.e && to >= seg.e
      const outFrom = cursor + (visFrom - seg.s)
      let outTo = cursor + (visTo - seg.s) + (coversEnd ? hold : 0)
      const prev = emissions[emissions.length - 1]
      if (prev && prev.text === text && outFrom <= prev.to + 0.05) {
        prev.to = Math.max(prev.to, outTo) // same caption seen across a seam
      } else {
        emissions.push({ from: outFrom, to: outTo, text })
      }
    }
    cursor += seg.e - seg.s + hold
  }
  const emitted = new Set(emissions.map((e) => e.text))
  const dropped = SOURCE_CAPTIONS.filter(([, , text]) => !emitted.has(text))
    .map(([from, to, text]) => ({ from, to, text }))
  return { outCaptions: emissions, dropped, totalOut: cursor }
}

function writeSrt(path, outCaptions) {
  const body = outCaptions.map(
    ({ from, to, text }, index) => `${index + 1}\n${stamp(from)} --> ${stamp(to)}\n${text}\n`,
  ).join('\n')
  writeFileSync(path, body)
}

async function cutRatio({ name, src, out }) {
  const dir = join('out', 'short-build', name)
  mkdirSync(dir, { recursive: true })

  if (!existsSync(MUSIC_BED)) {
    throw new Error(`missing ${MUSIC_BED} — generate it with scripts/make-music.mjs (see the header)`)
  }
  const bed = parseWav(readFileSync(MUSIC_BED))

  const vids = []
  SEGMENTS.forEach((seg) => {
    // Keyed by source range (and hold) so a resumed run can never pair an old
    // segment with a new slot after the table above changes.
    const key = `seg-${seg.s.toFixed(2)}-${seg.e.toFixed(2)}${seg.hold ? `-h${seg.hold}` : ''}`
    vids.push(join(dir, `${key}.mp4`))
  })

  const holdClips = SEGMENTS.map((seg, i) => (seg.hold ? join(dir, `hold-${i}.mp4`) : null))

  for (let i = 0; i < SEGMENTS.length; i++) {
    const { s, e, hold = 0 } = SEGMENTS[i]
    const dur = e - s
    // Segments are deterministic, so an existing set survives a rerun and the
    // script can resume after a failure without re-encoding everything.
    const complete = existsSync(vids[i]) && (!hold || existsSync(holdClips[i]))
    if (!complete) {
      await run([
        '-y', '-ss', String(s), '-i', src, '-t', String(dur),
        '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '16',
        '-pix_fmt', 'yuvj420p', vids[i],
      ])
      if (hold > 0) {
        // No tpad/setpts in Remotion's bundled ffmpeg: clone the segment's
        // final frame into a still clip that plays right after it in the list.
        const frames = Math.round(dur * FPS)
        const lastT = s + (frames - 1) / FPS - 0.005
        const frame = join(dir, `hold-${i}.png`)
        await run(['-y', '-ss', lastT.toFixed(4), '-i', src, '-frames:v', '1', frame])
        await run([
          '-y', '-loop', '1', '-framerate', String(FPS), '-t', String(hold),
          '-i', frame, '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '16',
          '-pix_fmt', 'yuvj420p', holdClips[i],
        ])
      }
    }
  }

  const listPath = join(dir, 'list.txt')
  // The concat demuxer resolves entries against the list file's directory, so
  // these must be bare filenames rather than the project-relative ones.
  // A frozen hold is its own entry, directly after the cut it extends.
  const entries = []
  SEGMENTS.forEach((seg, i) => {
    entries.push(`file '${basename(vids[i])}'`)
    if (seg.hold) entries.push(`file '${basename(holdClips[i])}'`)
  })
  writeFileSync(listPath, entries.join('\n'))
  const merged = join(dir, 'video.mp4')
  await run(['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', merged])

  const total = SEGMENTS.reduce((n, seg) => n + (seg.e - seg.s) + (seg.hold ?? 0), 0)
  const needed = Math.round(total * AUDIO_SR)
  if (bed.samples < needed) {
    throw new Error(`music bed is ${(bed.samples / AUDIO_SR).toFixed(2)}s, shorter than the ${total.toFixed(2)}s cut`)
  }
  const mixed = join(dir, 'mix.wav')
  // The bed plays straight through — no splices anywhere in the audio, so
  // nothing in the sound can tell a viewer where the picture was cut.
  writeWav(mixed, bed.buf.subarray(bed.off, bed.off + needed * CH * 2))

  await run([
    '-y', '-i', merged, '-i', mixed,
    '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k',
    // Same loudness target the original explainer mix used.
    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', String(AUDIO_SR),
    '-shortest', '-movflags', '+faststart', out,
  ])
  await run(['-y', '-ss', String(POSTER_TIME), '-i', out, '-frames:v', '1', out.replace(/\.mp4$/, '-poster.png')])
  return total
}

const { outCaptions, dropped, totalOut } = mapCaptions()
const totalDur = SEGMENTS.reduce((n, seg) => n + (seg.e - seg.s) + (seg.hold ?? 0), 0)
console.log(`${SEGMENTS.length} segments, ${totalDur.toFixed(2)}s target, ${outCaptions.length} captions (${dropped.length} dropped with the cut sections)`)

const rushWarnings = outCaptions.filter((c) => c.to - c.from < 0.9)
if (rushWarnings.length) {
  for (const c of rushWarnings) {
    console.warn(`  RUSHED: "${c.text}" visible only ${(c.to - c.from).toFixed(2)}s`)
  }
} else {
  console.log(`slowest caption OK — every caption visible ≥ 0.9s`)
}
for (const d of dropped) {
  console.log(`  dropped: "${d.text}" (${d.from}s source)`)
}
if (Math.abs(totalOut - totalDur) > 0.001) throw new Error('caption map length mismatch')

if (DRY) {
  console.log('dry run — not cutting')
} else {
  for (const source of SOURCES) {
    if (!existsSync(source.src)) {
      console.error(`missing source: ${source.src}`)
      process.exit(1)
    }
    console.log(`\ncutting ${source.src} …`)
    await cutRatio(source)
    console.log(`  -> ${source.out}`)
  }
  writeSrt('out/nammes-hub-explainer-short.srt', outCaptions)
  console.log(`\nwrote out/nammes-hub-explainer-short.srt (${outCaptions.length} captions)`)
}
