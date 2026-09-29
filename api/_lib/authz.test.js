import { describe, it, expect } from 'vitest'
import { getCaller, bearerToken } from './authz.js'

function fakeAdminClient({ user = null, userError = null, adminRow = null } = {}) {
  return {
    auth: { getUser: async () => ({ data: { user }, error: userError }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: adminRow }) }) }),
    }),
  }
}

describe('bearerToken', () => {
  it('extracts the token from a Bearer header', () => {
    expect(bearerToken({ headers: { authorization: 'Bearer abc.def' } })).toBe('abc.def')
  })
  it('returns empty string when missing or not a Bearer header', () => {
    expect(bearerToken({ headers: {} })).toBe('')
    expect(bearerToken({ headers: { authorization: 'Basic xyz' } })).toBe('')
  })
})

describe('getCaller', () => {
  it('401 when no token', async () => {
    const result = await getCaller(fakeAdminClient(), '')
    expect(result.error).toEqual([401, 'Missing bearer token'])
  })
  it('401 when the session is invalid', async () => {
    const result = await getCaller(fakeAdminClient({ user: null, userError: new Error('bad') }), 'tok')
    expect(result.error).toEqual([401, 'Invalid session'])
  })
  it('reports a plain signed-in user as neither admin nor owner', async () => {
    const result = await getCaller(fakeAdminClient({ user: { id: 'u1' } }), 'tok')
    expect(result).toEqual({ user: { id: 'u1' }, isAdmin: false, isOwner: false })
  })
  it('reports an admin', async () => {
    const result = await getCaller(fakeAdminClient({ user: { id: 'u1' }, adminRow: { is_owner: false } }), 'tok')
    expect(result.isAdmin).toBe(true)
    expect(result.isOwner).toBe(false)
  })
  it('reports the owner', async () => {
    const result = await getCaller(fakeAdminClient({ user: { id: 'u1' }, adminRow: { is_owner: true } }), 'tok')
    expect(result.isAdmin).toBe(true)
    expect(result.isOwner).toBe(true)
  })
})
