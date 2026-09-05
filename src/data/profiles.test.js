import { describe, it, expect } from 'vitest'
import { MATRIC_REGEX, validateStudentId } from './profiles'

describe('MATRIC_REGEX', () => {
  it('matches a valid department matric number', () => {
    expect(MATRIC_REGEX.test('240406012')).toBe(true)
  })
  it('matches a different entry year with the same department code', () => {
    expect(MATRIC_REGEX.test('260406009')).toBe(true)
  })
  it('rejects a different department prefix', () => {
    expect(MATRIC_REGEX.test('240401012')).toBe(false)
  })
  it('rejects the wrong digit count', () => {
    expect(MATRIC_REGEX.test('24040612')).toBe(false)
  })
})

describe('validateStudentId', () => {
  it('requires a value', () => {
    expect(validateStudentId('')).toBe('Matric number is required.')
  })
  it('rejects a non-department format', () => {
    expect(validateStudentId('190402001')).toBe('Use your department matric number (format: YY0406XXX, e.g. 240406012).')
  })
  it('accepts a valid department matric number', () => {
    expect(validateStudentId('240406012')).toBeNull()
  })
  it('accepts a valid matric number from a different entry year', () => {
    expect(validateStudentId('260406009')).toBeNull()
  })
  it('trims surrounding whitespace before validating', () => {
    expect(validateStudentId('  240406012  ')).toBeNull()
  })
})
