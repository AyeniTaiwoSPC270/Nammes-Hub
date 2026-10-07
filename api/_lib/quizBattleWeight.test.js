import { describe, it, expect } from 'vitest'
import { battleWeight, pointsOnOffer, eloUpdate, RATING_K, RATING_REFERENCE_QUESTIONS, RATING_MIN_WEIGHT } from './quizBattle.js'
import { battleQuestionCount, BATTLE_MAX_QUESTIONS } from './quizBattle.js'

// One question worth 1000 at full speed.
const question = (points = 1000, seconds = 20, multiplier = 1) => ({ points, time_limit_seconds: seconds, points_multiplier: multiplier })

describe('battleQuestionCount', () => {
  it('uses the admin number when there is one', () => {
    expect(battleQuestionCount(8, 30)).toBe(8)
    expect(battleQuestionCount('8', 30)).toBe(8)
  })

  it('uses the whole bank when the admin asked for everything', () => {
    expect(battleQuestionCount(null, 30)).toBe(30)
    expect(battleQuestionCount('', 30)).toBe(30)
  })

  it('never asks for more than the bank holds, or more than a battle can be', () => {
    expect(battleQuestionCount(999, 14)).toBe(14)
    expect(battleQuestionCount(null, 200)).toBe(BATTLE_MAX_QUESTIONS)
  })

  it('is never zero, and survives rubbish', () => {
    expect(battleQuestionCount(0, 30)).toBe(1)
    expect(battleQuestionCount(-5, 30)).toBe(1)
    expect(battleQuestionCount('abc', 30)).toBe(30)
    expect(battleQuestionCount(null, 0)).toBe(1)
  })
})

describe('pointsOnOffer', () => {
  it('is the most each question could have awarded', () => {
    expect(pointsOnOffer([question(1000, 20, 1)])).toBe(1000)
    expect(pointsOnOffer([question(1000, 20, 2)])).toBe(2000)
    expect(pointsOnOffer([])).toBe(0)
    expect(pointsOnOffer(null)).toBe(0)
  })
})

describe('battleWeight', () => {
  // The spec's table, against an equal opponent (so a win is scoreA - expectedA = 0.5).
  const change = (w) => Math.round(RATING_K * w * 0.5)

  it('counts a ten-question battle for a full step', () => {
    expect(battleWeight({ questionCount: 10, winnerPoints: 3500, loserPoints: 0, pointsAvailable: 3500 })).toBe(1)
    expect(change(battleWeight({ questionCount: 10, winnerPoints: 3500, loserPoints: 0, pointsAvailable: 3500 }))).toBe(16)
  })

  it('counts a short battle for less, and a long one for more', () => {
    const short = battleWeight({ questionCount: 2, winnerPoints: 700, loserPoints: 0, pointsAvailable: 700 })
    const long = battleWeight({ questionCount: 50, winnerPoints: 17500, loserPoints: 0, pointsAvailable: 17500 })
    expect(short).toBeLessThan(1)
    expect(long).toBeGreaterThan(1)
    expect(change(short)).toBeLessThan(16)
    expect(change(long)).toBeGreaterThan(16)
  })

  it('counts a narrow result for less than a rout', () => {
    const narrow = battleWeight({ questionCount: 10, winnerPoints: 5500, loserPoints: 4500, pointsAvailable: 10000 })
    const rout = battleWeight({ questionCount: 10, winnerPoints: 10000, loserPoints: 0, pointsAvailable: 10000 })
    expect(narrow).toBeLessThan(rout)
    // A result that told you nothing still counts for something, not nothing.
    expect(narrow).toBeGreaterThan(RATING_MIN_WEIGHT)
  })

  it('never counts for more than about 2.24 of a step, whatever the margin', () => {
    // trust is sqrt(50/10); the margin term adds at most another 25%.
    const best = battleWeight({ questionCount: 50, winnerPoints: 50000, loserPoints: 0, pointsAvailable: 50000 })
    expect(best).toBeLessThanOrEqual(Math.sqrt(50 / RATING_REFERENCE_QUESTIONS))
    expect(change(best)).toBe(36)
  })

  it('grows with length, not with the raw score', () => {
    // Two battles where one has twice the points on offer must weigh the same: the margin is a share, not a total.
    const small = battleWeight({ questionCount: 4, winnerPoints: 3000, loserPoints: 1000, pointsAvailable: 4000 })
    const scaled = battleWeight({ questionCount: 4, winnerPoints: 300000, loserPoints: 100000, pointsAvailable: 400000 })
    expect(scaled).toBeCloseTo(small, 10)
  })

  it('survives a battle with nothing to measure against', () => {
    expect(battleWeight({ questionCount: 0 })).toBeGreaterThan(0)
    expect(Number.isFinite(battleWeight({ questionCount: 10, winnerPoints: 5, loserPoints: 4, pointsAvailable: 0 }))).toBe(true)
  })
})

describe('eloUpdate', () => {
  it('with no weight says exactly what it always said', () => {
    // The default is 1, so a caller with nothing to add about the battle gets today's numbers and every existing rating
    // stays valid.
    expect(eloUpdate(1000, 1000, 'a')).toEqual({ a: 1016, b: 984, change: 16 })
    expect(eloUpdate(1400, 1000, 'a')).toEqual(eloUpdate(1400, 1000, 'a', 1))
  })

  it('moves both by the same amount, in opposite directions', () => {
    const even = eloUpdate(1000, 1000, 'a')
    expect(even.a - 1000).toBe(1000 - even.b)
    // The winner goes up and the loser down, so the same duel from the other side moves the pair the other way.
    expect(eloUpdate(1000, 1000, 'b').change).toBe(-even.change)
  })

  it('an upset moves the ladder further than a win that was expected', () => {
    const expectedWin = eloUpdate(1400, 1000, 'a')
    const upset = eloUpdate(1400, 1000, 'b')
    expect(Math.abs(expectedWin.change)).toBeLessThan(Math.abs(upset.change))
  })

  it('a draw between equals is still no change at any weight', () => {
    // The weight only scales a difference that is already zero, so a draw cannot invent movement.
    expect(eloUpdate(1000, 1000, null).change).toBe(0)
    expect(eloUpdate(1000, 1000, null, 0.4).change).toBe(0)
    expect(eloUpdate(1000, 1000, null, 2).change).toBe(0)
  })

  it('scales the step by the weight, and nothing else', () => {
    expect(eloUpdate(1000, 1000, 'a', 0.5).change).toBe(8)
    expect(eloUpdate(1000, 1000, 'a', 2).change).toBe(32)
  })
})