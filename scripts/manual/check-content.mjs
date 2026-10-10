// Checks the handbook assembles cleanly: chapters numbered 1..N with no gaps or repeats, every image the book
// references present in screens/, and no image in screens/ that nothing references.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHAPTERS, APPENDICES, FIND_DEFAULTS } from './book-content.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const problems = []

const nums = CHAPTERS.map((c) => c.num)
const expected = nums.map((_, i) => i + 1)
if (nums.join() !== expected.join()) problems.push(`chapter numbers are not 1..${nums.length} in order: ${nums.join(',')}`)
if (new Set(nums).size !== nums.length) problems.push('duplicate chapter numbers')
const ids = CHAPTERS.map((c) => c.id)
if (new Set(ids).size !== ids.length) problems.push(`duplicate chapter ids: ${ids.filter((v, i) => ids.indexOf(v) !== i)}`)

const letters = APPENDICES.map((a) => a.letter).join('')
if (letters !== 'ABC') problems.push(`appendices are ${letters}, expected ABC`)

const byId = new Map([...CHAPTERS, ...APPENDICES].map((c) => [c.id, c]))
for (const [task, id] of FIND_DEFAULTS) {
  if (!byId.has(id)) problems.push(`finder entry "${task}" points at unknown id "${id}"`)
}

// Every shot() and every ../screens/ reference must resolve to a file on disk.
const referenced = new Set()
for (const c of [...CHAPTERS, ...APPENDICES]) {
  for (const m of c.html.matchAll(/shot\('([a-z0-9-]+)'/g)) referenced.add(m[1])
  for (const m of c.html.matchAll(/\.\.\/screens\/([a-z0-9-]+)\.jpg/g)) referenced.add(m[1])
}
const onDisk = new Set((await fs.readdir(path.join(here, 'screens'))).filter((f) => f.endsWith('.jpg')).map((f) => f.slice(0, -4)))

for (const name of referenced) if (!onDisk.has(name)) problems.push(`chapter text uses screens/${name}.jpg, which does not exist`)
for (const name of onDisk) if (!referenced.has(name)) problems.push(`screens/${name}.jpg is never used by the book`)

// In-text cross references to chapters must point at a chapter that exists.
for (const c of [...CHAPTERS, ...APPENDICES]) {
  for (const m of c.html.matchAll(/Chapter (\d+)/g)) {
    const n = Number(m[1])
    if (n < 1 || n > CHAPTERS.length) problems.push(`"${c.id}" refers to Chapter ${n}, which does not exist`)
  }
}

console.log(`chapters: ${CHAPTERS.length}, appendices: ${APPENDICES.length}, finder entries: ${FIND_DEFAULTS.length}`)
console.log(`images referenced: ${referenced.size}, images on disk: ${onDisk.size}`)
if (problems.length) {
  console.log(`\n${problems.length} PROBLEM(S):`)
  for (const p of problems) console.log('  -', p)
  process.exit(1)
}
console.log('\nAll checks passed.')