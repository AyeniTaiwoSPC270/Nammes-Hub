import { describe, it, expect } from 'vitest'
import { identityChanged } from './queryClient'

describe('identityChanged', () => {
  it('ignores the first identity resolution, when the cache is still empty', () => {
    expect(identityChanged(undefined, 'a')).toBe(false)
  })
  it('clears when an account signs out', () => {
    expect(identityChanged('a', null)).toBe(true)
  })
  it('clears when a different account signs in', () => {
    expect(identityChanged('a', 'b')).toBe(true)
  })
  it('keeps the cache across a token refresh for the same account', () => {
    expect(identityChanged('a', 'a')).toBe(false)
  })
})
