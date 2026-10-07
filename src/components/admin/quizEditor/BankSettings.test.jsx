import { describe, it, expect } from 'vitest'
import { saveBankSettings, describeBank, bankSettingsFromRow, NEW_BANK_SETTINGS, BATTLE_DRAW_MAX } from './BankSettings.jsx'
import { blankQuestion, questionFromRow, cleanQuestion } from '../../../data/quiz'

const settings = (over = {}) => ({ drawCount: '', battleQuestionCount: '', shuffleQuestions: true, shuffleOptions: true, ...over })

describe('a new quiz', () => {
  it('starts with both shuffles on and every question asked', () => {
    expect(NEW_BANK_SETTINGS).toEqual({ drawCount: '', shuffleQuestions: true, shuffleOptions: true })
    expect(saveBankSettings(NEW_BANK_SETTINGS, 12)).toEqual({
      draw_settings: { draw_count: null, shuffle_questions: true, shuffle_options: true },
      battle_question_count: null,
    })
  })
})

describe('an existing quiz', () => {
  it('keeps playing every question in order with the answers as written', () => {
    // A quiz saved before question banks has null settings. Loading and re-saving it must change nothing.
    const loaded = bankSettingsFromRow({ id: 'q1' })
    expect(loaded).toEqual({ drawCount: '', shuffleQuestions: false, shuffleOptions: false })
    expect(saveBankSettings({ ...loaded, battleQuestionCount: '' }, 20)).toEqual({
      draw_settings: { draw_count: null, shuffle_questions: false, shuffle_options: false },
      battle_question_count: null,
    })
  })

  it('reads back what it was saved with', () => {
    const row = { draw_settings: { draw_count: 8, shuffle_questions: true, shuffle_options: false } }
    expect(bankSettingsFromRow(row)).toEqual({ drawCount: '8', shuffleQuestions: true, shuffleOptions: false })
    expect(bankSettingsFromRow({ draw_settings: { draw_count: null } })).toEqual({ drawCount: '', shuffleQuestions: false, shuffleOptions: false })
    expect(bankSettingsFromRow({ draw_settings: null })).toEqual({ drawCount: '', shuffleQuestions: false, shuffleOptions: false })
  })
})

describe('saveBankSettings', () => {
  it('clamps the count to the questions the quiz actually has', () => {
    expect(saveBankSettings(settings({ drawCount: '999' }), 20).draw_settings.draw_count).toBe(20)
    expect(saveBankSettings(settings({ drawCount: '10' }), 20).draw_settings.draw_count).toBe(10)
  })

  it('treats a blank box as every question', () => {
    expect(saveBankSettings(settings({ drawCount: '' }), 20).draw_settings.draw_count).toBeNull()
  })

  it('does not lose a shuffle when the count is left blank', () => {
    expect(saveBankSettings(settings({ drawCount: '', shuffleOptions: true }), 20).draw_settings.shuffle_options).toBe(true)
  })

  it('lets a battle be a different length, and clamps it too', () => {
    expect(saveBankSettings(settings({ drawCount: '15', battleQuestionCount: '8' }), 30).battle_question_count).toBe(8)
    expect(saveBankSettings(settings({ drawCount: '15', battleQuestionCount: '999' }), 30).battle_question_count).toBe(BATTLE_DRAW_MAX)
    expect(saveBankSettings(settings({ drawCount: '15', battleQuestionCount: '0' }), 30).battle_question_count).toBe(1)
  })

  it('leaves the battle count null when the box is blank, so it follows the game', () => {
    expect(saveBankSettings(settings({ drawCount: '15', battleQuestionCount: '' }), 30).battle_question_count).toBeNull()
  })
})

describe('describeBank', () => {
  it('says what a game will ask', () => {
    expect(describeBank(settings({ drawCount: '' }), 30)).toBe('This game will ask all 30 questions.')
    expect(describeBank(settings({ drawCount: '' }), 1)).toBe('This game will ask all 1 question.')
    expect(describeBank(settings({ drawCount: '15' }), 30)).toBe('This game will ask 15 of 30 questions. A battle will ask 15.')
    expect(describeBank(settings({ drawCount: '15', battleQuestionCount: '8' }), 30)).toBe('This game will ask 15 of 30 questions. A battle will ask 8.')
  })

  it('asks for questions before saying anything', () => {
    expect(describeBank(settings(), 0)).toBe('Add some questions first, then choose how many to ask.')
  })
})

describe('the per-question answer order', () => {
  it('is off on a new question and carried over from the database', () => {
    expect(blankQuestion('multiple').no_shuffle).toBe(false)
    expect(questionFromRow({ id: 'q1', no_shuffle: true }).no_shuffle).toBe(true)
    expect(questionFromRow({ id: 'q1' }).no_shuffle).toBe(false)
  })

  it('survives cleaning on save', () => {
    const q = { ...blankQuestion('multiple'), text: 'Capital?', options: ['Lagos', 'Accra'], correct_index: 1, no_shuffle: true }
    expect(cleanQuestion(q).no_shuffle).toBe(true)
    expect(cleanQuestion({ ...q, no_shuffle: false }).no_shuffle).toBe(false)
  })

  it('is only kept for a multiple choice question, which is the only kind it means anything for', () => {
    const typed = { ...blankQuestion('text'), text: 'Capital?', accepted_text: 'Paris', no_shuffle: true }
    expect(cleanQuestion(typed).no_shuffle).toBe(false)
    const poll = { ...blankQuestion('poll'), text: 'Best club?', options: ['A', 'B'], correct_index: 0, no_shuffle: true }
    expect(cleanQuestion(poll).no_shuffle).toBe(false)
  })
})