import { describe, it, expect } from 'vitest'
import { buildReport, reportToCsv, sortPlayers } from './quizReport'

const questions = [
  { id: 'q1', type: 'multiple', text: 'Easy?', options: ['a', 'b', 'c'], correct_index: 1 },
  { id: 'q2', type: 'multiple', text: 'Hard?', options: ['a', 'b'], correct_index: 0 },
  { id: 'q3', type: 'poll', text: 'Fav?', options: ['x', 'y'], correct_index: null },
  { id: 'q4', type: 'numeric', text: 'Pi?', options: [], numeric_answer: 3.14 },
  { id: 'q5', type: 'multiple', text: 'Never played', options: ['a', 'b'], correct_index: 0 },
]
const players = [
  { id: 'p1', nickname: 'Ada', total_score: 3000, avatar_id: 1 },
  { id: 'p2', nickname: 'Bayo', total_score: 1000, avatar_id: 2 },
  { id: 'p3', nickname: 'Chidi', total_score: 1000, avatar_id: 3 },
  { id: 'p4', nickname: 'Dara', total_score: 0, avatar_id: 4 },
]
const questionStats = [
  { question_id: 'q1', answered: 4, correct_count: 4, avg_elapsed_ms: 2000 },
  { question_id: 'q2', answered: 4, correct_count: 1, avg_elapsed_ms: 6000 },
  { question_id: 'q3', answered: 3, correct_count: 0, avg_elapsed_ms: 1000 },
  { question_id: 'q4', answered: 2, correct_count: 1, avg_elapsed_ms: 10_000 },
]
const distribution = [
  { question_id: 'q1', chosen_index: 1, votes: 4 },
  { question_id: 'q2', chosen_index: 0, votes: 1 },
  { question_id: 'q2', chosen_index: 1, votes: 3 },
  { question_id: 'q3', chosen_index: 0, votes: 2 },
  { question_id: 'q3', chosen_index: 1, votes: 1 },
]
const playerStats = [
  { player_id: 'p1', answered: 4, correct_count: 3, avg_elapsed_ms: 2500 },
  { player_id: 'p2', answered: 3, correct_count: 1, avg_elapsed_ms: 4000 },
]
const report = buildReport({ questions, players, questionStats, distribution, playerStats })

describe('buildReport', () => {
  it('sums the headline numbers over scored questions only', () => {
    expect(report.summary).toMatchObject({ players: 4, averageScore: 1250, questionsPlayed: 4, questionCount: 5 })
    // scored answers: q1 4/4, q2 1/4, q4 1/2  => 6 of 10
    expect(report.summary.accuracy).toBe(60)
    // weighted by answers: (4*2 + 4*6 + 3*1 + 2*10) / 13 = 4.2 (polls still count for time)
    expect(report.summary.averageSeconds).toBe(4.2)
    // the last question played (q4) was answered by 2 of 4
    expect(report.summary.completion).toBe(50)
  })
  it('gives each question its accuracy, time and votes per option', () => {
    const [q1, q2, q3, q4, q5] = report.questions
    expect(q1).toMatchObject({ accuracy: 100, avgSeconds: 2, answered: 4 })
    expect(q1.options.map((o) => [o.label, o.votes, o.correct])).toEqual([['a', 0, false], ['b', 4, true], ['c', 0, false]])
    expect(q2).toMatchObject({ accuracy: 25, avgSeconds: 6 })
    expect(q3).toMatchObject({ scored: false, accuracy: null })
    expect(q3.options.every((o) => !o.correct)).toBe(true)
    expect(q4).toMatchObject({ accuracy: 50, options: [] })
    expect(q5).toMatchObject({ played: false, answered: 0, accuracy: null })
  })
  it('calls out the hardest and easiest questions, never a poll or an unplayed one', () => {
    expect(report.hardest.map((r) => r.text)).toEqual(['Hard?', 'Pi?', 'Easy?'])
    expect(report.easiest.map((r) => r.text)).toEqual(['Easy?', 'Pi?', 'Hard?'])
  })
  it('ranks players the way the live leaderboard does, with their own numbers', () => {
    expect(report.players.map((p) => [p.rank, p.nickname])).toEqual([[1, 'Ada'], [2, 'Bayo'], [2, 'Chidi'], [4, 'Dara']])
    expect(report.players[0]).toMatchObject({ answered: 4, correct: 3, avgSeconds: 2.5 })
    expect(report.players[3]).toMatchObject({ answered: 0, correct: 0, avgSeconds: null })
  })
  it('copes with a game nobody played', () => {
    const empty = buildReport({ questions, players: [], questionStats: [], distribution: [], playerStats: [] })
    expect(empty.summary).toMatchObject({ players: 0, averageScore: 0, accuracy: null, averageSeconds: null, completion: null, questionsPlayed: 0 })
    expect(empty.hardest).toEqual([])
  })
})

describe('team results in a report', () => {
  it('ranks teams from the players and adds them to the CSV', () => {
    const teams = [{ id: 't1', name: 'Red', color: 'red', position: 0, avatar_id: 0 }, { id: 't2', name: 'Blue', color: 'blue', position: 1, avatar_id: 1 }]
    const withTeams = buildReport({
      questions,
      players: [{ ...players[0], team_id: 't1' }, { ...players[1], team_id: 't2' }, { ...players[2], team_id: 't2' }],
      questionStats,
      distribution,
      playerStats,
      teams,
    })
    expect(withTeams.teams.map((t) => [t.name, t.score, t.members])).toEqual([['Red', 3000, 1], ['Blue', 1000, 2]])
    expect(reportToCsv(withTeams)).toContain('Team rank,Team,Score,Players')
    expect(report.teams).toEqual([])
    expect(reportToCsv(report)).not.toContain('Team rank')
  })
})

describe('reportToCsv', () => {
  it('lists players then questions and protects formula-looking text', () => {
    const csv = reportToCsv(buildReport({ questions: [{ ...questions[0], text: '=HYPERLINK("x")' }], players: [{ id: 'p1', nickname: '+bad, name', total_score: 5, avatar_id: 0 }], questionStats: [], distribution: [], playerStats: [] }))
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('Rank,Nickname,Score,Answered,Correct,Average seconds')
    expect(lines[1]).toBe('1,"\'+bad, name",5,0,0,')
    expect(csv).toContain('"\'=HYPERLINK(""x"")"')
  })
})

describe('sortPlayers', () => {
  it('sorts by any column, keeping ties in rank order and blanks last', () => {
    expect(sortPlayers(report.players, 'nickname', 'asc').map((p) => p.nickname)).toEqual(['Ada', 'Bayo', 'Chidi', 'Dara'])
    expect(sortPlayers(report.players, 'avgSeconds', 'asc').map((p) => p.nickname)).toEqual(['Ada', 'Bayo', 'Chidi', 'Dara'])
    expect(sortPlayers(report.players, 'score', 'asc').map((p) => p.nickname)).toEqual(['Dara', 'Bayo', 'Chidi', 'Ada'])
  })
})
