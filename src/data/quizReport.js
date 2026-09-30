import { rankPlayers } from './quiz'
import { isChoiceType } from '../../api/_lib/quizGrading.js'
import { rankTeams } from '../../api/_lib/quizTeams.js'

// Turns the stored answers of one game into the numbers shown on the report page. Pure: the page fetches the rows
// (questions, players and the three summary views) and this only adds them up.

const round1 = (n) => Math.round(n * 10) / 10
const secondsOf = (ms) => (ms == null ? null : round1(ms / 1000))

export function buildReport({ questions, players, questionStats = [], distribution = [], playerStats = [], teams = [], teamScoring = 'average' }) {
  const statByQuestion = new Map(questionStats.map((s) => [s.question_id, s]))
  const votesByQuestion = new Map()
  for (const d of distribution) {
    const list = votesByQuestion.get(d.question_id) ?? []
    list[d.chosen_index] = d.votes
    votesByQuestion.set(d.question_id, list)
  }

  const rows = questions.map((q, index) => {
    const type = q.type ?? 'multiple'
    const stat = statByQuestion.get(q.id)
    const answered = stat?.answered ?? 0
    const scored = type !== 'poll'
    const votes = votesByQuestion.get(q.id) ?? []
    return {
      id: q.id,
      index,
      type,
      text: q.text,
      played: Boolean(stat),
      answered,
      scored,
      accuracy: scored && answered > 0 ? Math.round((stat.correct_count / answered) * 100) : null,
      correctCount: stat?.correct_count ?? 0,
      avgSeconds: secondsOf(stat?.avg_elapsed_ms),
      options: isChoiceType(type)
        ? q.options.map((label, i) => ({ label, votes: votes[i] ?? 0, correct: scored && i === q.correct_index }))
        : [],
    }
  })

  const scoredRows = rows.filter((r) => r.scored && r.answered > 0)
  const byAccuracy = [...scoredRows].sort((a, b) => a.accuracy - b.accuracy || a.index - b.index)
  const hardest = byAccuracy.slice(0, 3)
  const easiest = [...byAccuracy].reverse().slice(0, 3).filter((r) => !hardest.includes(r) || byAccuracy.length <= 3)

  const totalAnswers = scoredRows.reduce((sum, r) => sum + r.answered, 0)
  const totalCorrect = scoredRows.reduce((sum, r) => sum + r.correctCount, 0)
  const timed = rows.filter((r) => r.avgSeconds !== null && r.answered > 0)
  const timedAnswers = timed.reduce((sum, r) => sum + r.answered, 0)
  const avgSeconds = timedAnswers > 0 ? round1(timed.reduce((sum, r) => sum + r.avgSeconds * r.answered, 0) / timedAnswers) : null
  const played = rows.filter((r) => r.played)
  const last = played[played.length - 1]
  const playerCount = players.length

  const statByPlayer = new Map(playerStats.map((s) => [s.player_id, s]))
  const ranked = rankPlayers(players)
  const playerRows = ranked.map((p) => {
    const s = statByPlayer.get(p.id)
    return {
      id: p.id,
      rank: p.rank,
      nickname: p.nickname,
      score: p.total_score,
      avatarId: p.avatar_id,
      answered: s?.answered ?? 0,
      correct: s?.correct_count ?? 0,
      avgSeconds: secondsOf(s?.avg_elapsed_ms),
    }
  })

  return {
    summary: {
      players: playerCount,
      averageScore: playerCount > 0 ? Math.round(players.reduce((sum, p) => sum + p.total_score, 0) / playerCount) : 0,
      accuracy: totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : null,
      averageSeconds: avgSeconds,
      // Players who answered the last question that was played, out of everyone in the game.
      completion: playerCount > 0 && last ? Math.round((last.answered / playerCount) * 100) : null,
      questionsPlayed: played.length,
      questionCount: rows.length,
    },
    questions: rows,
    hardest,
    easiest,
    players: playerRows,
    teams: rankTeams({ teams, players, scoring: teamScoring }),
    teamScoring,
  }
}

const cell = (value) => {
  const text = String(value ?? '')
  const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text
  return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded
}

// Two tables in one CSV: players, then questions.
export function reportToCsv(report) {
  const lines = []
  lines.push(['Rank', 'Nickname', 'Score', 'Answered', 'Correct', 'Average seconds'].map(cell).join(','))
  for (const p of report.players) lines.push([p.rank, p.nickname, p.score, p.answered, p.correct, p.avgSeconds ?? ''].map(cell).join(','))
  if (report.teams.length > 0) {
    lines.push('')
    lines.push(['Team rank', 'Team', 'Score', 'Players'].map(cell).join(','))
    for (const t of report.teams) lines.push([t.rank, t.name, t.score, t.members].map(cell).join(','))
  }
  lines.push('')
  lines.push(['Question', 'Type', 'Text', 'Answered', 'Accuracy %', 'Average seconds'].map(cell).join(','))
  for (const q of report.questions) lines.push([q.index + 1, q.type, q.text, q.answered, q.accuracy ?? '', q.avgSeconds ?? ''].map(cell).join(','))
  return lines.join('\r\n')
}

export function sortPlayers(players, key, direction = 'desc') {
  const sign = direction === 'asc' ? 1 : -1
  return [...players].sort((a, b) => {
    const av = a[key]
    const bv = b[key]
    if (av == null && bv == null) return a.rank - b.rank
    if (av == null) return 1
    if (bv == null) return -1
    if (typeof av === 'string') return sign * av.localeCompare(bv)
    return sign * (av - bv) || a.rank - b.rank
  })
}
