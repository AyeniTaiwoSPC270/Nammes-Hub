import { describe, it, expect } from 'vitest'
import { blankQuestion, cleanQuestion, validateQuizDraft, secondsRemaining } from './quiz'

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
