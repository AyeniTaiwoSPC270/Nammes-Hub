// Drawing a set of questions out of a quiz's bank, and the order each question's answers are shown in.
// Shared by the live quiz, battles and practice; CBT exams already did this and now reuse it.
// Pure rules only: no database, no network. Spec: docs/superpowers/specs/2026-10-07-quiz-question-banks.md
import { isChoiceType } from './quizGrading.js'

// A quiz cannot hold more questions than the editor allows, so a draw can never ask for more than this either.
export const DRAW_MAX_QUESTIONS = 200

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

export function clampInt(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

// The settings one game runs with. `source` is a quiz's draw_settings (or anything shaped like it), `bankSize` is how
// many questions there actually are to draw from.
//
// Shuffling is opt-in rather than opt-out on purpose. A quiz with no settings at all predates question banks and must
// keep playing every question in order with its answers as typed; the editor writes an explicit true for a new quiz.
export function cleanDrawSettings(source, bankSize) {
  const s = source && typeof source === 'object' ? source : {}
  const size = Math.max(1, bankSize || 1)
  const draw = s.draw_count == null || s.draw_count === '' ? null : clampInt(s.draw_count, 1, Math.min(DRAW_MAX_QUESTIONS, size), null)
  return {
    drawCount: draw,
    questionsPerGame: draw ?? size,
    shuffleQuestions: s.shuffle_questions === true,
    shuffleOptions: s.shuffle_options === true,
  }
}

// The questions one game asks, and the order it asks them in.
// `bank` is the questions to choose from (the caller decides whether polls are in it), in any order: they are put back
// into the quiz's own order first, because that is the canonical one.
// Returns { questionIds, optionOrders }, where optionOrders[id][i] is the original position of the answer shown at i.
export function buildQuestionSet(bank, settings, rand = Math.random) {
  const inOrder = [...bank].sort((a, b) => a.position - b.position)
  const chosen = settings.drawCount && settings.drawCount < inOrder.length
    ? shuffled(inOrder, rand).slice(0, settings.drawCount)
    : inOrder
  const ordered = settings.shuffleQuestions ? shuffled(chosen, rand) : chosen
  const optionOrders = {}
  for (const q of ordered) {
    if (!isChoiceType(q.type ?? 'multiple')) continue
    const identity = (q.options ?? []).map((_, i) => i)
    optionOrders[q.id] = settings.shuffleOptions && !keepsOptionOrder(q) ? shuffled(identity, rand) : identity
  }
  return { questionIds: ordered.map((q) => q.id), optionOrders }
}

// The options of one question, in the order they are shown. A missing order means answers as typed.
export function shownOptions(question, optionOrder) {
  const type = question.type ?? 'multiple'
  if (!isChoiceType(type)) return []
  const order = optionOrder ?? (question.options ?? []).map((_, i) => i)
  return order.map((i) => question.options[i])
}

// Which answer was shown at `shown`, as the position it is stored under. Null when it is not one of this question's
// answers, so a bad or stale index is refused rather than graded against the wrong answer.
export function originalIndex(optionOrder, shown, optionCount) {
  const order = optionOrder ?? Array.from({ length: optionCount }, (_, i) => i)
  if (!Number.isInteger(shown) || shown < 0 || shown >= order.length) return null
  return order[shown]
}

// Where a stored answer sits in the order it was shown, for sending back a player's own pick or the right answer.
export function shownIndex(optionOrder, stored, optionCount) {
  const order = optionOrder ?? Array.from({ length: optionCount }, (_, i) => i)
  const at = order.indexOf(stored)
  return at === -1 ? null : at
}

// A whole question row moved into the order the audience is looking at: the options rearranged, and correct_index pointed
// at where the right answer now sits. Used by the projector, which reads questions straight from the database rather than
// going through the API, so it has to apply the same order the phones were given. Without this the big screen and the
// phones show different answers at different positions.
export function shownQuestion(question, optionOrder) {
  const type = question.type ?? 'multiple'
  if (!isChoiceType(type) || !optionOrder) return question
  const count = (question.options ?? []).length
  const correct = shownIndex(optionOrder, question.correct_index, count)
  return {
    ...question,
    options: shownOptions(question, optionOrder),
    // A question with no stored answer (a poll) has no correct_index, and one it does not list is left as null rather than
    // guessed at.
    correct_index: correct,
  }
}

// One stored answer row moved into the order the audience is looking at, so the tallies on the projector line up with the
// tiles above them.
export function shownAnswer(answer, optionOrder) {
  if (!optionOrder || answer.chosen_index == null) return answer
  const at = shownIndex(optionOrder, answer.chosen_index, optionOrder.length)
  return at === null ? answer : { ...answer, chosen_index: at }
}

// The projector holds its questions in an array it indexes by the game's current_question_index, so slot i has to be the
// question the phones are being asked at index i.
//
// A question can go missing: an admin editing the quiz mid-game deletes it, and the row is gone by the time the projector
// asks for it. Dropping it would slide every later question along by one, so the projector would show a different question
// from the one the phones are answering. Leaving a null in its slot keeps the index meaning what it says, and the count
// honest. `rows` are the database rows for these ids in any order.
export function shownSlots(ids, rows, orders = {}) {
  const byId = new Map((rows ?? []).map((q) => [q.id, q]))
  return (ids ?? []).map((id) => {
    const row = byId.get(id)
    return row ? shownQuestion(row, orders[row.id] ?? null) : null
  })
}