/**
 * Maps the structure of a rendered explainer by decoding it to tiny grayscale
 * frames and reporting the biggest frame-to-frame differences. Remotion's
 * bundled ffmpeg has no `select`/`showinfo` filters and no rawvideo muxer, so
 * the frames go through a temp AVI that this script walks chunk by chunk.
 *
 * Usage: node scripts/map-explainer.mjs <video> [threshold]
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ffmpeg = fileURLToPath(
  new URL('../node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe', import.meta.url),
)

const [, , input, thresholdArg] = process.argv
if (!input) {
  console.error('usage: node scripts/map-explainer.mjs <video> [threshold]')
  process.exit(1)
}
const THRESHOLD = Number(thresholdArg ?? 9)
const W = 48
const H = 27
const FRAME = W * H
const FPS = 30
const tmp = join(tmpdir(), `map-explainer-${process.pid}.avi`)

const proc = spawn(ffmpeg, [
  '-y',
  '-i', input,
  '-an',
  '-vf', `scale=${W}:${H}`,
  '-pix_fmt', 'gray',
  '-c:v', 'rawvideo',
  '-f', 'avi',
  tmp,
], { stdio: ['ignore', 'ignore', 'pipe'] })

let stderr = ''
proc.stderr.on('data', (c) => { stderr += c })

proc.on('close', (code) => {
  if (code !== 0) {
    console.error(stderr.slice(-800))
    process.exit(code ?? 1)
  }
  try {
    analyse(tmp)
  } finally {
    rmSync(tmp, { force: true })
  }
})

function walkMovi(buf, start, end, onFrame) {
  let pos = start
  while (pos + 8 <= end) {
    const id = buf.toString('ascii', pos, pos + 4)
    const size = buf.readUInt32LE(pos + 4)
    if (id === '00db' || id === '00dc') {
      if (size >= FRAME) onFrame(buf.subarray(pos + 8, pos + 8 + FRAME))
      pos += 8 + size + (size % 2)
    } else if (id === 'LIST') {
      const type = buf.toString('ascii', pos + 8, pos + 12)
      if (type === 'movi') walkMovi(buf, pos + 12, pos + 8 + size, onFrame)
      pos += 8 + size + (size % 2)
    } else {
      pos += 8 + size + (size % 2)
    }
  }
}

function analyse(path) {
  const buf = readFileSync(path)
  const diffs = []
  let prev = null
  let frames = 0
  walkMovi(buf, 12, buf.length, (frame) => {
    if (prev) {
      let sum = 0
      for (let i = 0; i < FRAME; i++) sum += Math.abs(frame[i] - prev[i])
      diffs.push(sum / FRAME)
    }
    prev = Buffer.from(frame)
    frames += 1
  })

  console.log(`${input}: ${frames} frames (${(frames / FPS).toFixed(2)}s), ${diffs.length} pairs`)

  // A hard cut is a local maximum well above its neighbours.
  const cuts = []
  for (let i = 1; i < diffs.length - 1; i++) {
    const d = diffs[i]
    if (d >= THRESHOLD && d >= diffs[i - 1] && d >= diffs[i + 1]) {
      cuts.push({ frame: i + 1, time: (i + 1) / FPS, diff: d })
    }
  }
  // Cuts closer than 0.5s apart collapse to the stronger one.
  const merged = []
  for (const cut of cuts) {
    const last = merged[merged.length - 1]
    if (last && cut.frame - last.frame < FPS * 0.5) {
      if (cut.diff > last.diff) merged[merged.length - 1] = cut
    } else {
      merged.push(cut)
    }
  }
  console.log(`\n${merged.length} cuts (threshold ${THRESHOLD}):`)
  for (const cut of merged) {
    console.log(`  ${cut.time.toFixed(2)}s  frame ${cut.frame}  diff ${cut.diff.toFixed(1)}`)
  }
  const sorted = [...diffs].sort((a, b) => b - a).slice(0, 15)
  console.log(`\ntop diffs: ${sorted.map((d) => d.toFixed(1)).join(' ')}`)
}
