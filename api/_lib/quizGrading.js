import { QUESTION_TYPES } from './quizTypes.js'

// Pure grading and scoring rules for the live quiz (no Node-only imports, so the editor can use them too).
// The server is still the only place that grades a real game.

// ---- Question types and grading (server only) ----
export { QUESTION_TYPES }
export const ANSWER_TEXT_MAX = 40
export const ACCEPTED_ANSWERS_MAX = 8
// Matches the column's own check (20261002100000_cbt_exams.sql). One number, so the editor, the CSV and the community
// set importer cannot each decide for themselves how long an explanation may be.
export const EXPLANATION_MAX = 500

// An absent explanation is stored as null rather than an empty string, so the reveal and the CBT review share one
// "nothing to show" state instead of two. Control characters become spaces first: this is admin prose pasted from a
// document, and an explanation holding a NUL is unreadable in the reveal.
//
// Deliberately does NOT truncate to EXPLANATION_MAX. Truncating here would mean the length check in validateQuestion
// could never fire, and an admin who typed 600 characters would lose 100 of them with no message. The editor's
// maxLength, validateQuestion and the column's own check are three separate guards on purpose.
export function cleanExplanation(raw) {
  const text = String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text || null
}

export function isChoiceType(type) {
  return type === 'multiple' || type === 'truefalse' || type === 'poll'
}

// "3.14", "-2", "1/2" and "1e3" are numbers; anything else (units, words, empty) is not.
export function parseNumber(raw) {
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  if (t.length === 0 || t.length > 24) return null
  const plain = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/
  const fraction = /^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/
  let value = null
  if (plain.test(t)) value = Number(t)
  else {
    const m = fraction.exec(t)
    if (m && Number(m[2]) !== 0) value = Number(m[1]) / Number(m[2])
  }
  return Number.isFinite(value) ? value : null
}

