import { afterEach, describe, it, expect, vi } from 'vitest'
import { blankQuestion, cleanQuestion, validateQuizDraft, secondsRemaining, battleClock, avatarStyle, initialOf, formatScore, rankPlayers, validateMaxPlayers, autoSecondsLeft, preserveSessionTheme, AUTO_ADVANCE_MS, OPTION_STYLES, castQueryKey, fetchCastRoster, castSavePayload } from './quiz'

afterEach(() => vi.unstubAllGlobals())

function question(over = {}) {
  return { ...blankQuestion(), text: 'Capital of Nigeria?', options: ['Lagos', 'Abuja', '', ''], correct_index: 1, ...over }
}

describe('cleanQuestion', () => {
  it('drops empty options and re-points the correct answer', () => {
    const q = cleanQuestion(question({ options: ['', 'Lagos', '', 'Abuja'], correct_index: 3 }))
    expect(q.options).toEqual(['Lagos', 'Abuja'])
    expect(q.correct_index).toBe(1)
  })
  it('marks the correct answer invalid when it points at an empty box', () => {
    expect(cleanQuestion(question({ options: ['A', 'B', '', ''], correct_index: 2 })).correct_index).toBe(-1)
  })
})

describe('validateQuizDraft', () => {
  it('accepts a normal quiz', () => {
    expect(validateQuizDraft({ title: 'Freshers quiz', questions: [question()] })).toBeNull()
  })
  it('needs a title and at least one question', () => {
    expect(validateQuizDraft({ title: ' ', questions: [question()] })).toMatch(/title/i)
    expect(validateQuizDraft({ title: 'x', questions: [] })).toMatch(/at least one question/i)
  })
  it('names the question that is wrong', () => {
    expect(validateQuizDraft({ title: 'x', questions: [question(), question({ text: '' })] })).toMatch(/Question 2/)
    expect(validateQuizDraft({ title: 'x', questions: [question({ options: ['only', '', '', ''], correct_index: 0 })] })).toMatch(/two answers/)
    expect(validateQuizDraft({ title: 'x', questions: [question({ options: ['A', 'B', '', ''], correct_index: 3 })] })).toMatch(/correct answer/)
  })
})

describe('secondsRemaining', () => {
  it('counts down, rounds up, and stops at zero', () => {
    expect(secondsRemaining({ startedAtMs: 0, timeLimitSeconds: 20, nowMs: 0 })).toBe(20)
    expect(secondsRemaining({ startedAtMs: 0, timeLimitSeconds: 20, nowMs: 4500 })).toBe(16)
    expect(secondsRemaining({ startedAtMs: 0, timeLimitSeconds: 20, nowMs: 25000 })).toBe(0)
  })
})

describe('battleClock', () => {
  const duel = { state: 'question', isDuel: true, startedAtMs: 0, timeLimitSeconds: 20 }

  it('counts down while you are still choosing', () => {
    expect(battleClock({ ...duel, nowMs: 0 })).toEqual({ remaining: 20, canAnswer: true })
    expect(battleClock({ ...duel, nowMs: 4500 })).toEqual({ remaining: 16, canAnswer: true })
  })

  // The bug this exists for: locking in set the clock to "no clock", and the ring then fell back to the full limit, so
  // a player sitting on the waiting screen watched the timer spring from 3 back to 30 and stop.
  it('keeps counting down after you lock in, because the question is still live', () => {
    expect(battleClock({ ...duel, myAnswered: true, nowMs: 4500 })).toEqual({ remaining: 16, canAnswer: false })
    expect(battleClock({ ...duel, myAnswered: true, nowMs: 19500 })).toEqual({ remaining: 1, canAnswer: false })
    expect(battleClock({ ...duel, myAnswered: true, nowMs: 20000 })).toEqual({ remaining: 0, canAnswer: false })
    expect(battleClock({ ...duel, myAnswered: true, nowMs: 40000 })).toEqual({ remaining: 0, canAnswer: false })
  })

  it('stops you answering once the limit is gone', () => {
    expect(battleClock({ ...duel, nowMs: 20000 })).toEqual({ remaining: 0, canAnswer: false })
  })

  it('leaves the two kinds of battle to their own flag: a duel answers with myAnswered, a challenge with its result', () => {
    const challenge = { state: 'question', isDuel: false, startedAtMs: 0, timeLimitSeconds: 20, nowMs: 1000 }
    // A challenge has no myAnswered at all, and a duel has no result, so each must ignore the other's flag.
    expect(battleClock({ ...challenge, myAnswered: true })).toEqual({ remaining: 19, canAnswer: true })
    expect(battleClock({ ...duel, nowMs: 1000, result: { correct: true } }).canAnswer).toBe(true)
    expect(battleClock({ ...challenge, result: { correct: true } }).canAnswer).toBe(false)
  })

  it('has no clock before the question starts, or off the question', () => {
    // A duel opens 4 seconds in the future, and that gap has its own 3-2-1 screen.
    expect(battleClock({ ...duel, nowMs: -3000 })).toEqual({ remaining: null, canAnswer: false })
    for (const state of ['open', 'reveal', 'finished', 'cancelled', undefined]) {
      expect(battleClock({ ...duel, state, nowMs: 1000 }), state).toEqual({ remaining: null, canAnswer: false })
    }
  })

  it('has no clock rather than a wrong one when the start timestamp is missing', () => {
    expect(battleClock({ ...duel, startedAtMs: NaN, nowMs: 1000 })).toEqual({ remaining: null, canAnswer: false })
  })
})

