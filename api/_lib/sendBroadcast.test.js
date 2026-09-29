import { describe, it, expect } from 'vitest'
import { createSendBroadcastHandler } from '../send-broadcast.js'

const CALLER = '11111111-1111-4111-8111-111111111111'
process.env.VITE_SUPABASE_URL = 'https://proj.supabase.co'

function fakeRes() {
  const res = { statusCode: null, body: null }
  res.status = (c) => { res.statusCode = c; return res }
  res.json = (b) => { res.body = b; return res }
  return res
}

function setup({ adminRow = { is_owner: true }, recent = [], flagEnabled = true } = {}) {
  const sent = []
  const inserts = []
  const chain = (data) => {
    const q = { select: () => q, eq: () => q, gte: () => q, limit: async () => ({ data }), maybeSingle: async () => ({ data }) }
    return q
  }
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: CALLER } }, error: null }) },
    rpc: async () => ({ data: [{ email: 'a@x.com' }, { email: 'b@x.com' }], error: null }),
    from: (table) => {
      if (table === 'admins') return chain(adminRow)
      if (table === 'email_templates') return chain(null)
      if (table === 'feature_flags') return chain({ enabled: flagEnabled })
      return { ...chain(recent), insert: async (row) => { inserts.push(row); return { error: null } } }
    },
  }
  const resend = { batch: { send: async (msgs) => { sent.push(...msgs) } } }
  const handler = createSendBroadcastHandler({ getClient: () => client, getResend: () => resend })
  return { handler, sent, inserts }
}

const req = (body) => ({ method: 'POST', headers: { authorization: 'Bearer tok' }, body })
const good = { subject: 'Hello', body: 'World', templateId: 'default' }

describe('send-broadcast handler', () => {
  it('sends to all recipients and records the broadcast for an owner', async () => {
    const { handler, sent, inserts } = setup()
    const res = fakeRes()
    await handler(req(good), res)
    expect(res.statusCode).toBe(200)
    expect(sent).toHaveLength(2)
    expect(inserts).toHaveLength(1)
  })
  it('rejects an admin who is not the owner', async () => {
    const { handler, sent } = setup({ adminRow: { is_owner: false } })
    const res = fakeRes()
    await handler(req(good), res)
    expect(res.statusCode).toBe(403)
    expect(sent).toHaveLength(0)
  })
  it('rejects a duplicate of a broadcast sent in the last 10 minutes', async () => {
    const { handler, sent } = setup({ recent: [{ id: 'x' }] })
    const res = fakeRes()
    await handler(req(good), res)
    expect(res.statusCode).toBe(409)
    expect(sent).toHaveLength(0)
  })
  it('rejects an image from another host', async () => {
    const { handler, sent } = setup()
    const res = fakeRes()
    await handler(req({ ...good, imageUrl: 'https://evil.example/a.png' }), res)
    expect(res.statusCode).toBe(400)
    expect(sent).toHaveLength(0)
  })
  it('accepts an image from the project storage host', async () => {
    const { handler } = setup()
    const res = fakeRes()
    await handler(req({ ...good, imageUrl: 'https://proj.supabase.co/storage/v1/object/public/broadcast-images/a.png' }), res)
    expect(res.statusCode).toBe(200)
  })
  it('is switched off by the broadcasts kill switch', async () => {
    const { handler, sent } = setup({ flagEnabled: false })
    const res = fakeRes()
    await handler(req(good), res)
    expect(res.statusCode).toBe(503)
    expect(sent).toHaveLength(0)
  })
  it('rejects an oversized subject or body', async () => {
    const { handler, sent } = setup()
    const a = fakeRes()
    await handler(req({ ...good, subject: 'x'.repeat(201) }), a)
    const b = fakeRes()
    await handler(req({ ...good, body: 'x'.repeat(20001) }), b)
    expect([a.statusCode, b.statusCode]).toEqual([400, 400])
    expect(sent).toHaveLength(0)
  })
})
