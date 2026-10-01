// Community question sets: anyone can import their own questions (no account) and play them in practice and battles.
// Everything a stranger sends is cleaned here before it is stored: only known fields, hard length limits, no blocked
// words. The server runs this on every set; the browser can run it too to show problems before sending.
import { parseNumber, ANSWER_TEXT_MAX, ACCEPTED_ANSWERS_MAX } from './quizGrading.js'
import { hasBlockedWord } from './quizText.js'

// Ordinary words that contain a blocked word once letters are squashed together ("therapeutic", "grape", "scrape").
const INNOCENT = /\w*(grape|drape|scrape|therap|trapez|crape)\w*/gi
const rude = (text) => hasBlockedWord(String(text).replace(INNOCENT, ' '))

export const CUSTOM_MAX_QUESTIONS = 100
export const CBT_BANK_MAX_QUESTIONS = 500
export const CUSTOM_TOPIC_MAX = 60
export const CUSTOM_DAYS = 30
export const CUSTOM_DAY_CHOICES = [30, 90, 180]
export const CUSTOM_EXPLANATION_MAX = 500
export const CUSTOM_TITLE_MIN = 3
export const CUSTOM_TITLE_MAX = 60
export const CUSTOM_TEXT_MAX = 300
export const CUSTOM_OPTION_MAX = 100
const TIME_LIMITS = [10, 20, 30, 60]
const POINTS = [500, 1000, 2000]
const TYPES = ['multiple', 'truefalse', 'numeric', 'text']

// Strips control characters and squeezes spaces, so pasted text cannot carry invisible junk.
export function cleanLine(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const nearest = (value, choices, fallback) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return choices.reduce((best, c) => (Math.abs(c - n) < Math.abs(best - n) ? c : best), choices[0])
}

// How long a quiz is kept: 30, 90 or 180 days (anything else becomes 30).
export function cleanDays(value) {
  const n = Number(value)
  return CUSTOM_DAY_CHOICES.includes(n) ? n : CUSTOM_DAYS
}

export function cleanTitle(input) {
  const title = cleanLine(input)
  if (title.length < CUSTOM_TITLE_MIN) return { error: `Give your quiz a name (at least ${CUSTOM_TITLE_MIN} characters).` }
  if (title.length > CUSTOM_TITLE_MAX) return { error: `The name can be ${CUSTOM_TITLE_MAX} characters at most.` }
  if (rude(title)) return { error: 'Please choose a different name.' }
  return { title }
}

// Turns what was sent into rows ready to store. Returns { questions, problems }: the good questions and a message per
// question that was refused. Nothing is stored unless every question passes (the caller checks `problems`).
// `trusted` is for admin-made question banks: no word filter and a bigger limit (`max`).
export function sanitizeCustomQuestions(input, { trusted = false, max = trusted ? CBT_BANK_MAX_QUESTIONS : CUSTOM_MAX_QUESTIONS } = {}) {
  const problems = []
  const questions = []
  const rudeText = (t) => !trusted && rude(t)
  if (!Array.isArray(input) || input.length === 0) return { questions, problems: [{ line: 1, message: 'Add at least one question.' }] }
  if (input.length > max) problems.push({ line: 1, message: `A quiz can have at most ${max} questions.` })

  input.slice(0, max).forEach((raw, i) => {
    const line = i + 1
    const fail = (message) => problems.push({ line, message })
    const q = raw && typeof raw === 'object' ? raw : {}
    const type = TYPES.includes(q.type) ? q.type : null
    if (!type) return fail('Use multiple choice, true/false, number or typed answers.')
    const text = cleanLine(q.text)
    if (!text) return fail('The question needs some text.')
    if (text.length > CUSTOM_TEXT_MAX) return fail(`The question is too long (${CUSTOM_TEXT_MAX} characters at most).`)
    if (rudeText(text)) return fail('The question has a word that is not allowed.')

    const row = {
      type,
      text,
      options: [],
      correct_index: null,
      numeric_answer: null,
      numeric_tolerance: 0,
      accepted_answers: [],
      time_limit_seconds: nearest(q.time_limit_seconds, TIME_LIMITS, 20),
      points: nearest(q.points, POINTS, 1000),
      points_multiplier: 1,
    }
    if (type === 'truefalse') {
      row.options = ['True', 'False']
      row.correct_index = Number(q.correct_index) === 1 ? 1 : 0
    } else if (type === 'multiple') {
      const options = Array.isArray(q.options) ? q.options.map(cleanLine) : []
      // Empty boxes are dropped, but the right answer has to survive the dropping.
      const kept = options.map((text2, at) => ({ text: text2, at })).filter((o) => o.text)
      if (kept.length < 2) return fail('Give at least two answers.')
      if (kept.length > 4) return fail('At most four answers.')
      if (kept.some((o) => o.text.length > CUSTOM_OPTION_MAX)) return fail(`An answer is too long (${CUSTOM_OPTION_MAX} characters at most).`)
      if (kept.some((o) => rudeText(o.text))) return fail('An answer has a word that is not allowed.')
      const right = kept.findIndex((o) => o.at === Number(q.correct_index))
      if (right < 0) return fail('Pick a correct answer that is not empty.')
      row.options = kept.map((o) => o.text)
      row.correct_index = right
    } else if (type === 'numeric') {
      const answer = typeof q.numeric_answer === 'number' ? q.numeric_answer : parseNumber(String(q.numeric_answer ?? ''))
      const margin = q.numeric_tolerance === undefined || q.numeric_tolerance === '' ? 0 : typeof q.numeric_tolerance === 'number' ? q.numeric_tolerance : parseNumber(String(q.numeric_tolerance))
      if (answer === null || !Number.isFinite(answer) || Math.abs(answer) > 1e12) return fail('The correct answer must be a number.')
      if (margin === null || !Number.isFinite(margin) || margin < 0 || margin > 1e12) return fail('The allowed margin must be a number, 0 or more.')
      row.numeric_answer = answer
      row.numeric_tolerance = margin
    } else {
      const seen = new Set()
      const accepted = []
      for (const item of Array.isArray(q.accepted_answers) ? q.accepted_answers : []) {
        const t = cleanLine(item)
        if (t && !seen.has(t.toLowerCase())) {
          seen.add(t.toLowerCase())
          accepted.push(t)
        }
      }
      if (accepted.length === 0) return fail('Add at least one accepted answer.')
      if (accepted.length > ACCEPTED_ANSWERS_MAX) return fail(`At most ${ACCEPTED_ANSWERS_MAX} accepted answers.`)
      if (accepted.some((a) => a.length > ANSWER_TEXT_MAX)) return fail(`An accepted answer can be ${ANSWER_TEXT_MAX} characters at most.`)
      if (accepted.some((a) => rudeText(a))) return fail('An answer has a word that is not allowed.')
      row.accepted_answers = accepted
    }
    // Optional extras used by CBT exams: a short explanation shown in the review, and "keep the answers in this order".
    const explanation = cleanLine(q.explanation).slice(0, CUSTOM_EXPLANATION_MAX)
    if (explanation) {
      if (rudeText(explanation)) return fail('The explanation has a word that is not allowed.')
      row.explanation = explanation
    }
    const topic = cleanLine(q.topic).slice(0, CUSTOM_TOPIC_MAX)
    if (topic) row.topic = topic
    if (q.no_shuffle === true) row.no_shuffle = true
    questions.push(row)
  })
  return { questions, problems }
}
