import { IMAGE_ALT_MAX } from '../../api/_lib/quizImage.js'
import { parseNumber, isChoiceType, ANSWER_TEXT_MAX, ACCEPTED_ANSWERS_MAX } from '../../api/_lib/quizGrading.js'

// How the quiz editor holds a question, and how it is checked and cleaned before saving.

export const MAX_QUESTIONS = 200
export const MAX_TAGS = 8
export const TAG_MAX_LENGTH = 24

// Tags typed as "maths, freshers week, fun" become ['maths', 'freshers week', 'fun'] (lower case, no repeats, limited).
export function cleanTags(input) {
  const list = Array.isArray(input) ? input : String(input ?? '').split(',')
  const seen = new Set()
  const tags = []
  for (const item of list) {
    const tag = String(item).replace(/\s+/g, ' ').trim().toLowerCase().slice(0, TAG_MAX_LENGTH)
    if (tag && !seen.has(tag)) {
      seen.add(tag)
      tags.push(tag)
    }
    if (tags.length === MAX_TAGS) break
  }
  return tags
}
export const TIME_LIMIT_CHOICES = [10, 20, 30, 60]
export const POINT_CHOICES = [500, 1000, 2000]

export const QUESTION_TYPE_INFO = {
  multiple: { label: 'Multiple choice', hint: '2 to 4 answers, one is right.' },
  truefalse: { label: 'True or false', hint: 'Two big buttons.' },
  numeric: { label: 'Number answer', hint: 'Players type a number. You can allow a small margin.' },
  text: { label: 'Typed answer', hint: 'Players type a word or short phrase. Case and punctuation are ignored.' },
  poll: { label: 'Poll (no score)', hint: 'Asks for an opinion. Nobody scores.' },
}

// A new question as the editor holds it. Number fields are text while typing, and are turned into numbers on save.
export function blankQuestion(type = 'multiple') {
  return {
    id: crypto.randomUUID(),
    type,
    text: '',
    options: type === 'truefalse' ? ['True', 'False', '', ''] : ['', '', '', ''],
    correct_index: 0,
    time_limit_seconds: 20,
    points: 1000,
    points_multiplier: 1,
    numeric_answer: '',
    numeric_tolerance: '0',
    accepted_text: '',
    image_path: null,
    image_alt: '',
  }
}

// A saved question (database row) turned into the editor's form.
export function questionFromRow(q) {
  return {
    id: q.id,
    type: q.type ?? 'multiple',
    text: q.text,
    options: [...(q.options ?? []), '', '', '', ''].slice(0, 4),
    correct_index: q.correct_index ?? 0,
    time_limit_seconds: q.time_limit_seconds,
    points: q.points,
    points_multiplier: q.points_multiplier ?? 1,
    numeric_answer: q.numeric_answer == null ? '' : String(q.numeric_answer),
    numeric_tolerance: String(q.numeric_tolerance ?? 0),
    accepted_text: (q.accepted_answers ?? []).join('\n'),
    image_path: q.image_path ?? null,
    image_alt: q.image_alt ?? '',
  }
}

// Turns the editor's form into what gets saved. Empty option boxes are dropped, so a choice question can have 2 to 4 answers.
export function cleanQuestion(q) {
  const type = q.type ?? 'multiple'
  const base = { ...q, type, text: q.text.trim(), points_multiplier: q.points_multiplier === 2 ? 2 : 1 }
  if (type === 'truefalse') {
    return { ...base, options: ['True', 'False'], correct_index: q.correct_index === 1 ? 1 : 0, numeric_answer: null, numeric_tolerance: 0, accepted_answers: [] }
  }
  if (type === 'numeric') {
    const value = parseNumber(String(q.numeric_answer ?? ''))
    const rawTolerance = String(q.numeric_tolerance ?? '0').trim()
    const tolerance = rawTolerance === '' ? 0 : parseNumber(rawTolerance)
    return { ...base, options: [], correct_index: null, numeric_answer: value, numeric_tolerance: tolerance === null ? NaN : tolerance, accepted_answers: [] }
  }
  if (type === 'text') {
    const seen = new Set()
    const accepted = []
    for (const line of String(q.accepted_text ?? '').split('\n')) {
      const t = line.trim()
      if (t && !seen.has(t.toLowerCase())) {
        seen.add(t.toLowerCase())
        accepted.push(t)
      }
    }
    return { ...base, options: [], correct_index: null, numeric_answer: null, numeric_tolerance: 0, accepted_answers: accepted }
  }
  const kept = q.options.map((text, index) => ({ text: text.trim(), index })).filter((o) => o.text)
  const options = kept.map((o) => o.text)
  const correct_index = type === 'poll' ? null : kept.findIndex((o) => o.index === q.correct_index)
  return { ...base, options, correct_index, numeric_answer: null, numeric_tolerance: 0, accepted_answers: [] }
}

// Returns a message naming what is wrong with one question, or null.
export function validateQuestion(raw, n = 1) {
  const q = cleanQuestion(raw)
  if (!q.text) return `Question ${n} needs some text.`
  if (q.text.length > 300) return `Question ${n} is too long (300 characters at most).`
  if (q.type === 'numeric') {
    if (q.numeric_answer === null) return `Question ${n}: enter the correct answer as a number (like 3.14, -2 or 1/2).`
    if (!Number.isFinite(q.numeric_tolerance) || q.numeric_tolerance < 0) return `Question ${n}: the allowed margin must be a number, 0 or more.`
  } else if (q.type === 'text') {
    if (q.accepted_answers.length === 0) return `Question ${n}: add at least one accepted answer.`
    if (q.accepted_answers.length > ACCEPTED_ANSWERS_MAX) return `Question ${n}: at most ${ACCEPTED_ANSWERS_MAX} accepted answers.`
    if (q.accepted_answers.some((a) => a.length > ANSWER_TEXT_MAX)) return `Question ${n}: accepted answers can be ${ANSWER_TEXT_MAX} characters at most.`
  } else if (isChoiceType(q.type)) {
    if (q.options.length < 2) return `Question ${n} needs at least two answers.`
    if (q.type !== 'poll' && q.correct_index < 0) return `Question ${n}: pick a correct answer that is not empty.`
  }
  if (q.image_path || q.imageBlob) {
    if (!String(q.image_alt ?? '').trim()) return `Question ${n}: describe the picture (alt text) so everyone can follow.`
    if (String(q.image_alt).length > IMAGE_ALT_MAX) return `Question ${n}: the picture description is too long (${IMAGE_ALT_MAX} characters at most).`
  }
  return null
}
