import { describe, it, expect } from 'vitest'
import { createSystemTestHandler } from '../system-test.js'

function fakeRes() {
  const res = { statusCode: null, body: null, headers: {} }
  res.status = (c) => { res.statusCode = c; return res }
  res.json = (b) => { res.body = b; return res }
  res.setHeader = (k, v) => { res.headers[k] = v }
  return res
}

function setup({ isOwner = true, writeError = null } = {}) {
  const writes = []
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) },
    from: (table) => {
      if (table === 'admins') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { is_owner: isOwner } }) }) }) }
      return { upsert: async (row) => { writes.push([table, row]); return { error: writeError } } }
    },
  }
  return { handler: createSystemTestHandler({ getClient: () => client }), writes }
}
const req = (method = 'POST') => ({ method, headers: { authorization: 'Bearer t' } })

describe('system-test handler', () => {
  it('writes a labelled test row to the error log for the owner', async () => {
    const { handler, writes } = setup()
    const res = fakeRes()
    await handler(req(), res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ logged: true })
    expect(writes[0][0]).toBe('error_log')
    expect(writes[0][1].route).toBe('system-test')
    expect(writes[0][1].message).toContain('Test error')
  })
  it('refuses non-owners and non-POST', async () => {
    const a = fakeRes(); await setup({ isOwner: false }).handler(req(), a)
    const b = fakeRes(); await setup().handler(req('GET'), b)
    expect([a.statusCode, b.statusCode]).toEqual([403, 405])
  })
  it('reports failure when the row could not be written', async () => {
    const { handler } = setup({ writeError: { message: 'nope' } })
    const res = fakeRes()
    await handler(req(), res)
    expect(res.statusCode).toBe(500)
    expect(res.body.logged).toBe(false)
  })
})