// Case, accents, punctuation and extra spaces never make a typed answer wrong.
export function normaliseText(raw) {
  if (typeof raw !== 'string') return ''
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Checks what a player sent against the question. Returns { ok: false, error } for a submission of the wrong
// shape, otherwise { ok: true, correct, chosenIndex, answerText }. `correct` is null for a poll (nothing to grade).
export function gradeAnswer(question, submission) {
  const type = question.type ?? 'multiple'
  if (isChoiceType(type)) {
    const { chosenIndex } = submission
    if (!Number.isInteger(chosenIndex) || chosenIndex < 0 || chosenIndex >= question.options.length) {
      return { ok: false, error: 'That is not one of the options' }
    }
    return { ok: true, correct: type === 'poll' ? null : chosenIndex === question.correct_index, chosenIndex, answerText: null }
  }

// Order and diagram are submitted without typing anything, so they are graded before the typed-text guard rather
  // than after it. Below it they would be unreachable: an empty answerText is rejected as "type your answer" first.
  if (type === 'order') {
    const { order } = submission
    const n = question.options?.length ?? 0
    const isPermutation = Array.isArray(order) && order.length === n && new Set(order).size === n
      && order.every((i) => Number.isInteger(i) && i >= 0 && i < n)
    if (!isPermutation) return { ok: false, error: 'Put every step in order' }
    // Credit is positional: a step counts only if it is in the right place. Deliberately not an edit distance, because
    // "4 of 6 steps in the right place" is what the reveal has to be able to say.
    let hits = 0
    for (let i = 0; i < n; i += 1) if (order[i] === i) hits += 1
    const credit = n > 0 ? hits / n : 0
    return { ok: true, correct: credit === 1, credit, chosenIndex: null, answerText: '', order }
  }
  if (type === 'diagram') {
    const tap = submission.tap
    const tx = Number(tap?.x)
    const ty = Number(tap?.y)
    if (!tap || typeof tap !== 'object' || !Number.isFinite(tx) || !Number.isFinite(ty)) {
      return { ok: false, error: 'Tap the diagram' }
    }
    const hit = diagramHit({ x: tx, y: ty }, cleanDiagramTargets(question.diagram_targets))
    return { ok: true, correct: hit, chosenIndex: null, answerText: '' }
  }
  const text = typeof submission.answerText === 'string' ? submission.answerText.replace(/[\u0000-\u001f]/g, '').trim() : ''
  if (text.length === 0 || text.length > ANSWER_TEXT_MAX) return { ok: false, error: 'Type your answer' }
  if (type === 'numeric') {
    // A unit question is a numeric question with a unit attached: the number is graded exactly as before, so the
    // existing tolerance code works unchanged, and the unit is a separate comparison that never scales the value.
    const { number, unit } = splitNumberAndUnit(text)
    const value = parseNumber(number)
    if (value === null) return { ok: false, error: 'Enter a number' }
    const target = Number(question.numeric_answer)
    const tolerance = Math.abs(Number(question.numeric_tolerance ?? 0)) + 1e-9 * Math.max(1, Math.abs(target))
    return {
      ok: true,
      correct: Math.abs(value - target) <= tolerance && unitMatches(question, unit),
      chosenIndex: null,
      answerText: text,
    }
  }
  const wanted = new Set((question.accepted_answers ?? []).map(normaliseText))
  return { ok: true, correct: wanted.has(normaliseText(text)), chosenIndex: null, answerText: text }
}

// What to show as "the answer" for typed questions once the reveal is up.
export const ORDER_STEPS_MAX = 12
// One place that turns a graded answer into points, because three surfaces rolled their own and drifted: the hosted
// game credits a partially-right ordering, and battle multiplied its base by `correct` instead, so four steps in the
// right place scored nothing there and the same answer scored in a practice run.
//
// `full` is what the answer would be worth wholly right, after the speed curve and multiplier. The rule is that credit
// is the fraction of the question that landed, and a type that cannot be partial reports credit 1 for a graded answer
// and nothing at all for a miss - so a partial answer is exactly the case where credit sits strictly between the two.
// Anything else that is not correct is worth zero.
export function awardPoints(full, graded) {
  if (!graded) return 0
  if (graded.correct === true) return Math.round(Number(full) || 0)
  const credit = Number(graded.credit)
  if (!Number.isFinite(credit) || credit <= 0 || credit >= 1) return 0
  return Math.round((Number(full) || 0) * credit)
}

export const DIAGRAM_TARGETS_MAX = 12

// ---- Units ----
// A typed unit is normalised before it is compared, because a student typing on a phone produces "kN", "KN",
// "kiloNewton" and "kilo-newton" for the same unit and none of them is a typo worth marking wrong.
//
// The substitutions are one-way on purpose. `N` normalised stays `N` and `kN` normalised is `kN`, so they are
// different strings and cannot match. A global unit registry that canonicalised `kN` to `N` by stripping the prefix
// is exactly how "2500 N" ends up accepted against an answer of "2.5 kN": the value is a thousand times out, and the
// aliases cannot scale it, because the number is graded bare.
export function normaliseUnit(raw) {
  if (typeof raw !== 'string') return ''
  return raw
    .normalize('NFKC')
    .replace(/[\u03bc\u00b5]/g, 'u')
    .replace(/\u00b3/g, '3')
    .replace(/\u00b2/g, '2')
    .replace(/[\u2010-\u2015\u2212\u2796\u279c]/g, '-')
    .toLowerCase()
    .replace(/[\s\-_.]/g, '')
}

// Splits "2500 N" into its number and its unit. The number is then graded exactly as before, which is what lets the
// existing tolerance code work unchanged on a unit question.
export function splitNumberAndUnit(raw) {
  const text = typeof raw === 'string' ? raw.trim() : ''
  if (!text) return { number: '', unit: '' }
  const m = /^\s*([+-]?[\d.,]+(?:[eE][+-]?\d+)?)\s*(.*)$/.exec(text)
  if (!m) return { number: text, unit: '' }
  return { number: m[1], unit: m[2].trim() }
}

// True when the question declares no unit, which is how "ignore whatever was typed" is expressed: there is nothing to
// compare against.
export function unitMatches(question, typedUnit) {
  const canonical = normaliseUnit(question.numeric_unit)
  if (!canonical) return true
  const typed = normaliseUnit(typedUnit)
  if (!typed) return false
  if (typed === canonical) return true
  return (question.numeric_unit_aliases ?? []).some((a) => normaliseUnit(a) === typed)
}

// ---- Diagram ----
// Targets are stored normalised, and stay normalised: processQuizImage downscales to 1280px on upload, so a pixel
// coordinate does not survive the admin re-uploading the same picture at a different size. 0..1 does.
// `ar` is the picture's own width/height, captured when the region was drawn. A normalised circle cannot exist without
// it: x is a fraction of the width and y a fraction of the height, so on a picture that is not square the same number
// covers twice the distance across as it does down. Absent (an older row, or a hand-written one) it means 1, which is
// exactly right for a square and is the old behaviour rather than a new failure.
export function cleanDiagramTargets(raw) {
  const list = Array.isArray(raw) ? raw : []
  const out = []
  for (const t of list.slice(0, DIAGRAM_TARGETS_MAX)) {
    const x = Number(t?.x)
    const y = Number(t?.y)
    const r = Number(t?.r)
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(r)) continue
    if (x < 0 || x > 1 || y < 0 || y > 1 || r <= 0) continue
    const ratio = Number(t?.ar)
    out.push({ x, y, r, ar: Number.isFinite(ratio) && ratio > 0 ? Math.min(Math.max(ratio, 0.02), 50) : 1 })
  }
  return out
}

