import { describe, it, expect } from 'vitest'
import {
  cleanDrawSettings, buildQuestionSet, keepsOptionOrder, shuffled, clampInt,
  shownOptions, originalIndex, shownIndex, DRAW_MAX_QUESTIONS,
} from './quizDraw.js'

// A repeatable stand-in for Math.random, so a shuffle is the same shuffle twice.
const rng = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

const mc = (n, extra = {}) => ({
  id: `q${n}`, position: n, type: 'multiple', text: `Question ${n}?`,
  options: ['a', 'b', 'c', 'd'], correct_index: 2, ...extra,
})

const bank = Array.from({ length: 12 }, (_, i) => mc(i))

describe('keepsOptionOrder', () => {
  it('leaves alone anything whose answers only make sense in the order they were typed', () => {
    expect(keepsOptionOrder(mc(1, { options: ['x', 'y', 'All of the above', 'z'] }))).toBe(true)
    expect(keepsOptionOrder(mc(1, { options: ['x', 'None of the above', 'y'] }))).toBe(true)
    expect(keepsOptionOrder(mc(1, { no_shuffle: true }))).toBe(true)
    expect(keepsOptionOrder({ ...mc(1), type: 'truefalse', options: ['True', 'False'] })).toBe(true)
    expect(keepsOptionOrder(mc(1, { options: ['Lagos', 'Accra', 'Kumasi'] }))).toBe(false)
  })
})

describe('shuffled', () => {
  it('keeps every item and repeats exactly for the same random source', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8]
    const a = shuffled(input, rng(5))
    expect([...a].sort((x, y) => x - y)).toEqual(input)
    expect(a).toEqual(shuffled(input, rng(5)))
  })
})

describe('clampInt', () => {
  it('rounds, clamps and falls back on rubbish', () => {
    expect(clampInt(7.6, 1, 10, 0)).toBe(8)
    expect(clampInt(99, 1, 10, 0)).toBe(10)
    expect(clampInt(-3, 1, 10, 0)).toBe(1)
    expect(clampInt('abc', 1, 10, 4)).toBe(4)
  })
})

describe('cleanDrawSettings', () => {
  it('asks for the whole bank when the admin set nothing', () => {
    expect(cleanDrawSettings({}, 30)).toEqual({ drawCount: null, questionsPerGame: 30, shuffleQuestions: false, shuffleOptions: false })
    expect(cleanDrawSettings(null, 30).questionsPerGame).toBe(30)
  })

  it('keeps a quiz that predates question banks exactly as it played before', () => {
    // No settings at all must mean no shuffling, or every existing quiz would change overnight.
    const s = cleanDrawSettings(null, 12)
    expect(s.shuffleQuestions).toBe(false)
    expect(s.shuffleOptions).toBe(false)
  })

  it('clamps what an admin or a stranger sends', () => {
    expect(cleanDrawSettings({ draw_count: 999 }, 20)).toMatchObject({ drawCount: 20, questionsPerGame: 20 })
    expect(cleanDrawSettings({ draw_count: 10 }, 20)).toMatchObject({ drawCount: 10, questionsPerGame: 10 })
    expect(cleanDrawSettings({ draw_count: 'abc' }, 20)).toMatchObject({ drawCount: null, questionsPerGame: 20 })
    expect(cleanDrawSettings({ draw_count: 0 }, 20)).toMatchObject({ drawCount: 1 })
  })

  it('never asks for more questions than a quiz can hold', () => {
    expect(cleanDrawSettings({ draw_count: DRAW_MAX_QUESTIONS + 500 }, DRAW_MAX_QUESTIONS + 500).drawCount).toBe(DRAW_MAX_QUESTIONS)
  })

  it('only shuffles when explicitly told to', () => {
    expect(cleanDrawSettings({ shuffle_questions: true, shuffle_options: true }, 10)).toMatchObject({ shuffleQuestions: true, shuffleOptions: true })
    expect(cleanDrawSettings({ shuffle_questions: false }, 10)).toMatchObject({ shuffleQuestions: false, shuffleOptions: false })
    expect(cleanDrawSettings({ shuffle_questions: 'yes' }, 10).shuffleQuestions).toBe(false)
  })

  it('survives a bank it cannot count', () => {
    expect(cleanDrawSettings({}, 0)).toMatchObject({ questionsPerGame: 1 })
  })
})

