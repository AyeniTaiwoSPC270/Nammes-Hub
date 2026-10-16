import { IMAGE_ALT_MAX } from '../../api/_lib/quizImage.js'
import { parseNumber, isChoiceType, cleanExplanation, cleanDiagramTargets, normaliseUnit, ORDER_STEPS_MAX, DIAGRAM_TARGETS_MAX, ANSWER_TEXT_MAX, ACCEPTED_ANSWERS_MAX, EXPLANATION_MAX } from '../../api/_lib/quizGrading.js'
import { QUESTION_TYPE_INFO } from '../../api/_lib/quizTypes.js'

// Re-exported because the editor and the two library modals import it from here, and because it used to be defined
// here. It now comes from the one shared list, so a new type appears in all of them at once.
export { QUESTION_TYPE_INFO }

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

// How hard a question is. Only test bots use it (to decide how often they get it right); players never see it.
export const DIFFICULTIES = ['easy', 'medium', 'hard']

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
    difficulty: null,
    numeric_answer: '',
    numeric_tolerance: '0',
    // Optional. A question with no unit is a plain number question and behaves exactly as it did before.
    numeric_unit: '',
    // One alias per line, so the editor reads it the same way as the accepted answers below it.
    numeric_unit_aliases: '',
    accepted_text: '',
    image_path: null,
    image_alt: '',
    // Shown on the reveal, on the projector and on every phone. Optional: a question with none behaves exactly as it
    // did before this field existed.
    explanation: '',
    // Only set on a multiple choice question, and only ever by the admin: the answers to this one keep their order.
    no_shuffle: false,
  }
}

// A saved question (database row) turned into the editor's form.
export function questionFromRow(q) {
  return {
    id: q.id,
    type: q.type ?? 'multiple',
    text: q.text,
    correct_index: q.correct_index ?? 0,
    time_limit_seconds: q.time_limit_seconds,
    points: q.points,
    points_multiplier: q.points_multiplier ?? 1,
    difficulty: q.difficulty ?? null,
    numeric_answer: q.numeric_answer == null ? '' : String(q.numeric_answer),
    numeric_tolerance: String(q.numeric_tolerance ?? 0),
    numeric_unit: q.numeric_unit ?? '',
    numeric_unit_aliases: (q.numeric_unit_aliases ?? []).join('\n'),
    // A diagram question's options are its steps, so the editor is given a full set of boxes rather than two: there can
    // be up to twelve and they are trimmed on save.
    options: q.type === 'order'
      ? [...(q.options ?? [])].slice(0, 12)
      : [...(q.options ?? []), '', '', '', ''].slice(0, 4),
    diagram_targets: (q.diagram_targets ?? []).map((t) => ({ ...t })),
    accepted_text: (q.accepted_answers ?? []).join('\n'),
    image_path: q.image_path ?? null,
    image_alt: q.image_alt ?? '',
    explanation: q.explanation ?? '',
    no_shuffle: q.no_shuffle === true,
  }
}

// Turns the editor's form into what gets saved. Empty option boxes are dropped, so a choice question can have 2 to 4 answers.
export function cleanQuestion(q) {
  const type = q.type ?? 'multiple'
  // no_shuffle only means anything for a multiple choice question: the others have either one order that is correct or no
  // options at all, and keepsOptionOrder already refuses to shuffle them.
  const base = { ...q, type, text: q.text.trim(), explanation: cleanExplanation(q.explanation), points_multiplier: q.points_multiplier === 2 ? 2 : 1, difficulty: DIFFICULTIES.includes(q.difficulty) ? q.difficulty : null, no_shuffle: type === 'multiple' && q.no_shuffle === true }
  // Every branch below has to neutralise the fields of the types it is not, or a question that was once a diagram
  // keeps its targets when the author switches it to a typed answer and the column constraint rejects the row.
  const withoutDiagram = { ...base, diagram_targets: [] }
  if (type === 'truefalse') {
    return { ...withoutDiagram, options: ['True', 'False'], correct_index: q.correct_index === 1 ? 1 : 0, numeric_answer: null, numeric_tolerance: 0, numeric_unit: null, numeric_unit_aliases: [], accepted_answers: [] }
  }
  if (type === 'numeric') {
    const value = parseNumber(String(q.numeric_answer ?? ''))
    const rawTolerance = String(q.numeric_tolerance ?? '0').trim()
    const tolerance = rawTolerance === '' ? 0 : parseNumber(rawTolerance)
    return {
      ...base,
      options: [],
      correct_index: null,
      numeric_answer: value,
      numeric_tolerance: tolerance === null ? NaN : tolerance,
      // The unit is optional, so a plain number question stays exactly what it was. Aliases are spellings only: they
      // are stored per question and never scale the number, which is what keeps 2500 N wrong against 2.5 kN.
      numeric_unit: cleanUnit(q.numeric_unit),
      numeric_unit_aliases: cleanUnitAliases(q.numeric_unit_aliases),
      accepted_answers: [],
    }
  }
  if (type === 'order') {
    // The authored order of the steps IS the answer. There is no correct_order column to drift away from this list,
    // and a step that is left blank is dropped rather than graded as an empty step.
    const kept = (q.options ?? []).map((text) => String(text ?? '').trim()).filter(Boolean)
    return { ...base, options: kept, correct_index: null, numeric_answer: null, numeric_tolerance: 0, numeric_unit: null, numeric_unit_aliases: [], accepted_answers: [], diagram_targets: [] }
  }
  if (type === 'diagram') {
    return {
      ...base,
      options: [],
      correct_index: null,
      numeric_answer: null,
      numeric_tolerance: 0,
      numeric_unit: null,
      numeric_unit_aliases: [],
      accepted_answers: [],
      diagram_targets: cleanDiagramTargets(q.diagram_targets),
    }
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
    return { ...withoutDiagram, options: [], correct_index: null, numeric_answer: null, numeric_tolerance: 0, numeric_unit: null, numeric_unit_aliases: [], accepted_answers: accepted }
  }
  // Built from the non-empty options with the ORIGINAL index carried along, so a blank box in the middle of the list
// moves the correct answer's index down with it. Re-finding it by comparing trimmed text is not the same thing: two
// options with the same text would then point at the first of them.
const kept = (q.options ?? []).map((text, index) => ({ text: String(text ?? '').trim(), index })).filter((o) => o.text)
  const options = kept.map((o) => o.text)
  const correct_index = type === 'poll' ? null : kept.findIndex((o) => o.index === q.correct_index)
  return { ...withoutDiagram, options, correct_index, numeric_answer: null, numeric_tolerance: 0, numeric_unit: null, numeric_unit_aliases: [], accepted_answers: [] }
}

