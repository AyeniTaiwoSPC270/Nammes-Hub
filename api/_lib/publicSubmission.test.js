import { describe, it, expect } from 'vitest'
import { validateContact, validateReport, validateFeedback, validateAnswers, REPORT_CATEGORIES, FEEDBACK_CATEGORIES } from './publicSubmission.js'

describe('validateContact', () => {
  const good = { name: ' Ada ', email: 'ada@example.com', message: ' Hello ' }
  it('accepts a good message and trims it', () => {
    expect(validateContact(good)).toEqual({ ok: true, value: { name: 'Ada', email: 'ada@example.com', message: 'Hello' } })
  })
  it('rejects blank, oversized and malformed input', () => {
    expect(validateContact({ ...good, name: '   ' }).ok).toBe(false)
    expect(validateContact({ ...good, name: 'x'.repeat(101) }).ok).toBe(false)
    expect(validateContact({ ...good, email: 'not-an-email' }).ok).toBe(false)
    expect(validateContact({ ...good, email: 'a@b.co\r\nBcc: x@y.z' }).ok).toBe(false)
    expect(validateContact({ ...good, email: `${'a'.repeat(250)}@b.co` }).ok).toBe(false)
    expect(validateContact({ ...good, message: 'x'.repeat(5001) }).ok).toBe(false)
    expect(validateContact({ ...good, message: 42 }).ok).toBe(false)
    expect(validateContact(null).ok).toBe(false)
  })
})

describe('validateReport', () => {
  const good = { category: 'broken_link', page_url: '/news/some-article', page_title: 'Some article', message: ' The link 404s ' }
  it('accepts each of the four categories and trims the note', () => {
    for (const category of REPORT_CATEGORIES) {
      expect(validateReport({ ...good, category }).ok, category).toBe(true)
    }
    expect(validateReport(good)).toEqual({
      ok: true,
      value: { category: 'broken_link', page_url: '/news/some-article', page_title: 'Some article', message: 'The link 404s' },
    })
  })
  it('treats an absent note as an empty one', () => {
    const { message, ...noNote } = good
    expect(validateReport(noNote)).toEqual({
      ok: true,
      value: { category: 'broken_link', page_url: '/news/some-article', page_title: 'Some article', message: '' },
    })
  })
  it('rejects an unknown or missing category', () => {
    expect(validateReport({ ...good, category: 'spam' }).ok).toBe(false)
    const { category, ...noCategory } = good
    expect(validateReport(noCategory).ok).toBe(false)
    expect(validateReport(null).ok).toBe(false)
  })
  it('rejects an absolute or off-site page address', () => {
    expect(validateReport({ ...good, page_url: 'https://evil.example/x' }).ok).toBe(false)
    expect(validateReport({ ...good, page_url: '//evil.example/x' }).ok).toBe(false)
    expect(validateReport({ ...good, page_url: 'news/x' }).ok).toBe(false)
    expect(validateReport({ ...good, page_url: `/${'a'.repeat(301)}` }).ok).toBe(false)
  })
  it('bounds the title and the note', () => {
    expect(validateReport({ ...good, page_title: '' }).ok).toBe(false)
    expect(validateReport({ ...good, page_title: 'x'.repeat(201) }).ok).toBe(false)
    expect(validateReport({ ...good, message: 'x'.repeat(1001) }).ok).toBe(false)
    expect(validateReport({ ...good, message: 'x'.repeat(1000) }).ok).toBe(true)
    expect(validateReport({ ...good, message: 42 }).ok).toBe(true)
  })
})

describe('validateFeedback', () => {
  const good = { rating: 4, category: 'speed', message: 'Loads fast', page_path: '/news' }

  it('accepts every rating from 1 to 5 and a missing reason', () => {
    for (const rating of [1, 2, 3, 4, 5]) {
      expect(validateFeedback({ ...good, rating }).ok, String(rating)).toBe(true)
    }
    expect(validateFeedback({ ...good, category: undefined }).value.category).toBeNull()
    expect(validateFeedback({ ...good, category: '' }).value.category).toBeNull()
  })

  it('rejects a rating that is out of range or not a whole number', () => {
    for (const rating of [0, 6, 3.5, 'three', null, undefined]) {
      expect(validateFeedback({ ...good, rating }).ok, String(rating)).toBe(false)
    }
    expect(validateFeedback(null).ok).toBe(false)
  })

  it('accepts each of the five reasons and rejects an unknown one', () => {
    for (const category of FEEDBACK_CATEGORIES) {
      expect(validateFeedback({ ...good, category }).ok, category).toBe(true)
    }
    expect(validateFeedback({ ...good, category: 'pricing' }).ok).toBe(false)
  })

  it('enforces the comment cap exactly and allows no comment at all', () => {
    expect(validateFeedback({ ...good, message: 'x'.repeat(1000) }).ok).toBe(true)
    expect(validateFeedback({ ...good, message: 'x'.repeat(1001) }).ok).toBe(false)
    expect(validateFeedback({ ...good, message: '' }).value.message).toBeNull()
    expect(validateFeedback({ ...good, message: '  ' }).value.message).toBeNull()
    expect(validateFeedback({ ...good, message: 42 }).value.message).toBeNull()
  })

  it('requires a page path that is a path', () => {
    expect(validateFeedback({ ...good, page_path: 'news' }).ok).toBe(false)
    expect(validateFeedback({ ...good, page_path: '//evil.example' }).ok).toBe(false)
    expect(validateFeedback({ ...good, page_path: `/${'a'.repeat(301)}` }).ok).toBe(false)
    expect(validateFeedback({ ...good, page_path: '/account' }).value.page_path).toBe('/account')
  })
})

describe('validateAnswers', () => {
  const ids = ['q1', 'q2']
  it('accepts an object whose keys are the form questions', () => {
    expect(validateAnswers({ q1: 'yes', q2: ['a', 'b'] }, ids)).toBe(true)
    expect(validateAnswers({}, ids)).toBe(true)
  })
  it('rejects unknown keys, non-objects and oversized payloads', () => {
    expect(validateAnswers({ zzz: 'x' }, ids)).toBe(false)
    expect(validateAnswers([], ids)).toBe(false)
    expect(validateAnswers('str', ids)).toBe(false)
    expect(validateAnswers(null, ids)).toBe(false)
    expect(validateAnswers({ q1: 'x'.repeat(60000) }, ids)).toBe(false)
  })
})
