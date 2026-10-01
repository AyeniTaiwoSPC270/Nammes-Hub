import { blankQuestion, cleanQuestion, validateQuestion, TIME_LIMIT_CHOICES, POINT_CHOICES, MAX_QUESTIONS } from './quizQuestions'
import { parseNumber } from '../../api/_lib/quizGrading.js'

// Spreadsheet import and export for quizzes. One question per row:
//   type, question, option_a, option_b, option_c, option_d, correct, seconds, points
// `correct` is a letter (A to D) for choice questions, "answer|margin" for numbers (the margin is optional), and the
// accepted answers separated by | for typed text. A sheet with no header row and just question + four answers + a
// letter also works, so a simple list pasted from Excel imports as multiple choice.

export const CSV_COLUMNS = ['type', 'question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct', 'seconds', 'points']
// Extra columns used by CBT exams, read by name when the sheet has a header row.
export const CBT_COLUMNS = [...CSV_COLUMNS, 'explanation', 'topic', 'no_shuffle']
export const CSV_MAX_BYTES = 1024 * 1024

const INJECTION_START = /^[=+\-@]/

// Cells that start like a formula are kept as plain text when the file is opened again in a spreadsheet.
function guard(value) {
  const text = String(value ?? '')
  return INJECTION_START.test(text) ? `'${text}` : text
}
function unguard(value) {
  return /^'[=+\-@]/.test(value) ? value.slice(1) : value
}

// Reads CSV or tab-separated text (Excel paste) into rows of cells. Handles quotes, doubled quotes, line breaks
// inside quotes, Windows line endings and a leading byte-order mark.
export function parseCsv(input) {
  const raw = String(input ?? '')
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = firstLine.includes('\t') && !firstLine.includes(',') ? '\t' : ','
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += ch
    } else if (ch === '"' && cell === '') quoted = true
    else if (ch === delimiter) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

function nearest(value, choices, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return choices.reduce((best, c) => (Math.abs(c - n) < Math.abs(best - n) ? c : best), choices[0])
}

const TYPE_ALIASES = {
  '': 'multiple', multiple: 'multiple', mc: 'multiple', choice: 'multiple', 'multiple choice': 'multiple',
  truefalse: 'truefalse', 'true/false': 'truefalse', 'true false': 'truefalse', tf: 'truefalse', boolean: 'truefalse',
  numeric: 'numeric', number: 'numeric', numerical: 'numeric',
  text: 'text', typed: 'text', short: 'text', 'short answer': 'text',
  poll: 'poll', survey: 'poll',
}

