import { describe, it, expect } from 'vitest'
import { fakeDb, QUIZ, SESSION } from './quizTestKit.js'
import { sessionQuestionIds, sessionQuestions, currentQuestion, optionOrderFor, hasFrozenQuestions } from './quizSessionQuestions.js'

const Q1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const Q2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const Q3 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

const row = (id, position) => ({ id, quiz_id: QUIZ, position, type: 'multiple', text: `Q${position}?`, options: ['a', 'b'], correct_index: 0, time_limit_seconds: 20, points: 1000 })

const db = () => fakeDb({ quiz_questions: [row(Q1, 0), row(Q2, 1), row(Q3, 2)] })

const frozen = (extra = {}) => ({
  id: SESSION, quiz_id: QUIZ, current_question_index: -1,
  question_ids: [Q3, Q1, Q2], option_orders: { [Q1]: [1, 0] }, ...extra,
})
const legacy = (extra = {}) => ({ id: SESSION, quiz_id: QUIZ, current_question_index: -1, ...extra })

describe('hasFrozenQuestions', () => {
  it('is true only once a game has its own list', () => {
    expect(hasFrozenQuestions(frozen())).toBe(true)
    expect(hasFrozenQuestions(legacy())).toBe(false)
    expect(hasFrozenQuestions({ question_ids: [] })).toBe(false)
    expect(hasFrozenQuestions(null)).toBe(false)
    expect(hasFrozenQuestions({})).toBe(false)
  })
})

describe('sessionQuestionIds', () => {
  it('plays a frozen game in exactly the order it drew', async () => {
    expect(await sessionQuestionIds(db(), frozen())).toEqual([Q3, Q1, Q2])
  })

  it('plays a game from before question banks in the quiz order', async () => {
    expect(await sessionQuestionIds(db(), legacy())).toEqual([Q1, Q2, Q3])
  })

  it('is empty for a quiz with no questions', async () => {
    const empty = fakeDb({ quiz_questions: [] })
    expect(await sessionQuestionIds(empty, legacy())).toEqual([])
    expect(await sessionQuestions(empty, legacy())).toEqual([])
  })
})

describe('sessionQuestions', () => {
  it('returns the rows in play order, not in database order', async () => {
    const questions = await sessionQuestions(db(), frozen())
    expect(questions.map((q) => q.id)).toEqual([Q3, Q1, Q2])
  })

  it('leaves out a question that was deleted after the draw', async () => {
    const missing = fakeDb({ quiz_questions: [row(Q1, 0)] })
    const ids = await sessionQuestions(missing, frozen())
    expect(ids.map((q) => q.id)).toEqual([Q1])
  })
})

describe('currentQuestion', () => {
  it('follows the drawn order, not the quiz order', async () => {
    const session = frozen({ current_question_index: 0 })
    expect((await currentQuestion(db(), session))?.id).toBe(Q3)
  })

  it('steps through the drawn order', async () => {
    for (const [index, id] of [[0, Q3], [1, Q1], [2, Q2]]) {
      expect((await currentQuestion(db(), frozen({ current_question_index: index })))?.id).toBe(id)
    }
  })

  it('finds the right question by position for an older game', async () => {
    expect((await currentQuestion(db(), legacy({ current_question_index: 1 })))?.id).toBe(Q2)
  })

  it('is null before the first question and past the last', async () => {
    expect(await currentQuestion(db(), frozen({ current_question_index: -1 }))).toBeNull()
    expect(await currentQuestion(db(), legacy({ current_question_index: -1 }))).toBeNull()
    expect(await currentQuestion(db(), frozen({ current_question_index: 99 }))).toBeNull()
    expect(await currentQuestion(db(), legacy({ current_question_index: 99 }))).toBeNull()
  })
})

describe('optionOrderFor', () => {
  it('gives the order that was frozen for that question', () => {
    expect(optionOrderFor(frozen(), Q1)).toEqual([1, 0])
  })

  it('means "as typed" when there is no order for it', () => {
    expect(optionOrderFor(frozen(), Q2)).toBeNull()
    expect(optionOrderFor(legacy(), Q1)).toBeNull()
    expect(optionOrderFor(null, Q1)).toBeNull()
  })
})