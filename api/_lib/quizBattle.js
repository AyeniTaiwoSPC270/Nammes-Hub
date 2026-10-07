// Pure rules for battle mode (challenge a friend and live duel): picking the questions, timing, winners and the
// head-to-head summary. Spec: docs/superpowers/specs/2026-10-01-quiz-battle-mode.md. No database or network in here.
import { scoreAnswer, ANSWER_GRACE_MS } from './quiz.js'
import { buildQuestionSet } from './quizDraw.js'

// A battle is two people answering at their own pace, so it stays much shorter than a hosted game. The admin can set it to
// anything up to here; the schema's own ceiling is kept in step in supabase/migrations/20261007120000_quiz_question_draw.sql.
export const BATTLE_MAX_QUESTIONS = 50
export const BATTLE_CHALLENGE_DAYS = 7
export const DUEL_START_DELAY_MS = 4000 // the 3-2-1 before the first question
export const DUEL_NEXT_DELAY_MS = 1500 // a breath between the reveal and the next question
export const DUEL_REVEAL_MS = 5000
export const DUEL_AWAY_MS = 20_000 // after this long silent, the other player is told to wait
export const DUEL_FORFEIT_MS = 45_000 // after this long silent, the other player wins
export const DUEL_OPEN_TTL_MS = 10 * 60_000 // a duel nobody joins is dropped after this

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I, so a code is easy to read out

export function generateBattleCode(rand = Math.random) {
  let code = ''
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)]
  return code
}

export function isBattleCode(value) {
  return typeof value === 'string' && /^[A-Z0-9]{6}$/.test(value.toUpperCase())
}

// How many questions a battle of this quiz will ask, once the admin's own length and the size of the bank are both taken
// into account. The one place that decides it, so the quiz picker and the battle itself can never disagree.
export function battleQuestionCount(battleCount, playableCount) {
  const size = Math.max(1, playableCount || 1)
  const wanted = battleCount == null || battleCount === '' ? BATTLE_MAX_QUESTIONS : Number(battleCount)
  if (!Number.isFinite(wanted)) return Math.min(size, BATTLE_MAX_QUESTIONS)
  return Math.min(size, BATTLE_MAX_QUESTIONS, Math.max(1, Math.round(wanted)))
}

// The questions one battle asks, and the order each one's answers are shown in. The random source is seeded from the battle,
// so the same battle always gets the same mix (both sides get it, and a phone that reloads sees it again) while a rematch,
// with a new seed, gets a different one.
export function pickBattleQuestions(questions, seedText, settings = {}) {
  const playable = questions.filter((q) => (q.type ?? 'multiple') !== 'poll') // a poll cannot be answered head to head
  const rand = seededRandom(seedText)
  const draw = battleQuestionCount(settings.battleCount, playable.length)
  const { questionIds, optionOrders } = buildQuestionSet(playable, {
    drawCount: draw,
    shuffleQuestions: settings.shuffleQuestions === true,
    shuffleOptions: settings.shuffleOptions === true,
  }, rand)
  return { questionIds, optionOrders }
}

// A small repeatable random source built from the battle's seed (xorshift32). quizBots' seeded() answers one number for a
// given string; a draw needs a whole stream of them, so this is its own thing.
export function seededRandom(seedText) {
  let state = 0
  for (let i = 0; i < seedText.length; i++) state = (state * 31 + seedText.charCodeAt(i)) >>> 0
  return () => {
    // xorshift32: cheap, and identical every time for the same seed.
    state ^= state << 13; state >>>= 0
    state ^= state >>> 17
    state ^= state << 5; state >>>= 0
    return state / 4294967296
  }
}

// What a right answer is worth after `elapsedMs` (same speed rule as live games and practice; double rounds count twice).
export function battleQuestionPoints(question, elapsedMs) {
  const base = scoreAnswer({ correct: true, points: question.points, timeLimitSeconds: question.time_limit_seconds, elapsedMs })
  return base * (question.points_multiplier === 2 ? 2 : 1)
}

// Higher total wins; a tie goes to the side that was faster on its right answers; otherwise it is a draw (null).
export function decideWinner(a, b) {
  if (a.total_score !== b.total_score) return a.total_score > b.total_score ? 'a' : 'b'
  if (a.speedMs !== b.speedMs) return a.speedMs < b.speedMs ? 'a' : 'b'
  return null
}

// Sum of the time taken on right answers (a missed question adds nothing, so only right answers decide a tie).
export function speedOf(answers) {
  return answers.filter((x) => x.correct).reduce((sum, x) => sum + (x.elapsed_ms ?? 0), 0)
}

