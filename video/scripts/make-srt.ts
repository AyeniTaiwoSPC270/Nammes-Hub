import fs from 'node:fs'
import path from 'node:path'
import { BEATS, FPS } from '../src/beats'

// Captions are the script, not a subtitle for a voiceover, so they are derived
// from the same BEATS the scenes read. Timings are the beat's own span, which is
// exactly how long each line is on screen.
const stamp = (frames: number) => {
  const totalMs = Math.round((frames / FPS) * 1000)
  const ms = totalMs % 1000
  const totalSeconds = Math.floor(totalMs / 1000)
  const s = totalSeconds % 60
  const m = Math.floor(totalSeconds / 60) % 60
  const h = Math.floor(totalSeconds / 3600)
  const pad = (n: number, width = 2) => String(n).padStart(width, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`
}

// Cues are pulled two frames before the cut: players stack abutting cues, so a
// line that ends exactly where the next begins shows both for a frame.
const cues = BEATS.flatMap((beat) => {
  const lines = [beat.line1, beat.line2].filter(Boolean) as string[]
  if (lines.length === 0) return []
  const end = beat.from + Math.max(1, beat.durationInFrames - 2)
  return [`${stamp(beat.from)} --> ${stamp(end)}\n${lines.join('\n')}`]
})

const body = cues.map((cue, index) => `${index + 1}\n${cue}\n`).join('\n')
const outPath = path.resolve('out/nammes-hub-launch-60.srt')
fs.writeFileSync(outPath, body, 'utf8')
console.log('wrote', outPath, cues.length + ' cues')
