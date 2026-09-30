// Pure rules for battle mode (challenge a friend and live duel): picking the questions, timing, winners and the
// head-to-head summary. Spec: docs/superpowers/specs/2026-10-01-quiz-battle-mode.md. No database or network in here.
import { scoreAnswer, ANSWER_GRACE_MS } from './quiz.js'
import { seeded } from './quizBots.js'

export const BATTLE_MAX_QUESTIONS = 10
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

// A random subset of the quiz's playable questions (no polls), the same for both sides. `seedText` makes it repeatable
// for a given battle while a rematch (a new seed) gets a different mix.
export function pickBattleQuestions(questions, seedText, max = BATTLE_MAX_QUESTIONS) {
  const playable = questions.filter((q) => (q.type ?? 'multiple') !== 'poll')
  if (playable.length <= max) return playable.sort((a, b) => a.position - b.position)
  const chosen = [...playable].sort((a, b) => seeded(`${seedText}:${a.id}`) - seeded(`${seedText}:${b.id}`)).slice(0, max)
  return chosen.sort((a, b) => a.position - b.position)
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

// Standard Elo: both ratings move by the same amount, more when the result was a surprise. `winner` is 'a', 'b' or null (a draw).
export function eloUpdate(ratingA, ratingB, winner) {
  const expectedA = 1 / (1 + 10 ** ((ratingB - ratingA) / 400))
  const scoreA = winner === 'a' ? 1 : winner === 'b' ? 0 : 0.5
  const change = Math.round(RATING_K * (scoreA - expectedA))
  return { a: ratingA + change, b: ratingB - change, change }
}