describe('player avatars', () => {
  it('gives the same colour to the same nickname every time', () => {
    expect(avatarStyle('Tobi_Matrix')).toBe(avatarStyle('Tobi_Matrix'))
    expect(OPTION_STYLES).toContain(avatarStyle('Amina'))
  })
  it('uses the first character as the initial, including symbols and emoji', () => {
    expect(initialOf('  kelechi_π')).toBe('K')
    expect(initialOf('πe')).toBe('Π')
    expect(initialOf('   ')).toBe('?')
    expect(initialOf('😀 fun')).toBe('😀')
  })
  it('formats scores with thousands separators', () => {
    expect(formatScore(2935)).toBe('2,935')
  })
})

describe('rankPlayers', () => {
  it('orders by score and lets ties share a rank', () => {
    const ranked = rankPlayers([
      { id: 'a', nickname: 'A', total_score: 500 },
      { id: 'b', nickname: 'B', total_score: 900 },
      { id: 'c', nickname: 'C', total_score: 500 },
      { id: 'd', nickname: 'D', total_score: 100 },
    ])
    expect(ranked.map((p) => [p.id, p.rank])).toEqual([['b', 1], ['a', 2], ['c', 2], ['d', 4]])
  })
})

describe('preserveSessionTheme', () => {
  it('keeps the initial theme snapshot when later session updates disagree', () => {
    const snapshot = { look: 'royal', pattern: 'rings' }
    const previous = { id: 'session-1', state: 'question', theme: snapshot }
    const update = { id: 'session-1', state: 'reveal', theme: { look: 'classic', pattern: 'math' } }

    expect(preserveSessionTheme(previous, update)).toEqual({ ...update, theme: snapshot })
  })

  it('accepts the theme from the first session row', () => {
    const initial = { id: 'session-1', state: 'question', theme: { look: 'royal' } }

    expect(preserveSessionTheme(null, initial)).toBe(initial)
  })

  it('uses a new theme when the host switches to a different session', () => {
    const previous = { id: 'session-1', theme: { look: 'royal' } }
    const next = { id: 'session-2', theme: { look: 'ocean' } }

    expect(preserveSessionTheme(previous, next)).toBe(next)
  })
})

describe('autoSecondsLeft', () => {
  it('counts down from five seconds, rounding up, and never goes negative', () => {
    expect(AUTO_ADVANCE_MS).toBe(5000)
    expect(autoSecondsLeft({ enteredMs: 0, nowMs: 0 })).toBe(5)
    expect(autoSecondsLeft({ enteredMs: 0, nowMs: 1200 })).toBe(4)
    expect(autoSecondsLeft({ enteredMs: 0, nowMs: 4999 })).toBe(1)
    expect(autoSecondsLeft({ enteredMs: 0, nowMs: 9000 })).toBe(0)
    expect(autoSecondsLeft({ enteredMs: 1000, nowMs: 0 })).toBe(5) // a clock reading slightly behind the start
  })
})

describe('validateMaxPlayers', () => {
  it('accepts whole numbers from 2 to 150, typed or as numbers', () => {
    for (const ok of [2, 50, 150, '2', ' 75 ']) expect(validateMaxPlayers(ok)).toBeNull()
  })
  it('explains what is wrong otherwise', () => {
    for (const bad of ['', '  ', 'abc', 12.5, '7.5']) expect(validateMaxPlayers(bad)).toMatch(/whole number/)
    for (const bad of [1, 0, 151, '999', -4]) expect(validateMaxPlayers(bad)).toMatch(/between 2 and 150/)
  })
  it('is checked as part of saving a quiz', () => {
    const q = { ...blankQuestion(), text: 'Q?', options: ['a', 'b', '', ''], correct_index: 0 }
    expect(validateQuizDraft({ title: 'x', questions: [q], maxPlayers: '500' })).toMatch(/between 2 and 150/)
    expect(validateQuizDraft({ title: 'x', questions: [q], maxPlayers: '40' })).toBeNull()
  })
})

describe('castQueryKey', () => {
  it('keys by the join code or quiz id', () => {
    expect(castQueryKey({ code: '123456' })).toEqual(['cast', 'code', '123456'])
    expect(castQueryKey({ quizId: 'q1' })).toEqual(['cast', 'quiz', 'q1'])
  })
  it('returns null when there is no target, rather than using one shared cache key', () => {
    expect(castQueryKey({})).toBeNull()
    expect(castQueryKey(null)).toBeNull()
  })
})

describe('fetchCastRoster', () => {
  it('sends roster reads through the registered cast action', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ mode: 'builtins', characters: [] }) })
    vi.stubGlobal('fetch', fetch)

    await fetchCastRoster({ code: '123456' })

    expect(fetch).toHaveBeenCalledWith('/api/quiz?action=cast', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ op: 'roster', code: '123456' }),
    }))
  })
})

describe('castSavePayload', () => {
  it('sends the cast op and its quiz id with the saved cast', () => {
    expect(castSavePayload('quiz-1', { mode: 'all', characters: [] })).toEqual({
      op: 'cast',
      quizId: 'quiz-1',
      mode: 'all',
      characters: [],
    })
  })
})