// The radius is a fraction of min(width, height) of the image, so a circle stays a circle on any display.
//
// Scaling the y axis by the picture's aspect is what makes that true. A tap at normalised (dx, dy) is `dx * W` pixels
// across and `dy * H` down, and the region is `r * min(W, H)` pixels in every direction; dividing the pixel distance by
// W gives `dx^2 + (dy * H/W)^2 <= (r * min(W, H) / W)^2`, and `H/W` is `1 / ar`. On a square picture both factors are 1
// and this is the plain `hypot`, which is why a wrong version here passes every square test and only misgrades a
// landscape one.
export function diagramHit(point, targets) {
  const list = Array.isArray(targets) ? targets : []
  for (const t of list) {
    const ratio = t.ar && t.ar > 0 ? t.ar : 1
    const ky = 1 / ratio
    if (Math.hypot(point.x - t.x, (point.y - t.y) * ky) <= t.r * Math.min(1, ky)) return true
  }
  return false
}

// ---- The object-contain letterbox ----
// The rendered box is not the image box: the phone shows the picture at max-h-40 inside a zoom overlay and the editor
// shows it in a wider frame, both through `object-contain`. A tap has to be mapped back through the same rectangle on
// both surfaces, or a marker grades wrong on every handset while looking perfectly placed in the editor.
export function letterboxRect(box, image) {
  const bw = Math.max(0, Number(box?.width) || 0)
  const bh = Math.max(0, Number(box?.height) || 0)
  const iw = Math.max(1, Number(image?.width) || 1)
  const ih = Math.max(1, Number(image?.height) || 1)
  const scale = Math.min(bw / iw, bh / ih)
  const width = iw * scale
  const height = ih * scale
  return { left: (bw - width) / 2, top: (bh - height) / 2, width, height }
}

// Rendered pixels -> normalised 0..1 within the image's own box.
export function toNormalized(point, rect, image) {
  return {
    x: (Number(point?.x) - rect.left) / Math.max(1e-9, rect.width),
    y: (Number(point?.y) - rect.top) / Math.max(1e-9, rect.height),
  }
}

