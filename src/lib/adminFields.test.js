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
  it('formats a null value (e.g. an unset optional list column like outlines.texts) as an empty string', () => {
    expect(formatListField(null)).toBe('')
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

  it('defaults a select field to its first option for a new record', () => {
    const selectFields = [{ field: 'category', type: 'select', options: ['Academics', 'Governance'] }]
    const state = buildFormState(selectFields, undefined)
    expect(state.category).toBe('Academics')
  })

  it('keeps an existing record value for a select field', () => {
    const selectFields = [{ field: 'category', type: 'select', options: ['Academics', 'Governance'] }]
    const state = buildFormState(selectFields, { category: 'Governance' })
    expect(state.category).toBe('Governance')
  })

  it('defaults an optional select field with a blank first option to empty string', () => {
    const selectFields = [{ field: 'badge_tone', type: 'select', options: ['', 'new', 'updated'], optional: true }]
    const state = buildFormState(selectFields, undefined)
    expect(state.badge_tone).toBe('')
  })

  it('builds an empty textarea value for an optional list field stored as null (e.g. outlines.texts with no recommended texts)', () => {
    const optionalListFields = [
      { field: 'topics', type: 'list' },
      { field: 'texts', type: 'list', optional: true },
    ]
    const state = buildFormState(optionalListFields, { topics: ['A'], texts: null })
    expect(state).toEqual({ topics: 'A', texts: '' })
  })

  it('turns a null optional list field back into an empty array on save, not null', () => {
    const optionalListFields = [{ field: 'texts', type: 'list', optional: true }]
    const payload = buildPayload(optionalListFields, { texts: '' })
    expect(payload).toEqual({ texts: [] })
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

describe('the video field type', () => {
  const videoFields = [
    {
      field: 'video_url',
      type: 'video',
      kindField: 'video_kind',
      previewField: 'video_preview',
      positionField: 'video_position',
      durationField: 'video_duration',
    },
  ]

  it('seeds preview and position for a new post so a blank never reaches the check constraint', () => {
    expect(buildFormState(videoFields, undefined)).toEqual({
      video_url: '',
      video_kind: '',
      video_preview: 'tap',
      video_position: 'top',
      video_duration: '',
    })
  })

  it('reads an existing record back unchanged', () => {
    const record = {
      video_url: 'https://x/storage/v1/object/public/news-videos/a.mp4',
      video_kind: 'file',
      video_preview: 'hover',
      video_position: 'bottom',
      video_duration: '4:12',
    }
    expect(buildFormState(videoFields, record)).toEqual(record)
  })

  it('nulls every companion column when the video is cleared, leaving no orphan kind', () => {
    const payload = buildPayload(videoFields, {
      video_url: '',
      video_kind: 'file',
      video_preview: 'auto',
      video_position: 'top',
      video_duration: '1:05',
    })
    expect(payload).toEqual({
      video_url: null,
      video_kind: null,
      video_preview: null,
      video_position: null,
      video_duration: null,
    })
  })

  it('passes a populated video through, trimmed', () => {
    const payload = buildPayload(videoFields, {
      video_url: 'https://youtu.be/abcdefghijk',
      video_kind: 'youtube',
      video_preview: 'auto',
      video_position: 'bottom',
      video_duration: ' 4:12 ',
    })
    expect(payload).toEqual({
      video_url: 'https://youtu.be/abcdefghijk',
      video_kind: 'youtube',
      video_preview: 'auto',
      video_position: 'bottom',
      video_duration: '4:12',
    })
  })

  it('falls back to the defaults for values outside the enums', () => {
    const payload = buildPayload(videoFields, {
      video_url: 'https://youtu.be/abcdefghijk',
      video_kind: 'youtube',
      video_preview: 'hoverish',
      video_position: 'sideways',
      video_duration: '',
    })
    expect(payload.video_preview).toBe('tap')
    expect(payload.video_position).toBe('top')
  })

  it('drops a duration that would print verbatim on the public card', () => {
    const payload = buildPayload(videoFields, {
      video_url: 'https://youtu.be/abcdefghijk',
      video_kind: 'youtube',
      video_preview: 'tap',
      video_position: 'top',
      video_duration: '12 minutes',
    })
    expect(payload.video_duration).toBeNull()
  })
})
