import { describe, it, expect } from 'vitest'
import { captchaOptions, canSubmitWithCaptcha } from './turnstile'

describe('captchaOptions', () => {
  it('passes the token through when there is one', () => {
    expect(captchaOptions('tok123')).toEqual({ captchaToken: 'tok123' })
  })
  it('sends nothing when there is no token, so sign-in works while the check is not configured', () => {
    expect(captchaOptions('')).toEqual({})
    expect(captchaOptions(undefined)).toEqual({})
  })
})

describe('canSubmitWithCaptcha', () => {
  it('always allows submitting when the check is not configured', () => {
    expect(canSubmitWithCaptcha({ enabled: false, token: '' })).toBe(true)
  })
  it('requires a token when the check is configured', () => {
    expect(canSubmitWithCaptcha({ enabled: true, token: '' })).toBe(false)
    expect(canSubmitWithCaptcha({ enabled: true, token: 'tok' })).toBe(true)
  })
})
