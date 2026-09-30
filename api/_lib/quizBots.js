// Test bots for the live quiz. Everything a bot does is worked out from its id and the question's id, so the same bot
// always behaves the same way on a question and the host page can ask "who is due to answer now?" as often as it likes.

export const BOT_SKILLS = ['beginner', 'average', 'expert']
export const BOT_SKILL_CHOICES = [...BOT_SKILLS, 'mixed']
export const MAX_BOTS_AT_ONCE = 100

// Chance of a right answer by skill and question difficulty.
const ACCURACY = {
  beginner: { easy: 0.65, medium: 0.35, hard: 0.15 },
  average: { easy: 0.88, medium: 0.62, hard: 0.33 },
  expert: { easy: 0.97, medium: 0.9, hard: 0.75 },
}
// Fraction of the time limit a bot usually takes: experts are quick, beginners slow.
const PACE = { beginner: [0.35, 0.8], average: [0.25, 0.7], expert: [0.12, 0.45] }

// Questions without a difficulty are judged by their points (1000 is standard).
export function questionDifficulty(question) {
  if (['easy', 'medium', 'hard'].includes(question.difficulty)) return question.difficulty
  const points = Number(question.points) || 1000
  return points >= 1500 ? 'hard' : points >= 750 ? 'medium' : 'easy'
}

// A number in [0, 1) that depends only on the text given (and `salt`).
export function seeded(text, salt = 0) {
  let h = 2166136261 ^ salt
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  h ^= h >>> 15
  h = Math.imul(h, 2246822507)
  h ^= h >>> 13
  h = Math.imul(h, 3266489909)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

// "Mixed" spreads bots like a real crowd: a few beginners, mostly average, a few experts. `index` is the bot's position in the batch.
export function skillForBot(choice, index) {
  if (BOT_SKILLS.includes(choice)) return choice
  const crowd = ['average', 'beginner', 'average', 'expert', 'average', 'beginner', 'average', 'average', 'expert', 'beginner']
  return crowd[index % crowd.length]
}

// What one bot does with one question: how long it thinks, whether it gets it right, and what it submits.
export function botDecision({ botId, skill, question, limitMs }) {
  const key = `${botId}:${question.id}`
  const difficulty = questionDifficulty(question)
  const knack = (seeded(botId, 7) - 0.5) * 0.3 // each bot is a bit better or worse than its level
  const chance = Math.min(0.98, Math.max(0.03, (ACCURACY[skill] ?? ACCURACY.average)[difficulty] + knack))
  const correct = seeded(key, 1) < chance
  const [fast, slow] = PACE[skill] ?? PACE.average
  const thinkMs = Math.round(limitMs * (fast + (slow - fast) * seeded(key, 2)))
  const pick = (n) => Math.floor(seeded(key, 3) * n)
  const type = question.type ?? 'multiple'

  if (type === 'poll') return { thinkMs, correct: null, submission: { chosenIndex: pick(question.options.length) } }
  if (type === 'multiple' || type === 'truefalse') {
    const wrong = question.options.map((_, i) => i).filter((i) => i !== question.correct_index)
    return { thinkMs, correct, submission: { chosenIndex: correct ? question.correct_index : wrong[pick(wrong.length)] } }
  }
  if (type === 'numeric') {
    const target = Number(question.numeric_answer)
    const off = Math.abs(Number(question.numeric_tolerance ?? 0)) + 1 + pick(5)
    return { thinkMs, correct, submission: { answerText: String(correct ? target : target + off) } }
  }
  const accepted = question.accepted_answers ?? []
  return { thinkMs, correct, submission: { answerText: correct && accepted.length > 0 ? accepted[0] : 'not sure' } }
}

const FIRST = ['Tobi', 'Amaka', 'Kunle', 'Ngozi', 'Seyi', 'Halima', 'Emeka', 'Yetunde', 'Ibrahim', 'Chioma', 'Femi', 'Zainab', 'Uche', 'Bisi', 'Dami', 'Hauwa', 'Kelechi', 'Lola', 'Musa', 'Nneka', 'Obi', 'Peace', 'Qudus', 'Rita', 'Sola', 'Tunde', 'Uju', 'Victor', 'Wale', 'Xena', 'Yemi', 'Zara', 'Ada', 'Bayo', 'Chidi', 'Dara', 'Efe', 'Funmi', 'Gbenga', 'Ife', 'Jide', 'Kemi', 'Lade', 'Mide', 'Niyi', 'Ola', 'Precious', 'Rotimi', 'Sade', 'Tayo']
const TAIL = ['Pi', 'Sigma', 'Euler', 'Delta', 'Sine', 'Theta', 'Vector', 'Matrix', 'Gauss', 'Newton', 'Limit', 'Prime', 'Root', 'Axiom']

// `count` nicknames (at most 20 characters, never one already `taken`) for a batch of bots.
export function botNicknames(count, taken = []) {
  const used = new Set(taken.map((n) => n.toLowerCase()))
  const names = []
  for (let i = 0; names.length < count; i++) {
    const base = `${FIRST[i % FIRST.length]}_${TAIL[(i * 3 + Math.floor(i / FIRST.length)) % TAIL.length]}`
    const name = i < FIRST.length * 2 ? base : `${base}${Math.floor(i / FIRST.length)}`
    if (!used.has(name.toLowerCase())) {
      used.add(name.toLowerCase())
      names.push(name)
    }
  }
  return names
}
