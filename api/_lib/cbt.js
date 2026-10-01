// CBT practice exams: the rules that do not need a database. Drawing and shuffling a paper, grading an attempt and
// cleaning exam settings. The handler (handlers/quiz-cbt.js) puts these together with the clock and the tables.
import { gradeAnswer, isChoiceType, correctText, ANSWER_TEXT_MAX } from './quizGrading.js'

export const CBT_GRACE_MS = 10_000 // answers saved this long after the deadline still count (slow phones, slow networks)
export const CBT_RESULT_TTL_MS = 24 * 60 * 60_000 // the review stays readable on the server this long after submitting
export const CBT_MAX_MINUTES = 240
export const CBT_LEVELS = ['100', '200', '300', '400', '500', 'other']

// Answers like "All of the above" only make sense in the order they were typed, so those questions are never shuffled.
const ORDER_DEPENDENT = /\b(all|none|both|any|neither)\s+of\s+(the\s+)?(above|these|them)\b|\b(a|b|c|d)\s*(and|&|,)\s*(a|b|c|d)\b|\bboth\b.*\band\b|\ball\s+(the\s+)?above\b|\bnone\s+(of\s+)?(the\s+)?above\b/i

export function keepsOptionOrder(question) {
  if (question.no_shuffle) return true
  if ((question.type ?? 'multiple') !== 'multiple') return true // true/false stays True, False
  return (question.options ?? []).some((option) => ORDER_DEPENDENT.test(String(option)))
}

