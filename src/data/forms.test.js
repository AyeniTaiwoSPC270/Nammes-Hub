import { describe, it, expect } from 'vitest'
import {
  validateFormDraft,
  validateQuestionDraft,
  validateQuestions,
  validateAnswers,
  isFormOpen,
  isFocusFill,
} from './forms'

describe('validateFormDraft', () => {
  it('requires a title', () => {
    expect(validateFormDraft({ title: '' })).toBe('A title is required.')
    expect(validateFormDraft({ title: '   ' })).toBe('A title is required.')
  })
  it('returns null for a valid title', () => {
    expect(validateFormDraft({ title: 'RSVP' })).toBeNull()
  })
})

describe('validateQuestionDraft', () => {
  it('requires a label', () => {
    expect(validateQuestionDraft({ type: 'short_text', label: '' })).toBe('Every question needs a label.')
  })
  it('requires at least one non-blank option for a choice question', () => {
    expect(validateQuestionDraft({ type: 'multiple_choice', label: 'Pick one', options: [] })).toBe(
      'Add at least one option.'
    )
    expect(validateQuestionDraft({ type: 'multiple_choice', label: 'Pick one', options: ['', '  '] })).toBe(
      'Add at least one option.'
    )
  })
  it('accepts a choice question with at least one non-blank option', () => {
    expect(validateQuestionDraft({ type: 'multiple_choice', label: 'Pick one', options: ['A'] })).toBeNull()
  })
  it('requires scale_min less than scale_max for a linear scale', () => {
    expect(
      validateQuestionDraft({ type: 'linear_scale', label: 'Rate it', scale_min: 5, scale_max: 5 })
    ).toBe('Scale minimum must be less than maximum.')
  })
  it('accepts a valid linear scale', () => {
    expect(
      validateQuestionDraft({ type: 'linear_scale', label: 'Rate it', scale_min: 1, scale_max: 5 })
    ).toBeNull()
  })
  it('returns null for a valid short-text question', () => {
    expect(validateQuestionDraft({ type: 'short_text', label: 'Name' })).toBeNull()
  })
})

describe('validateQuestions', () => {
  it('returns the first error found', () => {
    expect(
      validateQuestions([{ type: 'short_text', label: 'Name' }, { type: 'short_text', label: '' }])
    ).toBe('Every question needs a label.')
  })
  it('returns null when every question is valid', () => {
    expect(validateQuestions([{ type: 'short_text', label: 'Name' }])).toBeNull()
  })
})

describe('validateAnswers', () => {
  const questions = [
    { id: 'q1', label: 'Name', required: true },
    { id: 'q2', label: 'Notes', required: false },
    { id: 'q3', label: 'Toppings', required: true },
  ]
  it('flags a missing required answer', () => {
    expect(validateAnswers(questions, { q3: ['A'] })).toBe('"Name" is required.')
  })
  it('flags an empty-array required answer (e.g. unchecked checkboxes)', () => {
    expect(validateAnswers(questions, { q1: 'Ada', q3: [] })).toBe('"Toppings" is required.')
  })
  it('passes when every required question is answered', () => {
    expect(validateAnswers(questions, { q1: 'Ada', q3: ['A'] })).toBeNull()
  })
})

describe('isFormOpen', () => {
  const now = new Date('2026-09-04T12:00:00Z')
  it('is false when is_accepting_responses is false', () => {
    expect(isFormOpen({ is_accepting_responses: false, closes_at: null }, now)).toBe(false)
  })
  it('is false when closes_at is in the past', () => {
    expect(isFormOpen({ is_accepting_responses: true, closes_at: '2026-09-01T00:00:00Z' }, now)).toBe(false)
  })
  it('is true when closes_at is in the future', () => {
    expect(isFormOpen({ is_accepting_responses: true, closes_at: '2026-09-10T00:00:00Z' }, now)).toBe(true)
  })
  it('is true when closes_at is not set', () => {
    expect(isFormOpen({ is_accepting_responses: true, closes_at: null }, now)).toBe(true)
  })
})

describe('isFocusFill', () => {
  const focusForm = { focus_mode: true, require_signin: false, one_response_per_person: false }
  const open = { open: true }

  it('is true for an open focus-mode form being answered', () => {
    expect(isFocusFill(focusForm, open)).toBe(true)
  })
  it('is false without focus_mode, so the default form keeps the navbar', () => {
    expect(isFocusFill({ ...focusForm, focus_mode: false }, open)).toBe(false)
  })
  it('is false before the form has loaded', () => {
    expect(isFocusFill(undefined, open)).toBe(false)
  })
  it('is false on the closed screen, which keeps a way back into the site', () => {
    expect(isFocusFill(focusForm, { open: false })).toBe(false)
  })
  it('is false on the sign-in screen', () => {
    const form = { ...focusForm, require_signin: true }
    expect(isFocusFill(form, { ...open, signedIn: false })).toBe(false)
    expect(isFocusFill(form, { ...open, signedIn: true })).toBe(true)
  })
  it('is false when a one-response form has already been answered, but true while editing it', () => {
    const form = { ...focusForm, one_response_per_person: true }
    expect(isFocusFill(form, { ...open, hasResponse: true, editing: false })).toBe(false)
    expect(isFocusFill(form, { ...open, hasResponse: true, editing: true })).toBe(true)
  })
  it('is true for a one-response form with no response yet', () => {
    const form = { ...focusForm, one_response_per_person: true }
    expect(isFocusFill(form, { ...open, hasResponse: false })).toBe(true)
  })
})
