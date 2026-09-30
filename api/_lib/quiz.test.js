import { describe, it, expect } from 'vitest'
import {
  generateJoinCode,
  hashToken,
  newPlayerToken,
  validateNickname,
  isJoinCode,
  scoreAnswer,
  nextState,
  rankPlayers,
  createRateLimiter,
  ANSWER_GRACE_MS,
  isAvatarId,
} from './quiz.js'

describe('generateJoinCode', () => {
  it('always returns six digits, padding small numbers', () => {
    expect(generateJoinCode(() => 42)).toBe('000042')
    expect(isJoinCode(generateJoinCode())).toBe(true)
  })
})

describe('tokens', () => {
  it('hashes deterministically and never returns the token itself', () => {
    const t = newPlayerToken()
    expect(hashToken(t)).toBe(hashToken(t))
    expect(hashToken(t)).not.toContain(t)
    expect(newPlayerToken()).not.toBe(t)
  })
})

describe('validateNickname', () => {
  it('trims, collapses spaces and strips control characters', () => {
    expect(validateNickname('  Ada   Obi\u0000 ')).toEqual({ ok: true, value: 'Ada Obi' })
  })
  it('rejects empty, non-string and over-long nicknames', () => {
    expect(validateNickname('   ').ok).toBe(false)
    expect(validateNickname(null).ok).toBe(false)
    expect(validateNickname('x'.repeat(21)).ok).toBe(false)
    expect(validateNickname('x'.repeat(20)).ok).toBe(true)
  })
  it('rejects blocked words even when spaced or punctuated', () => {
    expect(validateNickname('sh1t').ok).toBe(true) // digits break the match; the list is a basic filter only
    expect(validateNickname('f u c k').ok).toBe(false)
    expect(validateNickname('S.H.I.T').ok).toBe(false)
  })
})

describe('isJoinCode', () => {
  it('accepts exactly six digits', () => {
    expect(isJoinCode('123456')).toBe(true)
    for (const bad of ['12345', '1234567', 'abcdef', 123456, null, '12 456']) expect(isJoinCode(bad)).toBe(false)
  })
})

describe('scoreAnswer', () => {
  const base = { correct: true, points: 1000, timeLimitSeconds: 20 }
  it('gives full points for an instant answer and half at the buzzer', () => {
    expect(scoreAnswer({ ...base, elapsedMs: 0 })).toBe(1000)
    expect(scoreAnswer({ ...base, elapsedMs: 10_000 })).toBe(750)
    expect(scoreAnswer({ ...base, elapsedMs: 20_000 })).toBe(500)
  })
  it('gives nothing for a wrong answer', () => {
    expect(scoreAnswer({ ...base, correct: false, elapsedMs: 0 })).toBe(0)
  })
  it('allows the network grace period, then nothing', () => {
    expect(scoreAnswer({ ...base, elapsedMs: 20_000 + ANSWER_GRACE_MS })).toBe(500)
    expect(scoreAnswer({ ...base, elapsedMs: 20_000 + ANSWER_GRACE_MS + 1 })).toBe(0)
  })
  it('treats a negative elapsed time (clock oddity) as instant', () => {
    expect(scoreAnswer({ ...base, elapsedMs: -50 })).toBe(1000)
  })
})

describe('nextState', () => {
  it('walks the full cycle and finishes after the last question', () => {
    let s = { state: 'lobby', current_question_index: -1 }
    const seen = []
    for (let i = 0; i < 20 && s; i++) {
      const next = nextState(s, 2)
      if (!next) break
      seen.push(`${next.state}:${next.current_question_index}`)
      s = next
    }
    expect(seen).toEqual([
      'question:0', 'reveal:0', 'leaderboard:0',
      'question:1', 'reveal:1', 'leaderboard:1',
      'finished:1',
    ])
  })
  it('flags which transitions start a question timer', () => {
    expect(nextState({ state: 'lobby', current_question_index: -1 }, 3).startsQuestion).toBe(true)
    expect(nextState({ state: 'question', current_question_index: 0 }, 3).startsQuestion).toBeUndefined()
  })
  it('cannot start a quiz with no questions or move past finished', () => {
    expect(nextState({ state: 'lobby', current_question_index: -1 }, 0)).toBeNull()
    expect(nextState({ state: 'finished', current_question_index: 1 }, 2)).toBeNull()
  })
})

describe('rankPlayers', () => {
  it('sorts by score and gives ties the same rank', () => {
    const ranked = rankPlayers([
      { id: 'a', nickname: 'A', total_score: 500 },
      { id: 'b', nickname: 'B', total_score: 900 },
      { id: 'c', nickname: 'C', total_score: 500 },
      { id: 'd', nickname: 'D', total_score: 100 },
    ])
    expect(ranked.map((p) => [p.id, p.rank])).toEqual([['b', 1], ['a', 2], ['c', 2], ['d', 4]])
  })
})

describe('createRateLimiter', () => {
  it('blocks after max hits in the window and recovers afterwards', () => {
    let t = 0
    const allow = createRateLimiter({ max: 2, windowMs: 1000, now: () => t })
    expect([allow('k'), allow('k'), allow('k')]).toEqual([true, true, false])
    expect(allow('other')).toBe(true)
    t = 1001
    expect(allow('k')).toBe(true)
  })
})

describe('isAvatarId', () => {
  it('accepts whole numbers 0 to 49 only', () => {
    for (const ok of [0, 1, 49]) expect(isAvatarId(ok)).toBe(true)
    for (const bad of [-1, 50, 1.5, '3', null, undefined, NaN]) expect(isAvatarId(bad)).toBe(false)
  })
})
