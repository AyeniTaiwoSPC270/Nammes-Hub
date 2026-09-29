import { describe, it, expect } from 'vitest'
import { validateContact, validateAnswers } from './publicSubmission.js'

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
