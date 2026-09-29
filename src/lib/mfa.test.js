import { describe, it, expect } from 'vitest'
import { aalStatus, cleanCode, isCompleteCode } from './mfa'

describe('aalStatus', () => {
  it('is "off" when no second factor is enrolled', () => {
    expect(aalStatus({ currentLevel: 'aal1', nextLevel: 'aal1' })).toBe('off')
  })
  it('asks for a code when a factor is enrolled but not yet verified this session', () => {
    expect(aalStatus({ currentLevel: 'aal1', nextLevel: 'aal2' })).toBe('challenge')
  })
  it('is "verified" once the session has passed the second step', () => {
    expect(aalStatus({ currentLevel: 'aal2', nextLevel: 'aal2' })).toBe('verified')
    expect(aalStatus({ currentLevel: 'aal2', nextLevel: 'aal1' })).toBe('verified')
  })
  it('treats missing data as "off" rather than blocking sign-in', () => {
    expect(aalStatus(null)).toBe('off')
    expect(aalStatus({})).toBe('off')
  })
})

describe('code helpers', () => {
  it('keeps only digits, at most six', () => {
    expect(cleanCode('12a 34-56 78')).toBe('123456')
    expect(cleanCode('')).toBe('')
    expect(cleanCode(undefined)).toBe('')
  })
  it('accepts exactly six digits', () => {
    expect(isCompleteCode('123456')).toBe(true)
    expect(isCompleteCode('12345')).toBe(false)
    expect(isCompleteCode('1234567')).toBe(false)
    expect(isCompleteCode('12345a')).toBe(false)
  })
})
