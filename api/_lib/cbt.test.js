import { describe, it, expect } from 'vitest'
import {
  keepsOptionOrder, shuffled, cleanCbtSettings, sanitizePersonalSettings, buildAttempt, publicQuestion, readAnswer, readAnswers, markAnswer,
  gradeAttempt, reviewQuestion, percentOf, normaliseCourseCode,
} from './cbt.js'

// A repeatable "random" source.
const rng = (seed = 1) => () => {
  seed = (seed * 16807) % 2147483647
  return seed / 2147483647
}

const mc = (n, extra = {}) => ({ id: `q${n}`, position: n, type: 'multiple', text: `Question ${n}?`, options: ['a', 'b', 'c', 'd'], correct_index: 2, ...extra })
const bank = Array.from({ length: 10 }, (_, i) => mc(i))

describe('keepsOptionOrder', () => {
  it('keeps the order for order-dependent answers, true/false and flagged questions', () => {
    expect(keepsOptionOrder(mc(1, { options: ['x', 'y', 'All of the above', 'z'] }))).toBe(true)
    expect(keepsOptionOrder(mc(1, { options: ['x', 'None of the above', 'y'] }))).toBe(true)
    expect(keepsOptionOrder(mc(1, { options: ['A and B', 'B', 'C', 'D'] }))).toBe(true)
    expect(keepsOptionOrder(mc(1, { options: ['Both X and Y', 'X', 'Y'] }))).toBe(true)
    expect(keepsOptionOrder(mc(1, { no_shuffle: true }))).toBe(true)
    expect(keepsOptionOrder({ ...mc(1), type: 'truefalse', options: ['True', 'False'] })).toBe(true)
    expect(keepsOptionOrder(mc(1, { options: ['Lagos', 'Accra', 'Kumasi'] }))).toBe(false)
  })
})

describe('shuffled', () => {
  it('returns the same items in a repeatable different order and leaves the input alone', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8]
    const a = shuffled(input, rng(5))
    expect(a).toEqual(shuffled(input, rng(5)))
    expect([...a].sort()).toEqual(input)
    expect(a).not.toEqual(input)
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })
})

describe('cleanCbtSettings', () => {
  it('fills defaults from the bank size', () => {
    expect(cleanCbtSettings({}, 40)).toMatchObject({ mode: 'bank', drawCount: null, questionsPerAttempt: 40, durationMinutes: 40, passMarkPercent: 50, shuffleQuestions: true, shuffleOptions: true, showExplanations: true, allowStudyMode: true })
    expect(cleanCbtSettings(null, 3).durationMinutes).toBe(5) // never less than 5 minutes by default
  })
  it('clamps what an admin or a stranger sends', () => {
    const s = cleanCbtSettings({ draw_count: 999, duration_minutes: 9999, pass_mark_percent: 0, shuffle_questions: false }, 20)
    expect(s).toMatchObject({ drawCount: 20, questionsPerAttempt: 20, durationMinutes: 240, passMarkPercent: 1, shuffleQuestions: false })
    expect(cleanCbtSettings({ draw_count: 10 }, 20)).toMatchObject({ drawCount: 10, questionsPerAttempt: 10 })
    expect(cleanCbtSettings({ draw_count: 'abc', duration_minutes: 'x' }, 20)).toMatchObject({ drawCount: null, durationMinutes: 20 })
  })
  it('ignores the draw count for a fixed paper', () => {
    expect(cleanCbtSettings({ mode: 'fixed', draw_count: 5 }, 20)).toMatchObject({ mode: 'fixed', drawCount: null, questionsPerAttempt: 20 })
  })
  it('keeps only known fields for a personal exam', () => {
    expect(sanitizePersonalSettings({ evil: 1, duration_minutes: 30, pass_mark_percent: 70 }, 10)).toEqual({
      duration_minutes: 30, pass_mark_percent: 70, shuffle_questions: true, shuffle_options: true, draw_count: null,
    })
  })
})

describe('buildAttempt', () => {
  const settings = (over = {}) => cleanCbtSettings({ shuffle_questions: true, shuffle_options: true, ...over }, 10)

  it('draws the requested number of different questions', () => {
    const a = buildAttempt(bank, settings({ draw_count: 4 }), rng(3))
    expect(a.questionIds).toHaveLength(4)
    expect(new Set(a.questionIds).size).toBe(4)
    expect(a.questionIds.every((id) => bank.some((q) => q.id === id))).toBe(true)
  })

  it('gives a different draw on a retake', () => {
    const one = buildAttempt(bank, settings({ draw_count: 4 }), rng(3)).questionIds
    const two = buildAttempt(bank, settings({ draw_count: 4 }), rng(99)).questionIds
    expect(one).not.toEqual(two)
  })

  it('uses every question for a fixed paper, in order when not shuffled', () => {
    const a = buildAttempt([...bank].reverse(), settings({ mode: 'fixed', shuffle_questions: false, shuffle_options: false }), rng(1))
    expect(a.questionIds).toEqual(bank.map((q) => q.id))
    expect(a.optionOrders.q0).toEqual([0, 1, 2, 3])
  })

  it('never includes polls', () => {
    const withPoll = [...bank, { id: 'poll', position: 99, type: 'poll', text: 'Fav?', options: ['a', 'b'] }]
    expect(buildAttempt(withPoll, settings(), rng(2)).questionIds).not.toContain('poll')
  })

  it('shuffles answers as a permutation, except where the order matters', () => {
    const dependent = mc(50, { options: ['x', 'y', 'All of the above', 'z'] })
    const a = buildAttempt([...bank, dependent], settings({ mode: 'fixed' }), rng(7))
    for (const q of bank) expect([...a.optionOrders[q.id]].sort()).toEqual([0, 1, 2, 3])
    expect(a.optionOrders.q50).toEqual([0, 1, 2, 3])
    expect(bank.some((q) => a.optionOrders[q.id].join() !== '0,1,2,3')).toBe(true)
  })

  it('has no answer order for typed and number questions', () => {
    const typed = { id: 't', position: 0, type: 'text', text: 'Capital?', options: [], accepted_answers: ['Paris'] }
    expect(buildAttempt([typed], settings(), rng(1)).optionOrders).toEqual({})
  })
})

