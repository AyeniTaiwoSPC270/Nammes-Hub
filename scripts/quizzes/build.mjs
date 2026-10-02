// Builds import-ready quiz CSVs (the format Quiz Studio imports) from the plain-text files in ./src.
//
// Source format, one file per course:
//   # Quiz title              starts a new quiz
//   Q|question|A|B|C|D|b      multiple choice, last field is the correct letter (a-d)
//   T|statement|true          true or false
// Run: node scripts/quizzes/build.mjs
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const srcDir = join(here, 'src')
const outDir = join(here, 'csv')
const HEADER = 'type,question,option_a,option_b,option_c,option_d,correct,seconds,points'
const MIN_Q = 10
const MAX_Q = 20

const cell = (v) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Answers are written with the right one in any slot; shuffle so the correct letter is spread evenly.
// Seeded from the question text so a rebuild gives the same files.
function shuffle(list, seed) {
  let h = 2166136261
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0
  const rand = () => {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0
    return h / 4294967296
  }
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const problems = []
const quizzes = []

for (const file of readdirSync(srcDir).filter((f) => f.endsWith('.txt')).sort()) {
  const course = file.replace(/\.txt$/, '')
  let current = null
  readFileSync(join(srcDir, file), 'utf8').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim()
    const where = `${file}:${i + 1}`
    if (!line) return
    if (line.startsWith('#')) {
      current = { course, title: line.replace(/^#\s*/, ''), rows: [] }
      quizzes.push(current)
      return
    }
    if (!current) return problems.push(`${where} question before any "# title"`)
    const parts = line.split('|').map((p) => p.trim())
    if (parts[0] === 'Q') {
      if (parts.length !== 7) return problems.push(`${where} multiple choice needs 7 fields, has ${parts.length}`)
      const [, q, a, b, c, d, ans] = parts
      if (!/^[a-d]$/i.test(ans)) return problems.push(`${where} correct letter must be a-d`)
      if (q.length > 300) problems.push(`${where} question over 300 characters`)
      if (new Set([a, b, c, d].map((x) => x.toLowerCase())).size < 4) problems.push(`${where} duplicate options`)
      const options = [a, b, c, d]
      const right = options['abcd'.indexOf(ans.toLowerCase())]
      const shuffled = shuffle(options, q)
      current.rows.push(['multiple', q, ...shuffled, 'ABCD'[shuffled.indexOf(right)]])
    } else if (parts[0] === 'T') {
      if (parts.length !== 3) return problems.push(`${where} true/false needs 3 fields`)
      const [, q, ans] = parts
      if (!/^(true|false)$/i.test(ans)) return problems.push(`${where} answer must be true or false`)
      current.rows.push(['truefalse', q, '', '', '', '', ans.toLowerCase() === 'true' ? 'True' : 'False'])
    } else problems.push(`${where} line must start with Q| or T|`)
  })
}

for (const q of quizzes) {
  if (q.rows.length < MIN_Q || q.rows.length > MAX_Q) problems.push(`${q.course} "${q.title}" has ${q.rows.length} questions (need ${MIN_Q}-${MAX_Q})`)
}

if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })
const counts = {}
quizzes.forEach((q) => {
  counts[q.course] = (counts[q.course] ?? 0) + 1
  const name = `${q.course}-${String(counts[q.course]).padStart(2, '0')}-${slug(q.title)}.csv`
  const body = q.rows.map((r) => [...r, '20', '1000'].map(cell).join(','))
  writeFileSync(join(outDir, name), [HEADER, ...body].join('\r\n') + '\r\n')
})
const total = quizzes.reduce((n, q) => n + q.rows.length, 0)
const letters = { A: 0, B: 0, C: 0, D: 0 }
const tf = { True: 0, False: 0 }
quizzes.forEach((q) => q.rows.forEach((r) => (r[0] === 'multiple' ? letters[r[6]]++ : tf[r[6]]++)))
console.log('correct letters', letters, 'true/false answers', tf)
console.log(`${quizzes.length} quizzes, ${total} questions -> scripts/quizzes/csv`)
