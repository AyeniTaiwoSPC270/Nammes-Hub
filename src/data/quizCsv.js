import { blankQuestion, cleanQuestion, validateQuestion, TIME_LIMIT_CHOICES, POINT_CHOICES, MAX_QUESTIONS } from './quizQuestions'
import { parseNumber } from '../../api/_lib/quizGrading.js'
import { resolveTypeAlias } from '../../api/_lib/quizTypes.js'

// Spreadsheet import and export for quizzes. One question per row:
//   type, question, option_a, option_b, option_c, option_d, correct, seconds, points
// `correct` is a letter (A to D) for choice questions, "answer|margin" for numbers (the margin is optional), and the
// accepted answers separated by | for typed text. A sheet with no header row and just question + four answers + a
// letter also works, so a simple list pasted from Excel imports as multiple choice.

export const OPTION_COLUMNS = ['option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'option_f', 'option_g', 'option_h', 'option_i', 'option_j', 'option_k', 'option_l']
// An ordering question can have up to twelve steps, so a sheet that contains one gets twelve option columns. A sheet
// with none keeps the four it has always had: that export is byte-for-byte what it was, and a multiple choice question
// still stops at four, enforced by the column constraint rather than by the file format.
const FOUR_OPTIONS = OPTION_COLUMNS.slice(0, 4)
export const CSV_COLUMNS = ['type', 'question', ...FOUR_OPTIONS, 'correct', 'seconds', 'points', 'explanation', 'unit', 'unit_aliases']
// Extra columns used by CBT exams, read by name when the sheet has a header row. `explanation` is no longer one of them:
// it is authored on live quiz questions too, so a quiz exported to a spreadsheet must not lose it.
export const CBT_COLUMNS = [...CSV_COLUMNS, 'topic', 'no_shuffle']
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

// Which question type a row means. The spellings a spreadsheet actually uses live in the shared list now, so a new
// type is importable as soon as it is authorable.

// Turns parsed rows into editor questions. Returns the good ones and a list of problems ({ line, message }) for the rest.
export function questionsFromRows(rows, { max = MAX_QUESTIONS } = {}) {
  const problems = []
  const questions = []
  if (rows.length === 0) return { questions, problems: [{ line: 1, message: 'The file is empty.' }] }

  const head = rows[0].map((c) => c.trim().toLowerCase())
  const hasHeader = head.includes('question')
  // Built from the full set of column names, not from CBT_COLUMNS: a sheet with an ordering question has twelve option
// columns and the reader has to be able to name all twelve even when it is reading an exam bank.
const index = Object.fromEntries([...new Set([...CSV_COLUMNS, ...OPTION_COLUMNS, 'topic', 'no_shuffle'])].map((name) => [name, head.indexOf(name)]))
  // With no header the columns are: question, four answers, correct letter. A headerless sheet predates every type
  // added after multiple choice, so it is read as the four-option layout it was written as.
  const headerless = { question: 0, option_a: 1, option_b: 2, option_c: 3, option_d: 4, correct: 5 }
  const col = (row, name) => {
    const at = hasHeader ? index[name] : headerless[name]
    return at === undefined || at < 0 ? '' : unguard(String(row[at] ?? '').trim())
  }

  const body = hasHeader ? rows.slice(1) : rows
  if (body.length > max) problems.push({ line: 1, message: `A quiz can have at most ${max} questions; only the first ${max} are used.` })

  body.slice(0, max).forEach((row, i) => {
    const line = i + (hasHeader ? 2 : 1)
    const type = resolveTypeAlias(col(row, 'type'))
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
      // Draft field names, not the column names: rows are pushed as authored and cleaned on save, so a row read from a
      // sheet goes through exactly the same cleanQuestion as one typed into the editor.
      numeric_unit: col(row, 'unit'),
      // One cell, pipe-separated, for the same reason the typed answers are: a newline inside a CSV cell is quoted, and a
// quoted newline is the one thing a hand-edited sheet breaks first.
numeric_unit_aliases: col(row, 'unit_aliases').split('|').map((a) => a.trim()).filter(Boolean).join('\n'),
      topic: col(row, 'topic'),
      no_shuffle: ['yes', 'true', '1', 'y'].includes(col(row, 'no_shuffle').toLowerCase()),
    }
    const correct = col(row, 'correct')
    if (type === 'multiple' || type === 'poll') {
      q.options = OPTION_COLUMNS.slice(0, 4).map((name) => col(row, name))
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
    } else if (type === 'order') {
      // Every step, in the order the columns appear. There is no correct_answer letter to read: the authored order of
      // these cells IS the answer, so the column is written and never checked.
      q.options = OPTION_COLUMNS.map((name) => col(row, name))
    } else if (type === 'numeric') {
      const [answer, margin = ''] = correct.split('|').map((x) => x.trim())
      q.numeric_answer = answer
      q.numeric_tolerance = margin === '' ? '0' : margin
    } else if (type === 'text') {
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
  const ordered = (Array.isArray(questions) ? questions : [questions]).some((q) => (q?.type ?? 'multiple') === 'order')
  const head = ordered
    ? ['type', 'question', ...OPTION_COLUMNS, 'correct', 'seconds', 'points', 'explanation', 'unit', 'unit_aliases']
    : CSV_COLUMNS
  const width = ordered ? 12 : 4
  const rows = [cbt ? [...head, 'topic', 'no_shuffle'] : head]
  for (const raw of questions) {
    const q = cleanQuestion(raw)
    // An ordering question writes its steps into the option cells, in authored order, because that order is the answer.
// Everything else leaves the cells empty rather than putting the answer somewhere that would read back differently.
const cells = q.type === 'multiple' || q.type === 'poll' || q.type === 'order'
      ? [...q.options, ...Array(width).fill('')].slice(0, width)
      : Array(width).fill('')
    let correct = ''
    if (q.type === 'multiple') correct = 'ABCD'[q.correct_index] ?? ''
    else if (q.type === 'truefalse') correct = q.correct_index === 0 ? 'True' : 'False'
    else if (q.type === 'numeric') correct = q.numeric_tolerance > 0 ? `${q.numeric_answer}|${q.numeric_tolerance}` : String(q.numeric_answer)
    else if (q.type === 'text') correct = q.accepted_answers.join('|')
    // A diagram question's regions are not in the sheet: they are geometry on an uploaded picture, and a cell of
    // coordinates would import back as something that does not grade the same. The row exports its text and its unit of
    // measure, and importing it reports that the picture is missing rather than producing a question that grades every
    // tap wrong - a loud round-trip failure instead of a quiet one. Its cells stay blank, which `blanks` above already
    // arranges, because diagram is not a choice type.
    rows.push([
      q.type,
      q.text,
      ...cells,
      correct,
      q.time_limit_seconds,
      q.points,
      q.explanation ?? '',
      q.numeric_unit ?? '',
      q.numeric_unit_aliases?.join('|') ?? '',
      ...(cbt ? [q.topic ?? '', q.no_shuffle ? 'yes' : ''] : []),
    ])
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
