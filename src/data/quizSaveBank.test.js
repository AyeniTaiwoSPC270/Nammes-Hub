import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveQuiz } from './quiz'
import { saveBankSettings } from '../components/admin/quizEditor/BankSettings'
import { blankQuestion } from './quizQuestions'

// The question bank settings have to survive the trip from the editor's form all the way into the quizzes row. That trip
// crosses two functions that name the same thing differently, and when they disagree nothing is written: saveQuiz quietly
// leaves the columns alone, the update succeeds, and the editor reports "Quiz saved". So this exercises the real saveQuiz
// with the real helper, because testing either one alone would pass while the pair stayed broken.

const QUIZ = '11111111-1111-4111-8111-111111111111'
const Q1 = '22222222-2222-4222-8222-222222222222'

const spy = vi.hoisted(() => ({ updates: [], questionRows: [] }))

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from(table) {
      let selecting = null
      const api = {
        select: (columns) => { selecting = columns; return api },
        eq: () => api,
        in: () => api,
        order: () => api,
        upsert: (rows) => { spy.questionRows = rows; return { error: null } },
        update: (values) => { spy.updates.push({ table, values }); return api },
        delete: () => api,
        single: async () => ({ data: selecting === 'id' ? { id: 'new' } : null, error: null }),
        then: (resolve) => {
          // The list of stored question rows, used to work out what the save deleted.
          resolve({ data: [{ id: Q1, image_path: null }], error: null })
        },
      }
      return api
    },
    storage: { from: () => ({ upload: async () => ({ error: null }), copy: async () => ({ error: null }), remove: async () => ({ error: null }) }) },
  },
}))

const questions = (n) => Array.from({ length: n }, (_, i) => ({
  ...blankQuestion('multiple'),
  id: `q${i}`,
  text: `Question ${i}?`,
  options: ['a', 'b'],
  correct_index: 0,
}))

const bank = (over = {}) => ({ drawCount: '', battleQuestionCount: '', shuffleQuestions: false, shuffleOptions: false, ...over })

// saveQuiz builds each quiz_questions row by naming its columns. A column that exists, is cleaned, is rendered in the
// editor and is graded on the reveal, but is missing from that list, is dropped by the upsert: the save reports success,
// the editor reloads an empty field, and nothing anywhere says why. This asserts the row carries every authored field,
// so the next column added to cleanQuestion cannot be left out of the write.
describe('the question rows saveQuiz writes', () => {
  it('carries the explanation an admin typed on the question', async () => {
    await saveQuiz({ id: QUIZ, title: 'Maths', maxPlayers: 40, questions: [{ ...blankQuestion('multiple'), id: 'q0', text: 'Why?', options: ['a', 'b'], correct_index: 0, explanation: 'Because it is.' }] })
    expect(spy.questionRows[0].explanation).toBe('Because it is.')
  })
  it('writes an emptied explanation as null rather than dropping the key', async () => {
    await saveQuiz({ id: QUIZ, title: 'Maths', maxPlayers: 40, questions: [{ ...blankQuestion('multiple'), id: 'q0', text: 'Why?', options: ['a', 'b'], correct_index: 0, explanation: '   ' }] })
    expect(spy.questionRows[0]).toHaveProperty('explanation', null)
  })
  it('carries the unit columns a numeric question needs to grade', async () => {
    await saveQuiz({ id: QUIZ, title: 'Maths', maxPlayers: 40, questions: [{ ...blankQuestion('numeric'), id: 'q0', text: 'How much force?', numeric_answer: 2500, numeric_unit: 'N', numeric_unit_aliases: ['newton', 'newtons'] }] })
    expect(spy.questionRows[0].numeric_unit).toBe('N')
    expect(spy.questionRows[0].numeric_unit_aliases).toEqual(['newton', 'newtons'])
  })
  it('carries a diagram question targets, or the marks are gone before grading', async () => {
    await saveQuiz({ id: QUIZ, title: 'Maths', maxPlayers: 40, questions: [{ ...blankQuestion('diagram'), id: 'q0', text: 'Tap the peak', diagram_targets: [{ x: 0.5, y: 0.25, r: 0.08, ar: 1.5 }] }] })
    expect(spy.questionRows[0].diagram_targets).toHaveLength(1)
  })
})