// Normalised -> rendered pixels, used to draw an authored marker where it will actually appear.
export function toRenderedPoint(normalized, rect) {
  return { x: rect.left + normalized.x * rect.width, y: rect.top + normalized.y * rect.height }
}

export function correctText(question) {
  if (question.type === 'numeric') {
    const unit = normaliseUnit(question.numeric_unit)
    // Shown normalised (N, not Newtons) because that is the form the student was asked to type back.
    return unit ? `${String(Number(question.numeric_answer))} ${unit}` : String(Number(question.numeric_answer))
  }
  if (question.type === 'order') return (question.options ?? []).map((o, i) => `${i + 1}. ${o}`).join('   ')
  if (question.type === 'diagram') return null
  if (question.type === 'text') return (question.accepted_answers ?? [])[0] ?? ''
  return null
}

// ---- Streaks, power-ups, double rounds, comeback boost ----
export const STREAK_BONUS_STEP = 50
export const STREAK_BONUS_MAX = 200
export const COMEBACK_RATE = 0.15
export const POWERUPS = ['double', 'fifty']

export function sanitizeGameOptions(input) {
  const o = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  // `late_join` defaults on: a quiz that has not opted out still takes the person who is two minutes late. The other
  // three default off because they change the scoring; this one only changes who may sit down.
  return { streaks: o.streaks === true, powerups: o.powerups === true, comeback: o.comeback === true, late_join: o.late_join !== false }
}

// 2nd correct answer in a row earns +50, 3rd +100, 4th +150, 5th and beyond +200.
export function streakBonus(streakAfter) {
  return streakAfter >= 2 ? Math.min(STREAK_BONUS_STEP * (streakAfter - 1), STREAK_BONUS_MAX) : 0
}

// True for players in the bottom quarter (at least 4 players). Everyone tied at the cut-off score is treated as
// level, so the first question of a game (all on 0) never gives anyone a boost.
export function isComeback(scoresBefore, playerId) {
  const scores = [...scoresBefore.values()].sort((a, b) => b - a)
  const n = scores.length
  if (n < 4 || !scoresBefore.has(playerId)) return false
  const cutoff = scores[n - Math.floor(n / 4) - 1]
  return scoresBefore.get(playerId) < cutoff
}

// Turns a graded answer into points. `base` is scoreAnswer() (speed-based). Polls never score or touch streaks.
export function computeAward({ correct, base, credit = 1, streakBefore = 0, multiplier = 1, powerup = null, comeback = false, options = {} }) {
  if (correct === null) return { points: 0, bonus: 0, streakAfter: streakBefore, parts: null }
  if (!correct && credit >= 1) return { points: 0, bonus: 0, streakAfter: 0, parts: null }
  // Partial credit is the first time a wrong answer is worth anything. It gets no streak bonus and no comeback boost,
  // because both of those are statements about having got it right.
  if (!correct) {
    const factor = (multiplier === 2 ? 2 : 1) * (powerup === 'double' ? 2 : 1)
    // Rounded explicitly rather than left fractional: points_awarded is an integer column and points_multiplier is
    // check (in (1, 2)), so a third of a question at 2x does not divide evenly. Rounding here means the reveal and the
    // leaderboard show the number that was actually stored, instead of the row disagreeing with the client by a
    // fraction on every odd step count.
    const points = Math.round(base * factor * credit)
    return { points, bonus: 0, streakAfter: 0, parts: { base, streak: 0, comeback: 0, factor, credit } }
  }
  const streakAfter = streakBefore + 1
  const streak = options.streaks ? streakBonus(streakAfter) : 0
  const boost = options.comeback && comeback ? Math.round(base * COMEBACK_RATE) : 0
  const factor = (multiplier === 2 ? 2 : 1) * (powerup === 'double' ? 2 : 1)
  const points = (base + streak + boost) * factor
  return { points, bonus: points - base, streakAfter, parts: { base, streak, comeback: boost, factor } }
}
