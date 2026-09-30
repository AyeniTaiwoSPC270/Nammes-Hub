import { describe, it, expect } from 'vitest'
import {
  generateBattleCode, isBattleCode, pickBattleQuestions, battleQuestionPoints, decideWinner, speedOf, headToHead, duelNextStep,
  presence, DUEL_REVEAL_MS, DUEL_FORFEIT_MS, DUEL_AWAY_MS,
} from './quizBattle.js'

const START = Date.parse('2026-10-01T10:00:00.000Z')
const iso = (ms) => new Date(ms).toISOString()
const qs = Array.from({ length: 15 }, (_, i) => ({ id: `q${i}`, position: i, type: i === 3 ? 'poll' : 'multiple', points: 1000, time_limit_seconds: 20 }))

describe('battle codes', () => {
  it('are 6 readable characters', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateBattleCode()
      expect(code).toMatch(/^[A-Z2-9]{6}$/)
      expect(code).not.toMatch(/[O01I]/)
    }
    expect(isBattleCode('abc234')).toBe(true)
    expect(isBattleCode('abc')).toBe(false)
    expect(isBattleCode(undefined)).toBe(false)
  })
})

describe('pickBattleQuestions', () => {
  it('drops polls and keeps everything when the quiz is small', () => {
    const small = pickBattleQuestions(qs.slice(0, 5), 'x')
    expect(small.map((q) => q.id)).toEqual(['q0', 'q1', 'q2', 'q4'])
  })
  it('takes a repeatable random subset of at most 10, in quiz order', () => {
    const a = pickBattleQuestions(qs, 'seed-1')
    expect(a).toHaveLength(10)
    expect(a.every((q) => q.type !== 'poll')).toBe(true)
    expect(a.map((q) => q.position)).toEqual([...a.map((q) => q.position)].sort((x, y) => x - y))
    expect(pickBattleQuestions(qs, 'seed-1').map((q) => q.id)).toEqual(a.map((q) => q.id))
    expect(pickBattleQuestions(qs, 'seed-2').map((q) => q.id)).not.toEqual(a.map((q) => q.id))
  })
})

describe('scoring and winners', () => {
  it('doubles points on a double round', () => {
    const q = { points: 1000, time_limit_seconds: 20, points_multiplier: 2 }
    expect(battleQuestionPoints(q, 0)).toBe(2000)
    expect(battleQuestionPoints({ ...q, points_multiplier: 1 }, 0)).toBe(1000)
  })
  it('higher total wins, a tie goes to the faster side, else a draw', () => {
    expect(decideWinner({ total_score: 2000, speedMs: 9 }, { total_score: 1000, speedMs: 1 })).toBe('a')
    expect(decideWinner({ total_score: 1000, speedMs: 9 }, { total_score: 2000, speedMs: 1 })).toBe('b')
    expect(decideWinner({ total_score: 1000, speedMs: 5000 }, { total_score: 1000, speedMs: 7000 })).toBe('a')
    expect(decideWinner({ total_score: 1000, speedMs: 9000 }, { total_score: 1000, speedMs: 7000 })).toBe('b')
    expect(decideWinner({ total_score: 1000, speedMs: 5000 }, { total_score: 1000, speedMs: 5000 })).toBeNull()
  })
  it('measures speed on right answers only', () => {
    expect(speedOf([{ correct: true, elapsed_ms: 3000 }, { correct: false, elapsed_ms: 100 }, { correct: true, elapsed_ms: 2000 }])).toBe(5000)
  })
})

describe('headToHead', () => {
  it('says who won each question, including unanswered ones', () => {
    const questions = [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }]
    const a = [{ question_id: 'q1', correct: true, points_awarded: 900 }, { question_id: 'q2', correct: true, points_awarded: 500 }]
    const b = [{ question_id: 'q1', correct: true, points_awarded: 950 }, { question_id: 'q2', correct: true, points_awarded: 500 }]
    const out = headToHead(questions, a, b)
    expect(out.map((r) => r.winner)).toEqual(['b', null, null])
    expect(out[2].a.answered).toBe(false)
  })
})

describe('duelNextStep', () => {
  const question = { state: 'question', current_index: 0, question_started_at: iso(START) }
  const args = { limitMs: 20_000, questionCount: 3, bothAnswered: false }
  it('stays put before the start, while waiting, then reveals on time or when both have answered', () => {
    expect(duelNextStep({ ...args, battle: question, nowMs: START - 1000 })).toBeNull()
    expect(duelNextStep({ ...args, battle: question, nowMs: START + 5000 })).toBeNull()
    expect(duelNextStep({ ...args, battle: question, nowMs: START + 5000, bothAnswered: true })).toBe('reveal')
    expect(duelNextStep({ ...args, battle: question, nowMs: START + 25_000 })).toBe('reveal')
  })
  it('moves on after the reveal, and finishes after the last question', () => {
    const reveal = { state: 'reveal', current_index: 0, reveal_started_at: iso(START) }
    expect(duelNextStep({ ...args, battle: reveal, nowMs: START + DUEL_REVEAL_MS - 1 })).toBeNull()
    expect(duelNextStep({ ...args, battle: reveal, nowMs: START + DUEL_REVEAL_MS })).toBe('next')
    expect(duelNextStep({ ...args, battle: { ...reveal, current_index: 2 }, nowMs: START + DUEL_REVEAL_MS })).toBe('finish')
    expect(duelNextStep({ ...args, battle: { state: 'open' }, nowMs: START })).toBeNull()
  })
})

describe('presence', () => {
  it('goes here, away, gone', () => {
    expect(presence(iso(START), START + 5000)).toBe('here')
    expect(presence(iso(START), START + DUEL_AWAY_MS + 1)).toBe('away')
    expect(presence(iso(START), START + DUEL_FORFEIT_MS + 1)).toBe('gone')
  })
})

describe('eloUpdate', () => {
  it('moves both ratings by the same amount, more for an upset', async () => {
    const { eloUpdate } = await import('./quizBattle.js')
    const even = eloUpdate(1000, 1000, 'a')
    expect(even).toEqual({ a: 1016, b: 984, change: 16 })
    const upset = eloUpdate(800, 1200, 'a')
    expect(upset.change).toBeGreaterThan(16)
    expect(eloUpdate(1000, 1000, null).change).toBe(0)
    expect(eloUpdate(1200, 800, 'b').a).toBeLessThan(1200)
    const out = eloUpdate(1100, 1000, 'b')
    expect(out.a + out.b).toBe(2100)
  })
})