// Turns parsed rows into editor questions. Returns the good ones and a list of problems ({ line, message }) for the rest.
export function questionsFromRows(rows, { max = MAX_QUESTIONS } = {}) {
  const problems = []
  const questions = []
  if (rows.length === 0) return { questions, problems: [{ line: 1, message: 'The file is empty.' }] }

  const head = rows[0].map((c) => c.trim().toLowerCase())
  const hasHeader = head.includes('question')
  const index = Object.fromEntries(CBT_COLUMNS.map((name) => [name, head.indexOf(name)]))
  // With no header the columns are: question, four answers, correct letter.
  const headerless = { question: 0, option_a: 1, option_b: 2, option_c: 3, option_d: 4, correct: 5 }
  const col = (row, name) => {
    const at = hasHeader ? index[name] : headerless[name]
    return at === undefined || at < 0 ? '' : unguard(String(row[at] ?? '').trim())
  }

  const body = hasHeader ? rows.slice(1) : rows
  if (body.length > max) problems.push({ line: 1, message: `A quiz can have at most ${max} questions; only the first ${max} are used.` })

  body.slice(0, max).forEach((row, i) => {
    const line = i + (hasHeader ? 2 : 1)
    const typeName = col(row, 'type').toLowerCase()
    const type = TYPE_ALIASES[typeName]
    if (!type) {
      problems.push({ line, message: `Unknown question type "${col(row, 'type')}".` })
      return
    }
    const q = {
      ...blankQuestion(type),
      text: col(row, 'question'),
      time_limit_seconds: nearest(col(row, 'seconds'), TIME_LIMIT_CHOICES, 20),
      points: nearest(col(row, 'points'), POINT_CHOICES, 1000),
      explanation: col(row, 'explanation'),
      topic: col(row, 'topic'),
      no_shuffle: ['yes', 'true', '1', 'y'].includes(col(row, 'no_shuffle').toLowerCase()),
    }
    const correct = col(row, 'correct')
    if (type === 'multiple' || type === 'poll') {
      q.options = ['option_a', 'option_b', 'option_c', 'option_d'].map((name) => col(row, name))
      if (type === 'multiple') {
        const at = 'abcd'.indexOf(correct.toLowerCase())
        if (correct.length !== 1 || at < 0) {
          problems.push({ line, message: 'The correct answer must be a letter from A to D.' })
          return
        }
        q.correct_index = at
      }
    } else if (type === 'truefalse') {
      const c = correct.toLowerCase()
      if (!['true', 'false', 'a', 'b', 't', 'f'].includes(c)) {
        problems.push({ line, message: 'The correct answer for true/false must be True or False.' })
        return
      }
      q.correct_index = c === 'true' || c === 'a' || c === 't' ? 0 : 1
    } else if (type === 'numeric') {
      const [answer, margin = ''] = correct.split('|').map((x) => x.trim())
      q.numeric_answer = answer
      q.numeric_tolerance = margin === '' ? '0' : margin
    } else {
      q.accepted_text = correct.split('|').map((x) => x.trim()).filter(Boolean).join('\n')
    }
    const problem = validateQuestion(q, line)
    if (problem) {
      problems.push({ line, message: problem.replace(/^Question \d+:? ?/, '') })
      return
    }
    questions.push(q)
  })
  return { questions, problems }
}

export function questionsFromCsv(text, options) {
  return questionsFromRows(parseCsv(text), options)
}

function escapeCell(value) {
  const text = guard(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

// A quiz's questions as CSV text (what import reads back).
export function questionsToCsv(questions, { cbt = false } = {}) {
  const rows = [cbt ? CBT_COLUMNS : CSV_COLUMNS]
  for (const raw of questions) {
    const q = cleanQuestion(raw)
    const options = [...q.options, '', '', '', ''].slice(0, 4)
    let correct = ''
    if (q.type === 'multiple') correct = 'ABCD'[q.correct_index] ?? ''
    else if (q.type === 'truefalse') correct = q.correct_index === 0 ? 'True' : 'False'
    else if (q.type === 'numeric') correct = q.numeric_tolerance > 0 ? `${q.numeric_answer}|${q.numeric_tolerance}` : String(q.numeric_answer)
    else if (q.type === 'text') correct = q.accepted_answers.join('|')
    rows.push([q.type, q.text, ...(q.type === 'numeric' || q.type === 'text' || q.type === 'truefalse' ? ['', '', '', ''] : options), correct, q.time_limit_seconds, q.points, ...(cbt ? [q.explanation ?? '', q.topic ?? '', q.no_shuffle ? 'yes' : ''] : [])])
  }
  return rows.map((r) => r.map(escapeCell).join(',')).join('\r\n')
}

// Only used to tell the person what a number cell means in a preview.
export function describeCorrect(q) {
  if (q.type === 'numeric') return `${parseNumber(String(q.numeric_answer))} ± ${Number(q.numeric_tolerance) || 0}`
  if (q.type === 'text') return q.accepted_text.split('\n').join(' / ')
  if (q.type === 'truefalse') return q.correct_index === 0 ? 'True' : 'False'
  if (q.type === 'poll') return 'No right answer'
  return q.options[q.correct_index] ?? ''
}
