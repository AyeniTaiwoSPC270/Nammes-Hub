import { bracketRounds, pairPlayers, matchRows, matchWinner, botRoundScore, winnerId } from './quizBracket.js'
import { sessionQuestionIds } from './quizSessionQuestions.js'

// The database side of a hosted-game bracket: pairing everyone when the game starts, and settling a round once its
// last question has been revealed. Both are safe to run twice (they do nothing the second time).

// Pairs up the players and creates the first round. Called when the host starts a bracket game.
export async function startBracket(db, session) {
  if (!session.bracket_mode) return { started: false }
  const { data: existing } = await db.from('quiz_bracket_matches').select('id').eq('session_id', session.id).eq('round', 0)
  if ((existing ?? []).length > 0) return { started: false }
  const [{ data: players }, questionIds] = await Promise.all([
    db.from('quiz_players').select('id, nickname, avatar_id').eq('session_id', session.id),
    sessionQuestionIds(db, session),
  ])
  // The game's own drawn list, so a bracket can never promise more rounds than the questions it will actually ask.
  const rounds = bracketRounds((players ?? []).length, questionIds.length, session.bracket_length)
  if (rounds < 1 || (players ?? []).length === 0) {
    await db.from('quiz_sessions').update({ bracket_rounds: 0, bracket_done: true }).eq('id', session.id)
    return { started: false }
  }
  const pairs = pairPlayers(players, session.id)
  const { error } = await db.from('quiz_bracket_matches').insert(matchRows({ sessionId: session.id, round: 0, pairs, botSkill: session.bracket_bot_skill }))
  if (error) throw error
  await db.from('quiz_sessions').update({ bracket_rounds: rounds }).eq('id', session.id)
  return { started: true, rounds }
}

// Works out the winners of round `round` (0-based) from what players earned on that round's questions, then pairs the
// winners for the next round, or crowns the champion when the bracket is over.
export async function settleRound(db, session, round, nowIso) {
  if (!session.bracket_mode) return { settled: 0 }
  const { data: matches } = await db.from('quiz_bracket_matches').select('*').eq('session_id', session.id).eq('round', round)
  const open = (matches ?? []).filter((m) => !m.settled_at)
  if ((matches ?? []).length === 0 || open.length === 0) return { settled: 0 }

  // The round's questions are the next slice of the game's own drawn list, not the quiz's positions.
  const ids = (await sessionQuestionIds(db, session)).slice(round * session.bracket_length, (round + 1) * session.bracket_length)
  const { data: rows } = ids.length > 0
    ? await db.from('quiz_questions').select('*').in('id', ids)
    : { data: [] }
  const rowById = new Map((rows ?? []).map((q) => [q.id, q]))
  const questions = ids.map((id) => rowById.get(id)).filter(Boolean) // a bot is scored on the same questions players saw
  const { data: answers } = ids.length > 0
    ? await db.from('quiz_answers').select('player_id, question_id, points_awarded, correct, elapsed_ms').eq('session_id', session.id).in('question_id', ids)
    : { data: [] }
  const earned = (playerId) => {
    const mine = (answers ?? []).filter((a) => a.player_id === playerId)
    return {
      score: mine.reduce((sum, a) => sum + (a.points_awarded ?? 0), 0),
      speedMs: mine.filter((a) => a.correct).reduce((sum, a) => sum + (a.elapsed_ms ?? 0), 0),
      present: true,
    }
  }

  const settledNow = []
  for (const match of open) {
    const a = match.player_a ? earned(match.player_a) : { score: 0, speedMs: 0, present: false }
    let b
    if (match.bot_b) b = { ...botRoundScore({ botId: `${session.id}:${match.round}:${match.slot}`, skill: match.bot_skill ?? 'average', questions: questions }), present: true }
    else b = match.player_b ? earned(match.player_b) : { score: 0, speedMs: 0, present: false }
    const winner = matchWinner({ a, b, seedText: match.id })
    const patch = { score_a: a.score, score_b: b.score, winner, settled_at: nowIso }
    await db.from('quiz_bracket_matches').update(patch).eq('id', match.id).is('settled_at', null)
    settledNow.push({ ...match, ...patch })
  }

  const byId = new Map((matches ?? []).map((m) => [m.id, m]))
  for (const m of settledNow) byId.set(m.id, m)
  const all = [...byId.values()].filter((m) => m.settled_at)
  const survivors = all
    .map((m) => ({ id: winnerId(m), nickname: m.winner === 'a' ? m.name_a : m.name_b, avatar_id: m.winner === 'a' ? m.avatar_a : m.avatar_b }))
    .filter((p) => p.id)

  const lastRound = round + 1 >= (session.bracket_rounds ?? 0)
  if (lastRound || survivors.length <= 1) {
    let champion = survivors.length === 1 ? survivors[0].id : null
    if (survivors.length > 1) {
      const { data: totals } = await db.from('quiz_players').select('id, total_score').in('id', survivors.map((s) => s.id))
      champion = [...(totals ?? [])].sort((x, y) => y.total_score - x.total_score)[0]?.id ?? null
    }
    await db.from('quiz_sessions').update({ bracket_done: true, bracket_champion: champion }).eq('id', session.id)
    return { settled: settledNow.length, done: true, champion }
  }
  const pairs = pairPlayers(survivors, `${session.id}:r${round + 1}`)
  const { error } = await db.from('quiz_bracket_matches').insert(matchRows({ sessionId: session.id, round: round + 1, pairs, botSkill: session.bracket_bot_skill }))
  if (error && error.code !== '23505') throw error // 23505: another request already made the next round
  return { settled: settledNow.length, done: false, next: pairs.length }
}
