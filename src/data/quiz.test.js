import { describe, it, expect } from 'vitest'
import { blankQuestion, cleanQuestion, validateQuizDraft, secondsRemaining, avatarStyle, initialOf, formatScore, rankPlayers, validateMaxPlayers, autoSecondsLeft, AUTO_ADVANCE_MS, OPTION_STYLES } from './quiz'

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
