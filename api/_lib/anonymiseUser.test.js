import { describe, it, expect } from 'vitest'
import { createAnonymiseUserHandler } from './handlers/anonymise-user.js'

const CALLER = '11111111-1111-4111-8111-111111111111'
const TARGET = '22222222-2222-4222-8222-222222222222'

function fakeRes() {
  const res = { statusCode: null, body: null, headers: {} }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (body) => { res.body = body; return res }
  res.setHeader = (k, v) => { res.headers[k] = v }
  return res
}

function fakeDb({ callerAdmin = { is_owner: true }, targetAdmin = null, rpcError = null } = {}) {
  const calls = { auth: [], rpc: [] }
  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: CALLER } }, error: null }),
      admin: { updateUserById: async (id, attrs) => { calls.auth.push([id, attrs]); return { error: null } } },
    },
    rpc: async (name, args) => { calls.rpc.push([name, args]); return { error: rpcError } },
    from: (table) => ({
      select: () => ({
        eq: (_col, value) => ({
          maybeSingle: async () => {
            if (table === 'feature_flags') return { data: { enabled: false } }
            return { data: value === CALLER ? callerAdmin : targetAdmin }
          },
        }),
      }),
    }),
  }
  return { client, calls }
}

const req = (body, method = 'POST') => ({ method, headers: { authorization: 'Bearer tok' }, body })

describe('anonymise-user handler', () => {
  it('rejects non-POST and bad ids', async () => {
    let res = fakeRes()
    await createAnonymiseUserHandler(() => fakeDb().client)(req({}, 'GET'), res)
    expect(res.statusCode).toBe(405)
    res = fakeRes()
    await createAnonymiseUserHandler(() => fakeDb().client)(req({ userId: 'x' }), res)
    expect(res.statusCode).toBe(400)
  })

  it('refuses a caller who is not the owner', async () => {
    const db = fakeDb({ callerAdmin: { is_owner: false } })
    const res = fakeRes()
    await createAnonymiseUserHandler(() => db.client)(req({ userId: TARGET }), res)
    expect(res.statusCode).toBe(403)
    expect(db.calls.rpc).toHaveLength(0)
  })

  it('refuses yourself and admin targets', async () => {
    let res = fakeRes()
    await createAnonymiseUserHandler(() => fakeDb().client)(req({ userId: CALLER }), res)
    expect(res.statusCode).toBe(400)
    const db = fakeDb({ targetAdmin: { user_id: TARGET } })
    res = fakeRes()
    await createAnonymiseUserHandler(() => db.client)(req({ userId: TARGET }), res)
    expect(res.statusCode).toBe(400)
    expect(db.calls.rpc).toHaveLength(0)
  })

  it('locks, scrubs the database, then clears the sign-in email', async () => {
    const db = fakeDb()
    const res = fakeRes()
    await createAnonymiseUserHandler(() => db.client)(req({ userId: TARGET }), res)
    expect(res.statusCode).toBe(200)
    expect(db.calls.auth[0][1]).toEqual({ ban_duration: '876000h' })
    expect(db.calls.rpc).toEqual([['anonymise_user', { p_user: TARGET }]])
    expect(db.calls.auth[1][1].email).toBe(`deleted-${TARGET}@invalid.example`)
  })

  it('does not clear the email if the database step fails', async () => {
    const db = fakeDb({ rpcError: { message: 'boom' } })
    const res = fakeRes()
    await createAnonymiseUserHandler(() => db.client)(req({ userId: TARGET }), res)
    expect(res.statusCode).toBe(500)
    expect(db.calls.auth).toHaveLength(1)
  })
})
