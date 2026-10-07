import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import BankSettings, { saveBankSettings, describeBank, bankSettingsFromRow, NEW_BANK_SETTINGS, BATTLE_DRAW_MAX } from './BankSettings.jsx'

// Rendering the component, not just its helpers. The helpers were all individually correct and all tested while the
// component still crashed the editor: it read the settings object by the column names it used to return, so asking for a
// number to ask threw on render and took the whole page down with it. A test that only calls the exported functions
// cannot see that, so every state the admin can put the form in gets rendered here.

const render = (settings, questionCount = 12) =>
  renderToStaticMarkup(<BankSettings settings={{ battleQuestionCount: '', ...settings }} onChange={() => {}} questionCount={questionCount} />)

const at = (html, text) => html.includes(text)

describe('the question bank panel', () => {
  it('renders with a count left blank', () => {
    const html = render({ drawCount: '', shuffleQuestions: false, shuffleOptions: false })
    expect(at(html, 'Question bank')).toBe(true)
    expect(at(html, 'All 12')).toBe(true)
    expect(at(html, 'This game will ask all 12 questions.')).toBe(true)
  })

  it('renders once a count is set, which is the state that used to crash', () => {
    // The battle box only appears with a count set, and it was reading a key the helper no longer returned.
    const html = render({ drawCount: '8', shuffleQuestions: true, shuffleOptions: true })
    expect(at(html, 'Questions per battle')).toBe(true)
    expect(at(html, 'This game will ask 8 of 12 questions. A battle will ask 8.')).toBe(true)
  })

  it('offers the game count as the battle box placeholder', () => {
    expect(at(render({ drawCount: '8' }), 'placeholder="8"')).toBe(true)
    // With no count at all there is no number to suggest, so it says what leaving it alone means.
    expect(at(render({ drawCount: '8' }), 'placeholder="8"')).toBe(true)
    // The battle box only exists once a count is set, so there is no placeholder to check without one.
    expect(at(render({ drawCount: '' }), 'Questions per battle')).toBe(false)
  })

  it('renders with a separate battle count set', () => {
    const html = render({ drawCount: '15', battleQuestionCount: '8' }, 30)
    expect(at(html, 'This game will ask 15 of 30 questions. A battle will ask 8.')).toBe(true)
  })

  it('renders both shuffles ticked and both clear', () => {
    const checked = (html) => html.match(/<input type="checkbox"[^>]*checked=""/g) ?? []
    expect(checked(render({ drawCount: '', shuffleQuestions: true, shuffleOptions: true }))).toHaveLength(2)
    expect(checked(render({ drawCount: '', shuffleQuestions: false, shuffleOptions: false }))).toHaveLength(0)
    expect(checked(render({ drawCount: '', shuffleQuestions: true, shuffleOptions: false }))).toHaveLength(1)
  })

  it('renders every state a saved quiz can come back in', () => {
    // Whatever the database held, the form has to be able to draw it. Each of these is a real row shape.
    const rows = [
      undefined,
      {},
      { draw_settings: null },
      { draw_settings: {} },
      { draw_settings: { draw_count: null, shuffle_questions: false, shuffle_options: false } },
      { draw_settings: { draw_count: 8, shuffle_questions: true, shuffle_options: true } },
      { draw_settings: { draw_count: 200, shuffle_questions: true, shuffle_options: false }, battle_question_count: 50 },
    ]
    for (const row of rows) {
      const loaded = { ...bankSettingsFromRow(row), battleQuestionCount: row?.battle_question_count == null ? '' : String(row.battle_question_count) }
      expect(() => render(loaded, 200), JSON.stringify(row)).not.toThrow()
    }
  })

  it('renders an empty quiz without lying about the count', () => {
    expect(at(render({ drawCount: '' }, 0), 'Add some questions first')).toBe(true)
  })
})

describe('what the panel hands back', () => {
  it('a new quiz starts with both shuffles on and no count', () => {
    expect(NEW_BANK_SETTINGS).toEqual({ drawCount: '', shuffleQuestions: true, shuffleOptions: true })
    expect(saveBankSettings(NEW_BANK_SETTINGS, 12)).toEqual({
      drawSettings: { draw_count: null, shuffle_questions: true, shuffle_options: true },
      battleQuestionCount: null,
    })
  })

  it('an existing quiz round trips unchanged', () => {
    const loaded = { ...bankSettingsFromRow({ id: 'q1' }), battleQuestionCount: '' }
    expect(loaded).toEqual({ drawCount: '', shuffleQuestions: false, shuffleOptions: false, battleQuestionCount: '' })
    expect(saveBankSettings(loaded, 20)).toEqual({
      drawSettings: { draw_count: null, shuffle_questions: false, shuffle_options: false },
      battleQuestionCount: null,
    })
  })

  it('reads back only the database column names', () => {
    // The row is snake_case; the form is camelCase. If these ever stop matching, a saved quiz looks unsaved.
    expect(bankSettingsFromRow({ draw_settings: { draw_count: 8, shuffle_questions: true, shuffle_options: false } }))
      .toEqual({ drawCount: '8', shuffleQuestions: true, shuffleOptions: false })
    for (const input of [
      { drawCount: '', shuffleQuestions: true, shuffleOptions: true },
      { drawCount: '8', shuffleQuestions: false, shuffleOptions: true },
      { drawCount: '15', shuffleQuestions: true, shuffleOptions: false },
    ]) {
      expect(bankSettingsFromRow({ draw_settings: saveBankSettings(input, 30).drawSettings })).toEqual(input)
    }
  })

  it('clamps the count to the questions the quiz has, and the battle count to its ceiling', () => {
    expect(saveBankSettings({ drawCount: '999', battleQuestionCount: '' }, 20).drawSettings.draw_count).toBe(20)
    expect(saveBankSettings({ drawCount: '15', battleQuestionCount: '999' }, 30).battleQuestionCount).toBe(BATTLE_DRAW_MAX)
    expect(saveBankSettings({ drawCount: '15', battleQuestionCount: '' }, 30).battleQuestionCount).toBeNull()
  })

  it('describes what will happen', () => {
    expect(describeBank({ drawCount: '', battleQuestionCount: '' }, 1)).toBe('This game will ask all 1 question.')
    expect(describeBank({ drawCount: '15', battleQuestionCount: '' }, 30)).toBe('This game will ask 15 of 30 questions. A battle will ask 15.')
    expect(describeBank({ drawCount: '', battleQuestionCount: '' }, 0)).toBe('Add some questions first, then choose how many to ask.')
  })
})