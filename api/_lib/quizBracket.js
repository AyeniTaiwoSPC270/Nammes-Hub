// Server side of the hosted-game knockout bracket (battle mode, phase C). Spec: docs/superpowers/specs/2026-10-01-quiz-battle-mode.md
//
// The bracket is an overlay on a normal hosted game. The game runs as usual; questions are grouped into rounds of
// `length` questions (best of 1, 3 or 5). Every round, each pair's match score is what the two players earned on that
// round's questions, the higher score moves on, and the winners are paired again. A player left without an opponent faces
// a bot. Everyone keeps answering all questions, but only the players still in the bracket count towards it.
import { scoreAnswer } from './quiz.js'
import { botDecision, botNicknames, skillForBot, seeded } from './quizBots.js'

export * from './quizBracketMath.js'

// What a bot opponent "scores" over the questions of a round, on the same speed rule as real players.
export function botRoundScore({ botId, skill, questions }) {
  let score = 0
  let speedMs = 0
  for (const q of questions) {
    const limitMs = q.time_limit_seconds * 1000
    const d = botDecision({ botId, skill, question: q, limitMs })
    if (d.correct === true) {
      const base = scoreAnswer({ correct: true, points: q.points, timeLimitSeconds: q.time_limit_seconds, elapsedMs: d.thinkMs })
      score += base * (q.points_multiplier === 2 ? 2 : 1)
      speedMs += d.thinkMs
    }
  }
  return { score, speedMs }
}

// The rows for a round's matches, from pairs of players (see pairPlayers).
export function matchRows({ sessionId, round, pairs, botSkill }) {
  const names = botNicknames(60)
  return pairs.map(({ a, b }, slot) => {
    const row = { session_id: sessionId, round, slot, player_a: a.id, name_a: a.nickname, avatar_a: a.avatar_id ?? 0, bot_b: false }
    if (b) return { ...row, player_b: b.id, name_b: b.nickname, avatar_b: b.avatar_id ?? 0 }
    const id = `${sessionId}:${round}:${slot}`
    return {
      ...row,
      player_b: null,
      bot_b: true,
      bot_skill: skillForBot(botSkill, slot),
      name_b: names[Math.floor(seeded(id, 3) * names.length)],
      avatar_b: Math.floor(seeded(id, 5) * 50),
    }
  })
}
