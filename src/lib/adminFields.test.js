import { describe, it, expect } from 'vitest'
import {
  slugify,
  generateId,
  clampImageWidth,
  parseListField,
  formatListField,
  buildFormState,
  buildPayload,
} from './adminFields'

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('MME 101 Intro')).toBe('mme-101-intro')
  })
  it('strips leading/trailing hyphens', () => {
    expect(slugify('  Hello World!  ')).toBe('hello-world')
  })
})

describe('generateId', () => {
  it('prefixes with the slugified seed and a 6-char suffix', () => {
    const id = generateId('Exam Timetable')
    expect(id).toMatch(/^exam-timetable-[a-z0-9]{6}$/)
  })
})

describe('clampImageWidth', () => {
  it('clamps below the minimum', () => {
    expect(clampImageWidth(10)).toBe(30)
  })
  it('clamps above the maximum', () => {
    expect(clampImageWidth(150)).toBe(100)
  })
  it('leaves in-range values unchanged', () => {
    expect(clampImageWidth(60)).toBe(60)
  })
})

describe('parseListField / formatListField', () => {
  it('round-trips a list of lines', () => {
    const list = ['First topic', 'Second topic']
    expect(parseListField(formatListField(list))).toEqual(list)
  })
  it('drops blank lines', () => {
    expect(parseListField('a\n\n  \nb')).toEqual(['a', 'b'])
  })
})

describe('buildFormState / buildPayload', () => {
  const fields = [
    { field: 'title', type: 'text' },
    { field: 'topics', type: 'list' },
    { field: 'units', type: 'number' },
    { field: 'image_url', widthField: 'image_width_pct', type: 'image' },
  ]

  it('builds form state from an existing record', () => {
    const state = buildFormState(fields, {
      title: 'MME 101',
      topics: ['A', 'B'],
      units: 2,
      image_url: 'https://x/y.png',
      image_width_pct: 60,
    })
    expect(state).toEqual({
      title: 'MME 101',
      topics: 'A\nB',
      units: 2,
      image_url: 'https://x/y.png',
      image_width_pct: 60,
    })
  })

  it('defaults image width to 100 for a new record', () => {
    const state = buildFormState(fields, undefined)
    expect(state.image_width_pct).toBe(100)
  })

  it('builds a Supabase payload from form state', () => {
    const payload = buildPayload(fields, {
      title: 'MME 101',
      topics: 'A\nB',
      units: '2',
      image_url: 'https://x/y.png',
      image_width_pct: '60',
    })
    expect(payload).toEqual({
      title: 'MME 101',
      topics: ['A', 'B'],
      units: 2,
      image_url: 'https://x/y.png',
      image_width_pct: 60,
    })
  })
})
