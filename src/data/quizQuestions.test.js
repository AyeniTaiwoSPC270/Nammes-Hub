import { describe, it, expect } from 'vitest'
import { blankQuestion, questionFromRow, cleanQuestion, validateQuestion, validateQuizDraft, secondsRemaining, elapsedAtPauseMs, MAX_QUESTIONS } from './quiz'

const q = (over = {}) => ({ ...blankQuestion(), text: 'What is pi?', ...over })

describe('question types in the editor', () => {
  it('true/false always has True and False and a valid correct answer', () => {
    const c = cleanQuestion(q({ type: 'truefalse', options: ['x', 'y', 'z', ''], correct_index: 1 }))
    expect(c.options).toEqual(['True', 'False'])
    expect(c.correct_index).toBe(1)
    expect(cleanQuestion(q({ type: 'truefalse', correct_index: 3 })).correct_index).toBe(0)
  })
  it('a numeric question needs a number and an allowed margin that is a number', () => {
    expect(validateQuestion(q({ type: 'numeric', numeric_answer: '3.14' }))).toBeNull()
    expect(validateQuestion(q({ type: 'numeric', numeric_answer: '1/2', numeric_tolerance: '0.01' }))).toBeNull()
    expect(validateQuestion(q({ type: 'numeric', numeric_answer: 'three' }))).toMatch(/number/)
    expect(validateQuestion(q({ type: 'numeric', numeric_answer: '' }))).toMatch(/number/)
    expect(validateQuestion(q({ type: 'numeric', numeric_answer: '1', numeric_tolerance: 'lots' }))).toMatch(/margin/)
    expect(validateQuestion(q({ type: 'numeric', numeric_answer: '1', numeric_tolerance: '-1' }))).toMatch(/margin/)
    const c = cleanQuestion(q({ type: 'numeric', numeric_answer: '2.5', numeric_tolerance: '' }))
    expect(c).toMatchObject({ numeric_answer: 2.5, numeric_tolerance: 0, options: [], correct_index: null })
  })
  it('a typed question needs accepted answers, trimmed and without repeats', () => {
    expect(validateQuestion(q({ type: 'text', accepted_text: '  \n ' }))).toMatch(/accepted answer/)
    const c = cleanQuestion(q({ type: 'text', accepted_text: 'Ada\n ada \n\nLovelace' }))
    expect(c.accepted_answers).toEqual(['Ada', 'Lovelace'])
    expect(validateQuestion(q({ type: 'text', accepted_text: Array.from({ length: 9 }, (_, i) => `a${i}`).join('\n') }))).toMatch(/at most 8/)
    expect(validateQuestion(q({ type: 'text', accepted_text: 'x'.repeat(41) }))).toMatch(/40 characters/)
  })
  it('a poll needs two answers but no correct one', () => {
    const poll = q({ type: 'poll', options: ['Yes', 'No', '', ''] })
    expect(validateQuestion(poll)).toBeNull()
    expect(cleanQuestion(poll).correct_index).toBeNull()
    expect(validateQuestion(q({ type: 'poll', options: ['Only', '', '', ''] }))).toMatch(/two answers/)
  })
  it('a picture needs alt text', () => {
    expect(validateQuestion(q({ options: ['a', 'b', '', ''], image_path: 'a/b.webp', image_alt: '' }))).toMatch(/describe the picture/i)
    expect(validateQuestion(q({ options: ['a', 'b', '', ''], imageBlob: new Blob(['x']), image_alt: '  ' }))).toMatch(/describe the picture/i)
    expect(validateQuestion(q({ options: ['a', 'b', '', ''], image_path: 'a/b.webp', image_alt: 'A parabola opening upwards' }), 1)).toBeNull()
    expect(validateQuestion(q({ options: ['a', 'b', '', ''], image_path: 'a/b.webp', image_alt: 'x'.repeat(201) }))).toMatch(/too long/)
  })
  it('round-trips a saved row back into the editor', () => {
    const row = { id: 'x', type: 'text', text: 'Who?', options: [], correct_index: null, accepted_answers: ['Ada', 'Bo'], time_limit_seconds: 30, points: 500, points_multiplier: 2, numeric_answer: null, numeric_tolerance: 0, image_path: null, image_alt: null }
    const form = questionFromRow(row)
    expect(form).toMatchObject({ type: 'text', accepted_text: 'Ada\nBo', points_multiplier: 2, options: ['', '', '', ''] })
    expect(cleanQuestion(form).accepted_answers).toEqual(['Ada', 'Bo'])
    expect(questionFromRow({ ...row, type: undefined, options: ['a', 'b'], correct_index: 1 }).type).toBe('multiple')
  })
  it('limits the size of a quiz', () => {
    const many = Array.from({ length: MAX_QUESTIONS + 1 }, () => q({ options: ['a', 'b', '', ''] }))
    expect(validateQuizDraft({ title: 'x', questions: many })).toMatch(/at most/)
  })
})

describe('secondsRemaining with pause and extra time', () => {
  it('adds host time and ignores paused time', () => {
    expect(secondsRemaining({ startedAtMs: 0, timeLimitSeconds: 20, nowMs: 25000, bonusMs: 10_000 })).toBe(5)
    expect(secondsRemaining({ startedAtMs: 0, timeLimitSeconds: 20, nowMs: 25000, pausedMs: 10_000 })).toBe(5)
  })
  it('stands still while paused', () => {
    expect(secondsRemaining({ startedAtMs: 0, timeLimitSeconds: 20, nowMs: 999_999, frozenElapsedMs: 8000 })).toBe(12)
  })
  it('works out how far a paused question had got from the server times', () => {
    const session = { question_started_at: '2026-10-01T10:00:00.000Z', paused_at: '2026-10-01T10:00:07.000Z', paused_total_ms: 2000 }
    expect(elapsedAtPauseMs(session)).toBe(5000)
    expect(elapsedAtPauseMs({ ...session, paused_at: null })).toBeNull()
  })
})
