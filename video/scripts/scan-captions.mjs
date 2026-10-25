/**
 * Detects when the burned-in caption pill flips in the source explainer.
 *
 * Frames are piped out as PNGs and diffed here: a caption flip
 * changes only the bottom band of the frame, while a scene change or wipe
 * changes the whole frame. Clustering band-only spikes gives the caption
 * windows — the ground truth the SRT must mirror and the timing data the cut
 * uses so no caption is ever cut mid-read.
 *
 * Usage: node scripts/scan-captions.mjs [source]
 * Writes out/review/caption-scan.json and per-window crops to out/review/caption-band/.
 */
import { spawn, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { mkdirSync, writeFileSync, readdirSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

const ffmpeg = fileURLToPath(
  new URL('../node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe', import.meta.url),
)
const SRC = process.argv[2] ?? 'out/nammes-hub-explainer-16x9-v2.mp4'
const W = 192
const H = 108
const BAND_TOP = Math.floor(H * 0.84) // the caption pill lives in the bottom 16%

mkdirSync('out/review/caption-scan', { recursive: true })
mkdirSync('out/review/caption-band', { recursive: true })

/** Minimal PNG reader: 8-bit RGB/RGBA, non-interlaced — all the encoder emits here. */
function decodePng(buf) {
  let pos = 8
  let width = 0
  let height = 0
  let bpp = 0
  const idat = []
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      const depth = data[8]
      const color = data[9]
      const interlace = data[12]
      if (depth !== 8 || interlace !== 0 || (color !== 2 && color !== 6)) {
        throw new Error(`unsupported png: depth=${depth} color=${color} interlace=${interlace}`)
      }
      bpp = color === 6 ? 4 : 3
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    pos += 12 + len
  }
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * bpp
  const out = Buffer.alloc(height * stride)
  let src = 0
  for (let y = 0; y < height; y++) {
    const filter = raw[src++]
    const row = out.subarray(y * stride, (y + 1) * stride)
    raw.copy(row, 0, src, src + stride)
    src += stride
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? row[i - bpp] : 0
      const b = y > 0 ? row[i - stride] : 0
      const c = y > 0 && i >= bpp ? row[i - stride - bpp] : 0
      if (filter === 1) row[i] = (row[i] + a) & 255
      else if (filter === 2) row[i] = (row[i] + b) & 255
      else if (filter === 3) row[i] = (row[i] + ((a + b) >> 1)) & 255
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        row[i] = (row[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255
      }
    }
  }
  return { width, height, bpp, pixels: out }
}

function luma(img, rowStart, rowEnd) {
  const { width, bpp, pixels } = img
  let sum = 0
  let n = 0
  for (let y = rowStart; y < rowEnd; y += 2) {
    const at = y * width * bpp
    for (let x = 0; x < width * bpp; x += 3 * bpp) {
      sum += pixels[at + x]
      n++
    }
  }
  return sum / n
}

function diffFrames(prev, cur) {
  const whole = Math.abs(luma(cur, 0, H) - luma(prev, 0, H))
  const band = Math.abs(luma(cur, BAND_TOP, H) - luma(prev, BAND_TOP, H))
  return { whole, band }
}

function scanFrames() {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpeg, [
      '-y', '-loglevel', 'error', '-i', SRC, '-r', '30',
      '-vf', `scale=${W}:${H}`, '-pix_fmt', 'rgb24', '-c:v', 'png', '-f', 'image2pipe', '-',
    ], { stdio: ['ignore', 'pipe', 'pipe'] })
    const series = []
    let pending = Buffer.alloc(0)
    let prev = null
    let frameIndex = 0
    // image2pipe png: concatenated PNG files, each starting with the 8-byte signature.
    const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    function frames() {
      for (;;) {
        if (pending.length < 8) return
        const sigAt = pending.indexOf(SIG)
        if (sigAt < 0) { pending = pending.subarray(pending.length - 7); return }
        pending = pending.subarray(sigAt)
        // Find the end of this PNG: IEND chunk.
        const iend = pending.indexOf('IEND')
        if (iend < 0) return
        const end = iend + 8 // type + CRC
        if (pending.length < end) return
        const frame = decodePng(pending.subarray(0, end))
        pending = pending.subarray(end)
        if (prev) series.push({ t: frameIndex / 30, ...diffFrames(prev, frame) })
        prev = frame
        frameIndex++
      }
    }
    p.stdout.on('data', (chunk) => { pending = Buffer.concat([pending, chunk]); frames() })
    p.stderr.on('data', () => {})
    p.on('close', (code) => { frames(); code === 0 ? resolve(series) : reject(new Error(`ffmpeg exit ${code}`)) })
  })
}

