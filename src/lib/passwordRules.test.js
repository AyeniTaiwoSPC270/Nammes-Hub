import { describe, expect, it } from 'vitest'
import { MIN_PASSWORD_LENGTH, PASSWORD_RULE, PASSWORD_TOO_SHORT, validatePassword } from './passwordRules'

describe('password rules', () => {
  it('requires ten characters', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(10)
    expect(validatePassword('123456789')).toBe(PASSWORD_TOO_SHORT)
    expect(validatePassword('1234567890')).toBe('')
  })

  it('states the same number in the helper and the error', () => {
    expect(PASSWORD_RULE).toContain(String(MIN_PASSWORD_LENGTH))
    expect(PASSWORD_TOO_SHORT).toContain(String(MIN_PASSWORD_LENGTH))
  })
})