describe('what the browser gets', () => {
  it('has no answer key, only the shuffled options', () => {
    const q = mc(1, { explanation: 'because', accepted_answers: ['x'], numeric_answer: 5 })
    const shown = publicQuestion(q, [3, 2, 1, 0])
    expect(shown).toEqual({ id: 'q1', type: 'multiple', text: 'Question 1?', options: ['d', 'c', 'b', 'a'] })
  })
})

describe('answers', () => {
  const order = [3, 2, 1, 0]
  it('maps the position the student saw back to the stored position', () => {
    expect(readAnswer(mc(1), order, { choice: 0 })).toEqual({ chosen_index: 3 })
    expect(readAnswer(mc(1), order, { choice: 1 })).toEqual({ chosen_index: 2 })
  })
  it('refuses unusable answers', () => {
    expect(readAnswer(mc(1), order, { choice: 9 })).toBeNull()
    expect(readAnswer(mc(1), order, { choice: 'a' })).toBeNull()
    expect(readAnswer(mc(1), order, null)).toBeNull()
    expect(readAnswer({ id: 't', type: 'text', text: 'q', accepted_answers: ['x'] }, undefined, { text: '   ' })).toBeNull()
    expect(readAnswer({ id: 't', type: 'text', text: 'q', accepted_answers: ['x'] }, undefined, { text: 'x'.repeat(41) })).toBeNull()
  })
  it('keeps typed answers and drops control characters', () => {
    expect(readAnswer({ id: 't', type: 'text', text: 'q', accepted_answers: ['x'] }, undefined, { text: ' Pa\u0000ris ' })).toEqual({ answer_text: 'Paris' })
  })
  it('only keeps answers to questions in the attempt', () => {
    const out = readAnswers([mc(1)], { q1: order }, { q1: { choice: 0 }, other: { choice: 0 }, q2: 'x' })
    expect(out).toEqual({ q1: { chosen_index: 3 } })
    expect(readAnswers([mc(1)], {}, 'nope')).toEqual({})
    expect(readAnswers([mc(1)], {}, [1])).toEqual({})
  })
})

describe('grading', () => {
  const numeric = { id: 'n', position: 1, type: 'numeric', text: 'Days?', options: [], numeric_answer: 366, numeric_tolerance: 1 }
  const text = { id: 't', position: 2, type: 'text', text: 'Capital?', options: [], accepted_answers: ['Paris'] }
  const tf = { id: 'f', position: 3, type: 'truefalse', text: 'Sun is a star', options: ['True', 'False'], correct_index: 0 }

  it('marks each type and treats unanswered as wrong', () => {
    expect(markAnswer(mc(1), { chosen_index: 2 })).toBe(true)
    expect(markAnswer(mc(1), { chosen_index: 1 })).toBe(false)
    expect(markAnswer(mc(1), undefined)).toBeNull()
    expect(markAnswer(numeric, { answer_text: '365' })).toBe(true)
    expect(markAnswer(numeric, { answer_text: '300' })).toBe(false)
    expect(markAnswer(text, { answer_text: ' paris! ' })).toBe(true)
    expect(markAnswer(tf, { chosen_index: 1 })).toBe(false)
  })

  it('totals a paper', () => {
    const g = gradeAttempt([mc(1), numeric, text, tf], { q1: { chosen_index: 2 }, n: { answer_text: '366' }, t: { answer_text: 'Rome' } })
    expect(g.score).toBe(2)
    expect(g.total).toBe(4)
    expect(g.results).toEqual([{ id: 'q1', correct: true }, { id: 'n', correct: true }, { id: 't', correct: false }, { id: 'f', correct: false }])
  })

  it('reviews in the order the student saw, with the explanation when allowed', () => {
    const q = mc(1, { explanation: 'It is c.' })
    const r = reviewQuestion(q, [3, 2, 1, 0], { chosen_index: 3 }, { flagged: true })
    expect(r).toMatchObject({ answered: true, correct: false, flagged: true, chosen: 0, correctIndex: 1, options: ['d', 'c', 'b', 'a'], explanation: 'It is c.' })
    expect(reviewQuestion(q, [3, 2, 1, 0], undefined, { explanations: false })).toMatchObject({ answered: false, correct: false, chosen: null, explanation: null })
    expect(reviewQuestion(text, undefined, { answer_text: 'Rome' })).toMatchObject({ answerText: 'Rome', correctText: 'Paris', correct: false })
  })

  it('works out percentages and normalises course codes', () => {
    expect(percentOf(31, 40)).toBe(77.5)
    expect(percentOf(0, 0)).toBe(0)
    expect(normaliseCourseCode('  mth   101 ')).toBe('MTH 101')
  })
})