describe('buildQuestionSet', () => {
  it('uses the whole bank, in quiz order, when nothing is asked to change', () => {
    const { questionIds, optionOrders } = buildQuestionSet(bank, cleanDrawSettings({}, 12), rng(3))
    expect(questionIds).toEqual(bank.map((q) => q.id))
    for (const id of questionIds) expect(optionOrders[id]).toEqual([0, 1, 2, 3])
  })

  it('draws the requested number of different questions', () => {
    const ids = buildQuestionSet(bank, cleanDrawSettings({ draw_count: 5 }, 12), rng(3)).questionIds
    expect(ids).toHaveLength(5)
    expect(new Set(ids).size).toBe(5)
    expect(ids.every((id) => bank.some((q) => q.id === id))).toBe(true)
  })

  it('is repeatable for one random source and different for another', () => {
    const s = cleanDrawSettings({ draw_count: 5 }, 12)
    const a = buildQuestionSet(bank, s, rng(7)).questionIds
    expect(a).toEqual(buildQuestionSet(bank, s, rng(7)).questionIds)
    expect(buildQuestionSet(bank, s, rng(99)).questionIds).not.toEqual(a)
  })

  it('never asks for more questions than the bank holds', () => {
    const ids = buildQuestionSet(bank, cleanDrawSettings({ draw_count: 500 }, 12), rng(1)).questionIds
    expect(ids).toHaveLength(12)
  })

  it('shuffles the questions only when told to', () => {
    const shuffledRun = buildQuestionSet(bank, cleanDrawSettings({ shuffle_questions: true }, 12), rng(11)).questionIds
    expect(shuffledRun).not.toEqual(bank.map((q) => q.id))
    expect([...shuffledRun].sort()).toEqual([...bank.map((q) => q.id)].sort())
  })

  it('shuffles the answers only when told to, and never for a typed question', () => {
    const typed = [{ id: 't', position: 0, type: 'text', text: 'Capital?', options: [], accepted_answers: ['Paris'] }]
    // Told to shuffle: a different order, but still every answer exactly once.
    const shuffledOrder = buildQuestionSet(bank, cleanDrawSettings({ shuffle_options: true }, 12), rng(4)).optionOrders.q0
    expect(shuffledOrder).not.toEqual([0, 1, 2, 3])
    expect([...shuffledOrder].sort((x, y) => x - y)).toEqual([0, 1, 2, 3])
    // Told not to: exactly as typed.
    expect(buildQuestionSet(bank, cleanDrawSettings({ shuffle_options: false }, 12), rng(4)).optionOrders.q0).toEqual([0, 1, 2, 3])
    // A typed question has no options to shuffle, so it gets no order at all.
    expect(buildQuestionSet(typed, cleanDrawSettings({ shuffle_options: true }, 1), rng(4)).optionOrders).toEqual({})
  })

  it('leaves an "all of the above" question in the order it was written', () => {
    const dependent = [mc(0, { options: ['x', 'y', 'All of the above', 'z'] })]
    const orders = buildQuestionSet(dependent, cleanDrawSettings({ shuffle_options: true }, 1), rng(6)).optionOrders
    expect(orders.q0).toEqual([0, 1, 2, 3])
  })

  it('says which answer is shown where, so the key can be mapped back', () => {
    const { questionIds, optionOrders } = buildQuestionSet(bank, cleanDrawSettings({ shuffle_options: true }, 12), rng(21))
    for (const id of questionIds) {
      expect([...optionOrders[id]].sort((x, y) => x - y)).toEqual([0, 1, 2, 3])
      expect(optionOrders[id]).toHaveLength(4)
    }
  })
})

describe('shownOptions and the index maps', () => {
  const q = mc(1, { options: ['Lagos', 'Accra', 'Kumasi', 'Ibadan'] })
  const order = [2, 0, 3, 1] // the answer shown first is Kumasi, originally index 2

  it('shows the options in the order it was given', () => {
    expect(shownOptions(q, order)).toEqual(['Kumasi', 'Lagos', 'Ibadan', 'Accra'])
  })

  it('shows the options as typed when there is no order', () => {
    expect(shownOptions(q, null)).toEqual(q.options)
  })

  it('has no options at all for a typed question', () => {
    expect(shownOptions({ type: 'text', options: [], text: 'x' }, [0, 1])).toEqual([])
  })

  it('turns what the player tapped back into what is stored', () => {
    expect(originalIndex(order, 0, 4)).toBe(2)
    expect(originalIndex(order, 3, 4)).toBe(1)
  })

  it('refuses a tap that is not one of the answers', () => {
    expect(originalIndex(order, 4, 4)).toBeNull()
    expect(originalIndex(order, -1, 4)).toBeNull()
    expect(originalIndex(order, 1.5, 4)).toBeNull()
    expect(originalIndex(order, '1', 4)).toBeNull()
  })

  it('turns a stored answer back into the position it was shown at', () => {
    expect(shownIndex(order, 2, 4)).toBe(0)
    expect(shownIndex(order, 1, 4)).toBe(3)
    expect(shownIndex(order, 9, 4)).toBeNull()
  })

  it('is the identity when the answers were never shuffled', () => {
    expect(originalIndex(null, 2, 4)).toBe(2)
    expect(shownIndex(null, 2, 4)).toBe(2)
    expect(shownOptions(q)).toEqual(q.options)
  })
})