// A fair shuffle (Fisher-Yates). `rand` is injectable so tests are repeatable.
export function shuffled(list, rand = Math.random) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function clampInt(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

// The settings a paper runs with. `source` is an exam row or a personal exam's stored settings (same field names).
// `bankSize` is how many questions the paper has to draw from.
export function cleanCbtSettings(source, bankSize) {
  const s = source && typeof source === 'object' ? source : {}
  const size = Math.max(1, bankSize || 1)
  const draw = s.mode === 'fixed' ? null : s.draw_count == null || s.draw_count === '' ? null : clampInt(s.draw_count, 1, size, null)
  const perAttempt = draw ?? size
  return {
    mode: s.mode === 'fixed' ? 'fixed' : 'bank',
    drawCount: draw,
    questionsPerAttempt: Math.min(perAttempt, size),
    durationMinutes: clampInt(s.duration_minutes, 1, CBT_MAX_MINUTES, Math.min(CBT_MAX_MINUTES, Math.max(5, perAttempt))),
    passMarkPercent: clampInt(s.pass_mark_percent, 1, 100, 50),
    shuffleQuestions: s.shuffle_questions !== false,
    shuffleOptions: s.shuffle_options !== false,
    showExplanations: s.show_explanations !== false,
    allowStudyMode: s.allow_study_mode !== false,
  }
}

// What a personal exam stores about its settings (kept small, only known fields).
export function sanitizePersonalSettings(input, questionCount) {
  const c = cleanCbtSettings(input, questionCount)
  return {
    duration_minutes: c.durationMinutes,
    pass_mark_percent: c.passMarkPercent,
    shuffle_questions: c.shuffleQuestions,
    shuffle_options: c.shuffleOptions,
    draw_count: c.drawCount,
  }
}

// Picks the questions for one attempt and the order each question's answers are shown in.
// Returns { questionIds, optionOrders }, where optionOrders[id][i] is the original position of the answer shown at i.
export function buildAttempt(bank, settings, rand = Math.random) {
  const playable = bank.filter((q) => (q.type ?? 'multiple') !== 'poll').sort((a, b) => a.position - b.position)
  let chosen = playable
  if (settings.mode !== 'fixed' && settings.drawCount && settings.drawCount < playable.length) chosen = shuffled(playable, rand).slice(0, settings.drawCount)
  const ordered = settings.shuffleQuestions ? shuffled(chosen, rand) : [...chosen].sort((a, b) => a.position - b.position)
  const optionOrders = {}
  for (const q of ordered) {
    if (!isChoiceType(q.type ?? 'multiple')) continue
    const identity = q.options.map((_, i) => i)
    optionOrders[q.id] = settings.shuffleOptions && !keepsOptionOrder(q) ? shuffled(identity, rand) : identity
  }
  return { questionIds: ordered.map((q) => q.id), optionOrders }
}

// A question as the student's browser gets it: no answer key, answers in the order they will see them.
export function publicQuestion(question, optionOrder) {
  const type = question.type ?? 'multiple'
  return {
    id: question.id,
    type,
    text: question.text,
    options: isChoiceType(type) ? (optionOrder ?? question.options.map((_, i) => i)).map((i) => question.options[i]) : [],
  }
}

// Reads one answer sent by the browser ({ choice } = the position it was shown at, or { text }) and turns it into what is
// stored (the original position). Returns null when it is not a usable answer for this question.
export function readAnswer(question, optionOrder, sent) {
  const type = question.type ?? 'multiple'
  if (!sent || typeof sent !== 'object') return null
  if (isChoiceType(type)) {
    if (!Number.isInteger(sent.choice)) return null
    const order = optionOrder ?? question.options.map((_, i) => i)
    if (sent.choice < 0 || sent.choice >= order.length) return null
    return { chosen_index: order[sent.choice] }
  }
  const text = typeof sent.text === 'string' ? sent.text.replace(/[\u0000-\u001f\u007f]/g, '').trim() : ''
  if (!text || text.length > ANSWER_TEXT_MAX) return null
  return { answer_text: text }
}

// Cleans the answers map a browser sends: keeps only usable answers to questions that are part of the attempt.
export function readAnswers(questions, optionOrders, sent) {
  const out = {}
  if (!sent || typeof sent !== 'object' || Array.isArray(sent)) return out
  for (const q of questions) {
    const read = readAnswer(q, optionOrders?.[q.id], sent[q.id])
    if (read) out[q.id] = read
  }
  return out
}

// Marks one stored answer. `null` means unanswered.
export function markAnswer(question, stored) {
  if (!stored) return null
  const type = question.type ?? 'multiple'
  const graded = gradeAnswer(question, isChoiceType(type) ? { chosenIndex: stored.chosen_index } : { answerText: stored.answer_text })
  return graded.ok ? graded.correct === true : false
}

// Grades a whole attempt. `questions` are in the order shown. Returns the score and a compact record per question.
export function gradeAttempt(questions, answers) {
  const results = questions.map((q) => ({ id: q.id, correct: markAnswer(q, answers?.[q.id]) === true }))
  return { score: results.filter((r) => r.correct).length, total: questions.length, results }
}

// The review of one question after submitting: the student's answer next to the right one, in the order shown.
export function reviewQuestion(question, optionOrder, stored, { flagged = false, explanations = true } = {}) {
  const type = question.type ?? 'multiple'
  const base = publicQuestion(question, optionOrder)
  const order = optionOrder ?? (question.options ?? []).map((_, i) => i)
  const answered = Boolean(stored)
  const correct = markAnswer(question, stored) === true
  let chosen = null
  let answerText = null
  let correctIndex = null
  if (isChoiceType(type)) {
    if (answered) chosen = order.indexOf(stored.chosen_index)
    correctIndex = order.indexOf(question.correct_index)
  } else if (answered) answerText = stored.answer_text
  return {
    ...base,
    answered,
    correct,
    flagged,
    chosen: chosen === -1 ? null : chosen,
    answerText,
    correctIndex,
    correctText: isChoiceType(type) ? null : correctText(question),
    explanation: explanations ? question.explanation ?? null : null,
  }
}

export function percentOf(score, total) {
  return total > 0 ? Math.round((score / total) * 1000) / 10 : 0
}

// Normalises a course code the way the admin form does: upper case, single spaces ("mth  101" -> "MTH 101").
export function normaliseCourseCode(raw) {
  return String(raw ?? '').replace(/\s+/g, ' ').trim().toUpperCase()
}
