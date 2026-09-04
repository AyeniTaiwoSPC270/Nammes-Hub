import { describe, it, expect } from 'vitest'
import { MATRIC_REGEX, validateStudentId } from './profiles'

describe('MATRIC_REGEX', () => {
  it('matches a valid department matric number', () => {
    expect(MATRIC_REGEX.test('240406012')).toBe(true)
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
    expect(validateStudentId('190402001')).toBe('Use your department matric number (format: 240406XXX).')
  })
  it('accepts a valid department matric number', () => {
    expect(validateStudentId('240406012')).toBeNull()
  })
  it('trims surrounding whitespace before validating', () => {
    expect(validateStudentId('  240406012  ')).toBeNull()
  })
})
