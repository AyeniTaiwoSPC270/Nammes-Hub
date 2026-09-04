import { describe, it, expect } from 'vitest'
import {
  countResponsesByForm,
  buildResponseSummary,
  formatAnswerForDisplay,
  responsesToCsv,
  collectFileUploadUrls,
  storagePathFromUrl,
} from './formResponses'

describe('countResponsesByForm', () => {
  it('counts rows per form_id', () => {
    expect(countResponsesByForm([{ form_id: 'a' }, { form_id: 'a' }, { form_id: 'b' }])).toEqual({ a: 2, b: 1 })
  })
  it('returns an empty object for no rows', () => {
    expect(countResponsesByForm([])).toEqual({})
  })
})

describe('formatAnswerForDisplay', () => {
  it('joins a checkbox array with commas', () => {
    expect(formatAnswerForDisplay({ type: 'checkboxes' }, ['A', 'B'])).toBe('A, B')
  })
  it('renders an em dash for an unanswered question', () => {
    expect(formatAnswerForDisplay({ type: 'short_text' }, undefined)).toBe('—')
    expect(formatAnswerForDisplay({ type: 'short_text' }, '')).toBe('—')
  })
  it('stringifies a scalar answer', () => {
    expect(formatAnswerForDisplay({ type: 'linear_scale' }, 4)).toBe('4')
  })
  it('passes through a file_upload URL as-is', () => {
    expect(formatAnswerForDisplay({ type: 'file_upload' }, 'https://x/y.pdf')).toBe('https://x/y.pdf')
  })
})

describe('buildResponseSummary', () => {
  const questions = [
    { id: 'q1', type: 'multiple_choice', options: ['Yes', 'No'] },
    { id: 'q2', type: 'checkboxes', options: ['Red', 'Blue'] },
    { id: 'q3', type: 'linear_scale', scale_min: 1, scale_max: 3 },
    { id: 'q4', type: 'short_text' },
  ]
  const responses = [
    { answers: { q1: 'Yes', q2: ['Red', 'Blue'], q3: 2, q4: 'Great event' } },
    { answers: { q1: 'Yes', q2: ['Red'], q3: 3, q4: 'Loved it' } },
    { answers: { q1: 'No', q2: [], q3: 1 } },
  ]

  it('counts multiple_choice answers per option, in option order', () => {
    const [q1Summary] = buildResponseSummary(questions, responses)
    expect(q1Summary.kind).toBe('choice')
    expect(q1Summary.counts).toEqual([{ option: 'Yes', count: 2 }, { option: 'No', count: 1 }])
  })

  it('flattens and counts checkboxes answers per option', () => {
    const [, q2Summary] = buildResponseSummary(questions, responses)
    expect(q2Summary.counts).toEqual([{ option: 'Red', count: 2 }, { option: 'Blue', count: 1 }])
  })

  it('counts linear_scale answers across the full min-max range', () => {
    const [, , q3Summary] = buildResponseSummary(questions, responses)
    expect(q3Summary.counts).toEqual([
      { option: '1', count: 1 },
      { option: '2', count: 1 },
      { option: '3', count: 1 },
    ])
  })

  it('collects short_text answers as a plain text list, skipping unanswered', () => {
    const [, , , q4Summary] = buildResponseSummary(questions, responses)
    expect(q4Summary.kind).toBe('text')
    expect(q4Summary.answers).toEqual(['Great event', 'Loved it'])
  })
})

describe('responsesToCsv', () => {
  it('writes a header row of "Submitted at" plus question labels', () => {
    const questions = [{ id: 'q1', type: 'short_text', label: 'Name' }, { id: 'q2', type: 'checkboxes', label: 'Toppings' }]
    expect(responsesToCsv(questions, [])).toBe('Submitted at,Name,Toppings')
  })
  it('writes one row per response, joining checkbox answers', () => {
    const questions = [{ id: 'q1', type: 'short_text', label: 'Name' }, { id: 'q2', type: 'checkboxes', label: 'Toppings' }]
    const csv = responsesToCsv(questions, [
      { submitted_at: '2026-09-04T12:00:00.000Z', answers: { q1: 'Ada', q2: ['Red', 'Blue'] } },
    ])
    expect(csv).toBe('Submitted at,Name,Toppings\n2026-09-04T12:00:00.000Z,Ada,"Red, Blue"')
  })
  it('quotes and escapes a value containing a comma or quote', () => {
    const csv = responsesToCsv([{ id: 'q1', type: 'short_text', label: 'Name' }], [
      { submitted_at: '2026-09-04T12:00:00.000Z', answers: { q1: 'Smith, "Ada"' } },
    ])
    expect(csv).toContain('"Smith, ""Ada"""')
  })
})

describe('collectFileUploadUrls', () => {
  it('collects file_upload answer values across all responses', () => {
    const questions = [{ id: 'q1', type: 'file_upload' }, { id: 'q2', type: 'short_text' }]
    const responses = [{ answers: { q1: 'https://x/a.pdf', q2: 'text' } }, { answers: { q1: 'https://x/b.pdf' } }]
    expect(collectFileUploadUrls(questions, responses)).toEqual(['https://x/a.pdf', 'https://x/b.pdf'])
  })
  it('returns an empty array when there are no file_upload questions', () => {
    expect(collectFileUploadUrls([{ id: 'q1', type: 'short_text' }], [{ answers: { q1: 'x' } }])).toEqual([])
  })
})

describe('storagePathFromUrl', () => {
  it('extracts the path after the bucket segment', () => {
    expect(
      storagePathFromUrl('https://x.supabase.co/storage/v1/object/public/form-uploads/abc/file.pdf', 'form-uploads')
    ).toBe('abc/file.pdf')
  })
  it('returns null when the bucket segment is not present', () => {
    expect(storagePathFromUrl('https://x/other-bucket/file.pdf', 'form-uploads')).toBeNull()
  })
})
