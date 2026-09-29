import { describe, it, expect, vi } from 'vitest'
import { createDisableUserHandler } from './handlers/disable-user.js'

const CALLER = '11111111-1111-4111-8111-111111111111'
const TARGET = '22222222-2222-4222-8222-222222222222'

function fakeRes() {
  const res = { statusCode: null, body: null, headers: {} }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (body) => { res.body = body; return res }
  res.setHeader = (k, v) => { res.headers[k] = v }
  return res
}

function fakeDb({ callerAdmin = { is_owner: false }, targetAdmin = null, banError = null, profileError = null } = {}) {
  const calls = { ban: [], profile: [] }
  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: CALLER } }, error: null }),
      admin: {
        updateUserById: async (id, attrs) => { calls.ban.push([id, attrs]); return { error: banError } },
      },
    },
    from: (table) => ({
      select: () => ({
        eq: (_col, value) => ({
          maybeSingle: async () => ({ data: value === CALLER ? callerAdmin : targetAdmin }),
        }),
      }),
      update: (patch) => ({
        eq: async (_col, value) => { calls.profile.push([table, patch, value]); return { error: profileError } },
      }),
    }),
  }
  return { client, calls }
}

function req(body, { method = 'POST', token = 'tok' } = {}) {
  return { method, headers: { authorization: token ? `Bearer ${token}` : '' }, body }
}

describe('disable-user handler', () => {
  it('rejects non-POST', async () => {
    const res = fakeRes()
    await createDisableUserHandler(() => fakeDb().client)(req({}, { method: 'GET' }), res)
    expect(res.statusCode).toBe(405)
  })

  it('rejects a non-UUID userId with 400', async () => {
    const res = fakeRes()
    await createDisableUserHandler(() => fakeDb().client)(req({ userId: 'nope', disabled: true }), res)
    expect(res.statusCode).toBe(400)
  })

  it('rejects a non-boolean disabled flag with 400', async () => {
    const res = fakeRes()
    await createDisableUserHandler(() => fakeDb().client)(req({ userId: TARGET, disabled: 'yes' }), res)
    expect(res.statusCode).toBe(400)
  })

  it('403 when the caller is not an admin', async () => {
    const res = fakeRes()
    await createDisableUserHandler(() => fakeDb({ callerAdmin: null }).client)(req({ userId: TARGET, disabled: true }), res)
    expect(res.statusCode).toBe(403)
  })

  it('refuses to disable yourself', async () => {
    const res = fakeRes()
    await createDisableUserHandler(() => fakeDb().client)(req({ userId: CALLER, disabled: true }), res)
    expect(res.statusCode).toBe(400)
  })

  it('refuses to disable the owner', async () => {
    const res = fakeRes()
    const { client, calls } = fakeDb({ targetAdmin: { is_owner: true } })
    await createDisableUserHandler(() => client)(req({ userId: TARGET, disabled: true }), res)
    expect(res.statusCode).toBe(400)
    expect(calls.ban).toHaveLength(0)
  })

  it('disabling marks the profile AND bans the auth user', async () => {
    const res = fakeRes()
    const { client, calls } = fakeDb()
    await createDisableUserHandler(() => client)(req({ userId: TARGET, disabled: true }), res)
    expect(res.statusCode).toBe(200)
    expect(calls.profile).toEqual([['profiles', { is_disabled: true }, TARGET]])
    expect(calls.ban).toEqual([[TARGET, { ban_duration: '876000h' }]])
  })

  it('enabling lifts the ban and clears the flag', async () => {
    const res = fakeRes()
    const { client, calls } = fakeDb()
    await createDisableUserHandler(() => client)(req({ userId: TARGET, disabled: false }), res)
    expect(res.statusCode).toBe(200)
    expect(calls.profile).toEqual([['profiles', { is_disabled: false }, TARGET]])
    expect(calls.ban).toEqual([[TARGET, { ban_duration: 'none' }]])
  })

  it('502 with a generic message (no internal detail) when the ban call fails', async () => {
    const res = fakeRes()
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client } = fakeDb({ banError: new Error('internal secret detail') })
    await createDisableUserHandler(() => client)(req({ userId: TARGET, disabled: true }), res)
    expect(res.statusCode).toBe(502)
    expect(JSON.stringify(res.body)).not.toContain('internal secret detail')
    spy.mockRestore()
  })
})