// Question by question: what each side did and who won it.
export function headToHead(questions, answersA, answersB) {
  return questions.map((q) => {
    const a = answersA.find((x) => x.question_id === q.id) ?? null
    const b = answersB.find((x) => x.question_id === q.id) ?? null
    const pa = a?.points_awarded ?? 0
    const pb = b?.points_awarded ?? 0
    return {
      questionId: q.id,
      a: { correct: a?.correct === true, points: pa, answered: Boolean(a) },
      b: { correct: b?.correct === true, points: pb, answered: Boolean(b) },
      winner: pa === pb ? null : pa > pb ? 'a' : 'b',
    }
  })
}

// Where a duel goes next, from the clock and who has answered: 'reveal', 'next', 'finish' or null (stay put).
export function duelNextStep({ battle, nowMs, limitMs, bothAnswered, questionCount }) {
  if (battle.state === 'question') {
    const elapsed = nowMs - new Date(battle.question_started_at).getTime()
    if (elapsed < 0) return null
    return bothAnswered || elapsed > limitMs + ANSWER_GRACE_MS ? 'reveal' : null
  }
  if (battle.state === 'reveal') {
    if (nowMs - new Date(battle.reveal_started_at).getTime() < DUEL_REVEAL_MS) return null
    return battle.current_index + 1 >= questionCount ? 'finish' : 'next'
  }
  return null
}

// "away" if a side has been silent for a while, "gone" once the other player has won by default.
export function presence(lastSeenIso, nowMs) {
  const silent = nowMs - new Date(lastSeenIso).getTime()
  if (silent > DUEL_FORFEIT_MS) return 'gone'
  if (silent > DUEL_AWAY_MS) return 'away'
  return 'here'
}

// ---- Rankings ----
export const RATING_START = 1000
export const RATING_K = 32
// The length a battle used to have, and therefore the length at which a result counts for a full RATING_K. A battle the
// admin has shortened counts for less, and one they have lengthened counts for more.
export const RATING_REFERENCE_QUESTIONS = 10
// How much of a battle's weight is left when the result was exactly what the ratings predicted. Below 1 so a battle nobody
// learned anything from is never worth a full step.
export const RATING_MIN_WEIGHT = 0.25
// Damping on the margin, so a blowout counts for more than a close game but not without limit.
export const RATING_MARGIN_EXPONENT = 0.5

// How much one battle is worth as evidence, between 0 and a little over 1.
//
// `trust` grows with the square root of the number of questions asked: a two-question result is mostly luck, and a
// fifty-question one is a real test. `decisive` grows with how lopsided the score was, as a share of the points that were
// actually on the table, damped so that winning by a mile does not count for infinitely more than winning narrowly.
//
// This is a judgement call, not a derivation: a strict Bayesian would *shrink* a confident player's step as evidence grows.
// Growing it instead matches how FIDE treats blitz, and it is what makes a longer battle mean more.
export function battleWeight({ questionCount, winnerPoints = 0, loserPoints = 0, pointsAvailable = 0 }) {
  const trust = Math.sqrt(Math.max(1, questionCount) / RATING_REFERENCE_QUESTIONS)
  const gap = pointsAvailable > 0 ? Math.abs(winnerPoints - loserPoints) / pointsAvailable : 0
  const decisive = Math.min(1, gap) ** RATING_MARGIN_EXPONENT
  return trust * (RATING_MIN_WEIGHT + (1 - RATING_MIN_WEIGHT) * decisive)
}

// The most points a battle's questions could have awarded between them, so a margin can be measured as a share of what was
// on the table rather than as a raw score gap. A win on every question at full speed is worth 1.
export function pointsOnOffer(questions) {
  return (questions ?? []).reduce((sum, q) => sum + battleQuestionPoints(q, 0), 0)
}

// Standard Elo: both ratings move by the same amount, more when the result was a surprise. `winner` is 'a', 'b' or null (a
// draw). `weight` scales the step, and defaults to 1 so a caller with nothing to say about the battle gets today's numbers.
export function eloUpdate(ratingA, ratingB, winner, weight = 1) {
  const expectedA = 1 / (1 + 10 ** ((ratingB - ratingA) / 400))
  const scoreA = winner === 'a' ? 1 : winner === 'b' ? 0 : 0.5
  const change = Math.round(RATING_K * weight * (scoreA - expectedA))
  return { a: ratingA + change, b: ratingB - change, change }
}
