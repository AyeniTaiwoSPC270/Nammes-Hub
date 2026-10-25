import { BEATS, FPS, SCENE_NAMES, TOTAL_FRAMES } from '../src/beats'

const errors: string[] = []
const seen = new Set<string>()

BEATS.forEach((beat, index) => {
  if (seen.has(beat.id)) errors.push(`duplicate beat id: ${beat.id}`)
  seen.add(beat.id)

  const expectedFrom = index === 0 ? 0 : BEATS[index - 1].from + BEATS[index - 1].durationInFrames
  if (beat.from !== expectedFrom) {
    errors.push(`beat ${beat.id} starts at ${beat.from}, expected ${expectedFrom}`)
  }
  if (!SCENE_NAMES.includes(beat.scene)) errors.push(`beat ${beat.id} has unknown scene ${beat.scene}`)

  const lines = [beat.line1, beat.line2].filter(Boolean) as string[]
  if (lines.length > 2) errors.push(`beat ${beat.id} has more than two caption lines`)
  const words = lines.join(' ').trim().split(/\s+/).filter(Boolean)
  if (words.length > 7) errors.push(`beat ${beat.id} caption is ${words.length} words (max 7): "${words.join(' ')}"`)
  if (beat.highlight && !lines.some((line) => line.toLowerCase().includes(beat.highlight!.toLowerCase()))) {
    errors.push(`beat ${beat.id} highlight "${beat.highlight}" is not in its caption`)
  }

  const cuts = beat.cuts ?? []
  cuts.forEach((cut, cutIndex) => {
    if (cut >= beat.durationInFrames) errors.push(`beat ${beat.id} cut ${cut} is outside the beat`)
    if (cutIndex > 0 && cut <= cuts[cutIndex - 1]) errors.push(`beat ${beat.id} cuts are not ascending`)
  })
  if (beat.pills.some((pill) => pill.at < 0 || pill.at >= beat.durationInFrames)) {
    errors.push(`beat ${beat.id} has a pill that enters outside the beat`)
  }
})

const last = BEATS[BEATS.length - 1]
const end = last.from + last.durationInFrames
if (end !== TOTAL_FRAMES) errors.push(`timeline ends at ${end} frames, expected ${TOTAL_FRAMES}`)

const row = (cells: Array<string | number>) => cells.map((cell) => String(cell).padEnd(13)).join('')
console.log(row(['#', 'id', 'from', 'frames', 'start', 'end']))
console.log('-'.repeat(78))
BEATS.forEach((beat, index) => {
  const start = (beat.from / FPS).toFixed(2)
  const stop = ((beat.from + beat.durationInFrames) / FPS).toFixed(2)
  console.log(
    row([index + 1, beat.id, beat.from, beat.durationInFrames, `${start}s`, `${stop}s`]),
  )
})
console.log('-'.repeat(78))
console.log(`${BEATS.length} beats, ${end} frames, ${(end / FPS).toFixed(2)}s at ${FPS} fps`)

if (errors.length) {
  console.error('\nFAILED:')
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}