// The unit is stored as typed and checked against the column's own length limit, not normalised here: an admin who
// writes "kN" should see "kN" in the editor and in the reveal, and the matcher normalises on both sides at grading time.
function cleanUnit(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return null
  return text.length > 12 ? text.slice(0, 12) : text
}

// Aliases are spellings of one unit, so they are deduplicated on their normalised form: "KN" and "kN" both accepted is
// harmless, but the same spelling three times is an editor's accident and is not worth carrying into every answer row.
// Accepts a list or a string, and a string may separate on commas or newlines: the editor's draft field is one per line,
// a spreadsheet cell is pipe-separated, and both end up here through the same cleanQuestion.
function cleanUnitAliases(raw) {
  const list = Array.isArray(raw) ? raw : String(raw ?? '').split(/[,\n]/)
  const seen = new Set()
  const out = []
  for (const item of list) {
    const text = String(item ?? '').trim()
    if (!text) continue
    const key = normaliseUnit(text)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(text)
  }
  return out.slice(0, 12)
}

// Returns a message naming what is wrong with one question, or null.
export function validateQuestion(raw, n = 1) {
  const q = cleanQuestion(raw)
  if (!q.text) return `Question ${n} needs some text.`
  if (q.text.length > 300) return `Question ${n} is too long (300 characters at most).`
  if (q.type === 'numeric') {
    if (q.numeric_answer === null) return `Question ${n}: enter the correct answer as a number (like 3.14, -2 or 1/2).`
    if (!Number.isFinite(q.numeric_tolerance) || q.numeric_tolerance < 0) return `Question ${n}: the allowed margin must be a number, 0 or more.`
    if (q.numeric_unit && normaliseUnit(q.numeric_unit) === normaliseUnit(q.numeric_unit_aliases?.[0] ?? '\u0000')) {
      // Silently accepted either way, but an alias identical to the unit is an editor slip worth naming.
      return `Question ${n}: that spelling is already the unit. Remove it from the accepted spellings.`
    }
  } else if (q.type === 'order') {
    if (q.options.length < 2) return `Question ${n}: add at least two steps to put in order.`
    if (q.options.length > ORDER_STEPS_MAX) return `Question ${n}: at most ${ORDER_STEPS_MAX} steps, or the answer stops being readable on a phone.`
    if (q.options.some((o) => String(o ?? '').trim().length === 0)) return `Question ${n}: every step needs some text, or remove the empty one.`
    if (q.image_path || q.imageBlob) return `Question ${n}: a picture is not used on an ordering question. Remove it.`
  } else if (q.type === 'diagram') {
    if (!q.image_path && !q.imageBlob) return `Question ${n}: a diagram needs a picture to tap on.`
    if (q.diagram_targets.length === 0) return `Question ${n}: mark at least one correct region on the picture.`
    if (q.diagram_targets.length > DIAGRAM_TARGETS_MAX) return `Question ${n}: at most ${DIAGRAM_TARGETS_MAX} regions.`
    if (q.options.length > 0) return `Question ${n}: a diagram question has no answer options.`
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
  // Checked against what was typed rather than against a truncated copy: cleanExplanation does not cut the text down
  // to the limit, so an over-long explanation is refused with a message instead of quietly losing its tail.
  if (String(q.explanation ?? '').trim().length > EXPLANATION_MAX) {
    return `Question ${n}: the explanation is too long (${EXPLANATION_MAX} characters at most).`
  }
  return null
}