const series = await scanFrames()
const bandMax = Math.max(...series.map((s) => s.band))
const wholeMax = Math.max(...series.map((s) => s.whole))

// Every band spike is a boundary, wipe or not. The old detector also required
// the whole frame to stay calm, which silently dropped every caption flip that
// happened during a transition — that is how "Live quiz!" went unrecorded and
// a second of the quiz scene survived the cut. Calibrated on the source:
// flips sit at band 3–13, wipes in the hundreds; both are boundaries.
// 3.2 was too high: a caption that cross-fades in over 0.3s moves the band by
// only 1.7–3.2 per frame, so slow flips ("Live quiz!" at 87.8) slipped under
// it. The band is dead-still between events (p50 = 0.01), so a floor of 1.0
// catches the fades at almost no cost in false boundaries.
const events = series.filter((s) => s.band > 1.0)

const bounds = []
for (const e of events) {
  const last = bounds[bounds.length - 1]
  if (last && e.t - last.tEnd < 0.34) { last.tEnd = e.t; last.peak = Math.max(last.peak, e.band) }
  else bounds.push({ tStart: e.t, tEnd: e.t, peak: e.band })
}

// Scene transitions, taken from the whole-frame spikes. A seam parked just
// after a wipe finishes is the smoothest place to cut, so these are the
// candidate edit points for the short cut.
const wipes = []
for (const e of series.filter((s) => s.whole > 12)) {
  const last = wipes[wipes.length - 1]
  if (last && e.t - last.tEnd < 0.25) { last.tEnd = e.t; last.peak = Math.max(last.peak, e.whole) }
  else wipes.push({ tStart: e.t, tEnd: e.t, peak: e.whole })
}

const windows = bounds.map((b, i) => ({
  from: Number(b.tEnd.toFixed(2)),
  to: i === bounds.length - 1 ? null : Number(bounds[i + 1].tStart.toFixed(2)),
}))
writeFileSync('out/review/caption-scan/series.json', JSON.stringify(series))
writeFileSync('out/review/caption-scan/windows.json', JSON.stringify({ bandMax, wholeMax, bounds, windows, wipes }, null, 2))
console.log(`${series.length} frames, ${bounds.length} boundaries, ${wipes.length} wipes, bandMax=${bandMax.toFixed(2)} wholeMax=${wholeMax.toFixed(2)}`)
console.log(`wipes: ${wipes.map((w) => `${w.tStart.toFixed(2)}-${w.tEnd.toFixed(2)}`).join(' ')}`)

const crops = readdirSync('out/review/caption-band')
for (let i = 0; i < windows.length; i++) {
  const w = windows[i]
  if (w.to === null || w.to - w.from < 0.2) continue
  const mid = ((w.from + w.to) / 2).toFixed(2)
  const name = `${String(i).padStart(2, '0')}-${mid}.png`
  if (crops.includes(name)) continue
  execFileSync(ffmpeg, [
    '-y', '-loglevel', 'error', '-ss', mid, '-i', SRC,
    '-vf', 'crop=iw:ih*0.16:0:ih*0.84,scale=600:-2', '-frames:v', '1',
    `out/review/caption-band/${name}`,
  ])
}
console.log(`wrote windows.json and band crops`)
