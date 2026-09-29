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

describe('getCaller two-factor enforcement', () => {
  const chain = (data) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data }) }) }) })
  const client = ({ adminRow, flagEnabled }) => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) },
    from: (table) => (table === 'feature_flags' ? chain({ enabled: flagEnabled }) : chain(adminRow)),
  })
  const tokenWithAal = (aal) => `h.${Buffer.from(JSON.stringify({ aal })).toString('base64url')}.s`

  it('blocks an admin who has not passed the second step when enforcement is on', async () => {
    const result = await getCaller(client({ adminRow: { is_owner: true }, flagEnabled: true }), tokenWithAal('aal1'))
    expect(result.error).toEqual([403, 'Two-factor verification required'])
  })
  it('allows an admin who passed the second step', async () => {
    const result = await getCaller(client({ adminRow: { is_owner: true }, flagEnabled: true }), tokenWithAal('aal2'))
    expect(result.error).toBeUndefined()
    expect(result.isOwner).toBe(true)
  })
  it('does not enforce anything while the switch is off', async () => {
    const result = await getCaller(client({ adminRow: { is_owner: true }, flagEnabled: false }), tokenWithAal('aal1'))
    expect(result.error).toBeUndefined()
  })
  it('never blocks ordinary members', async () => {
    const result = await getCaller(client({ adminRow: null, flagEnabled: true }), tokenWithAal('aal1'))
    expect(result.error).toBeUndefined()
    expect(result.isAdmin).toBe(false)
  })
  it('treats a malformed token as the lowest level', async () => {
    const result = await getCaller(client({ adminRow: { is_owner: true }, flagEnabled: true }), 'not-a-jwt')
    expect(result.error).toEqual([403, 'Two-factor verification required'])
  })
})