async function save(over, bankSettings = {}) {
  spy.updates = []
  await saveQuiz({
    id: QUIZ,
    title: 'Maths',
    questions: questions(12),
    maxPlayers: 40,
    ...saveBankSettings(bank(bankSettings), 12),
    ...over,
  })
  return spy.updates.find((u) => u.table === 'quizzes')?.values
}

beforeEach(() => { spy.updates = []; spy.questionRows = [] })

describe('saving a quiz writes the question bank settings', () => {
  it('writes the shuffles the admin ticked', async () => {
    const values = await save({}, { shuffleQuestions: true, shuffleOptions: true })
    expect(values.draw_settings).toEqual({ draw_count: null, shuffle_questions: true, shuffle_options: true })
  })

  it('writes the number of questions to ask', async () => {
    expect((await save({}, { drawCount: '5' })).draw_settings).toEqual({ draw_count: 5, shuffle_questions: false, shuffle_options: false })
  })

  it('writes a battle length that differs from the game', async () => {
    const values = await save({}, { drawCount: '10', battleQuestionCount: '8' })
    expect(values.battle_question_count).toBe(8)
    expect(values.draw_settings.draw_count).toBe(10)
  })

  it('clamps the count to the questions the quiz actually has', async () => {
    // Twelve questions in the bank, fifteen asked for: twelve is the honest answer.
    expect((await save({}, { drawCount: '15' })).draw_settings.draw_count).toBe(12)
  })

it('writes nulls for an untouched bank, so the quiz plays every question as typed', async () => {
    const values = await save({})
    expect(values.draw_settings).toEqual({ draw_count: null, shuffle_questions: false, shuffle_options: false })
    expect(values.battle_question_count).toBeNull()
  })

  it('still writes the other columns it always wrote', async () => {
    const values = await save({ practiceEnabled: true, battleEnabled: true }, { shuffleQuestions: true })
    expect(values).toMatchObject({ title: 'Maths', max_players: 40, practice_enabled: true, battle_enabled: true })
    expect(values.tags).toEqual([])
  })

  it('leaves the bank columns alone when a caller does not pass them', async () => {
    // Callers that save a quiz without touching these must not wipe an admin's settings.
    spy.updates = []
    await saveQuiz({ id: QUIZ, title: 'Maths', questions: questions(12), maxPlayers: 40 })
    const values = spy.updates.find((u) => u.table === 'quizzes')?.values
    expect(values).not.toHaveProperty('draw_settings')
    expect(values).not.toHaveProperty('battle_question_count')
  })
})

describe('the per-question answer order', () => {
  it('is saved when the admin asks for it', async () => {
    spy.questionRows = []
    const q = { ...blankQuestion('multiple'), id: Q1, text: 'Capital?', options: ['Lagos', 'Accra'], correct_index: 1, no_shuffle: true }
    await saveQuiz({ id: QUIZ, title: 'Maths', questions: [q], maxPlayers: 40 })
    expect(spy.questionRows[0]).toMatchObject({ id: Q1, no_shuffle: true })
  })

  it('is saved as false when it is not', async () => {
    spy.questionRows = []
    const q = { ...blankQuestion('multiple'), id: Q1, text: 'Capital?', options: ['Lagos', 'Accra'], correct_index: 1 }
    await saveQuiz({ id: QUIZ, title: 'Maths', questions: [q], maxPlayers: 40 })
    expect(spy.questionRows[0]).toMatchObject({ id: Q1, no_shuffle: false })
  })
})