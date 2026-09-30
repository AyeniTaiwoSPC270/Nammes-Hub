// The pure rules of a hosted-game knockout bracket (battle mode, phase C), with no server-only imports so the host screen
// and phones can use them too. The server-side parts (bot scores, database rows) are in quizBracket.js.
import { seeded } from './quizBots.js'

export const BRACKET_LENGTHS = [1, 3, 5]

// How many rounds a game can hold: enough to get down to one player, limited by how many questions the quiz has.
export function bracketRounds(playerCount, questionCount, length) {
  const needed = Math.max(1, Math.ceil(Math.log2(Math.max(2, playerCount))))
  return Math.max(0, Math.min(needed, Math.floor(questionCount / length)))
}

export const roundOfQuestion = (index, length) => Math.floor(index / length)
export const isRoundEnd = (index, length) => (index + 1) % length === 0

// Random pairs for the players given (repeatable for one seed). A last odd player gets `b: null`, meaning a bot.
export function pairPlayers(players, seedText) {
  const order = [...players].sort((x, y) => seeded(`${seedText}:${x.id}`) - seeded(`${seedText}:${y.id}`))
  const pairs = []
  for (let i = 0; i < order.length; i += 2) pairs.push({ a: order[i], b: order[i + 1] ?? null })
  return pairs
}

// Higher match score wins; a tie goes to whoever was faster on right answers; then a repeatable coin flip.
// A side that is no longer in the game (removed by the host) loses to one that is.
export function matchWinner({ a, b, seedText }) {
  if (a.present !== b.present) return a.present ? 'a' : 'b'
  if (!a.present && !b.present) return null
  if (a.score !== b.score) return a.score > b.score ? 'a' : 'b'
  if (a.speedMs !== b.speedMs) return a.speedMs < b.speedMs ? 'a' : 'b'
  return seeded(seedText, 11) < 0.5 ? 'a' : 'b'
}

// Who won a settled match, as a player id (null when a bot won or nobody did).
export function winnerId(match) {
  if (!match.settled_at || !match.winner) return null
  return match.winner === 'a' ? match.player_a : match.player_b
}

// Who beat whom on the way to the top: the champion, the runner-up (the champion's opponent in the last match) and the
// losers of the match before that.
export function podium(matches, championId) {
  if (!championId) return null
  const won = matches.filter((m) => winnerId(m) === championId).sort((x, y) => y.round - x.round)
  const final = won[0]
  if (!final) return { champion: championId, runnerUp: null, semifinalists: [] }
  const loser = (m) => (m.winner === 'a' ? { id: m.player_b, name: m.name_b, avatar: m.avatar_b, bot: m.bot_b } : { id: m.player_a, name: m.name_a, avatar: m.avatar_a, bot: false })
  const semis = matches
    .filter((m) => m.round === final.round - 1 && m.settled_at && winnerId(m) !== null)
    .map((m) => loser(m))
    .filter((p) => !p.bot && p.id !== championId)
  return { champion: championId, runnerUp: loser(final), semifinalists: semis.slice(0, 2) }
}

// What one player's phone shows about the bracket.
export function bracketViewFor(matches, playerId, session) {
  if (!session.bracket_mode) return null
  const mine = matches.filter((m) => m.player_a === playerId || m.player_b === playerId).sort((x, y) => y.round - x.round)[0] ?? null
  const base = { rounds: session.bracket_rounds ?? 0, length: session.bracket_length, done: Boolean(session.bracket_done) }
  if (!mine) return { ...base, status: session.bracket_champion === playerId ? 'champion' : 'out', match: null }
  const iAmA = mine.player_a === playerId
  const settled = Boolean(mine.settled_at)
  const won = settled ? winnerId(mine) === playerId : null
  let status = 'alive'
  if (session.bracket_champion === playerId) status = 'champion'
  else if (settled && won === false) status = 'out'
  return {
    ...base,
    status,
    match: {
      round: mine.round,
      settled,
      won,
      opponent: iAmA
        ? { nickname: mine.name_b, avatarId: mine.avatar_b ?? 0, isBot: mine.bot_b }
        : { nickname: mine.name_a, avatarId: mine.avatar_a ?? 0, isBot: false },
      ...(settled ? { myScore: iAmA ? mine.score_a : mine.score_b, theirScore: iAmA ? mine.score_b : mine.score_a } : {}),
    },
  }
}
