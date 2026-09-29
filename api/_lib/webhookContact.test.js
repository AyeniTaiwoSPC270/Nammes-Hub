import { describe, it, expect } from 'vitest'
import { createWebhookContactHandler } from '../webhook-contact.js'

const ID = '11111111-1111-4111-8111-111111111111'
const signed = { 'x-webhook-timestamp': '1700000000', 'x-webhook-signature': 'abcd' }

function fakeRes() {
  const res = { statusCode: null, body: null }
  res.status = (c) => { res.statusCode = c; return res }
  res.json = (b) => { res.body = b; return res }
  return res
}

function setup({ signatureOk = true, message, recentCount = 1, owners = [{ user_id: 'o1' }], ownerEmail = 'owner@example.com' } = {}) {
  const sent = []
  const rpcCalls = []
  const msg = message === undefined
    ? { id: ID, name: 'Ada', email: 'ada@example.com', message: 'Hello there', created_at: '2026-09-29T10:00:00Z' }
    : message
  const client = {
    rpc: async (name, args) => { rpcCalls.push([name, args]); return { data: signatureOk, error: null } },
    auth: { admin: { getUserById: async () => ({ data: { user: { email: ownerEmail } }, error: null }) } },
    from: (table) => {
      if (table === 'admins') return { select: () => ({ eq: async () => ({ data: owners }) }) }
      // contact_messages: either single lookup by id, or the recent-count query
      return {
        select: (_cols, opts) => {
          if (opts?.head) return { gte: async () => ({ count: recentCount }) }
          return { eq: () => ({ maybeSingle: async () => ({ data: msg }) }) }
        },
      }
    },
  }
  const enqueue = async (_client, rows) => { sent.push(...rows); return { queued: rows.length, error: null } }
  const handler = createWebhookContactHandler({ getClient: () => client, enqueue })
  return { handler, sent, rpcCalls }
}

const req = (body, headers = signed, method = 'POST') => ({ method, headers, body })
const good = { table: 'contact_messages', record: { id: ID } }

describe('webhook-contact handler', () => {
  it('emails the owner with the message, replying to the sender', async () => {
    const { handler, sent } = setup()
    const res = fakeRes()
    await handler(req(good), res)
    expect(res.statusCode).toBe(200)
    expect(sent).toHaveLength(1)
    expect(sent[0].to).toBe('owner@example.com')
    expect(sent[0].replyTo).toBe('ada@example.com')
    expect(sent[0].html).toContain('Hello there')
    expect(sent[0].subject).toBe('New contact message')
  })
  it('rejects non-POST, wrong table and unsafe ids', async () => {
    const { handler } = setup()
    const a = fakeRes(); await handler(req(good, signed, 'GET'), a)
    const b = fakeRes(); await handler(req({ table: 'news', record: { id: ID } }), b)
    const c = fakeRes(); await handler(req({ table: 'contact_messages', record: { id: '../x' } }), c)
    expect([a.statusCode, b.statusCode, c.statusCode]).toEqual([405, 400, 400])
  })
  it('rejects a bad signature and never accepts the legacy secret header', async () => {
    const bad = setup({ signatureOk: false })
    const r1 = fakeRes(); await bad.handler(req(good), r1)
    expect(r1.statusCode).toBe(401)
    expect(bad.sent).toHaveLength(0)
    const legacy = setup()
    const r2 = fakeRes(); await legacy.handler(req(good, { 'x-webhook-secret': 'legacy' }), r2)
    expect(r2.statusCode).toBe(401)
    expect(legacy.rpcCalls).toHaveLength(0)
  })
  it('escapes HTML in the visitor text and drops an invalid reply-to', async () => {
    const { handler, sent } = setup({
      message: { id: ID, name: '<b>Bob</b>', email: 'not an email\r\nBcc: x@y.z', message: '<script>alert(1)</script>', created_at: 'now' },
    })
    await handler(req(good), fakeRes())
    expect(sent[0].html).not.toContain('<script>')
    expect(sent[0].html).toContain('&lt;script&gt;')
    expect(sent[0].html).not.toContain('<b>Bob')
    expect(sent[0].replyTo).toBeUndefined()
  })
  it('stops emailing during a flood but still answers 200', async () => {
    const { handler, sent } = setup({ recentCount: 21 })
    const res = fakeRes()
    await handler(req(good), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.sent).toBe(false)
    expect(sent).toHaveLength(0)
  })
  it('does nothing if the message no longer exists', async () => {
    const { handler, sent } = setup({ message: null })
    const res = fakeRes()
    await handler(req(good), res)
    expect(res.statusCode).toBe(200)
    expect(sent).toHaveLength(0)
  })
})
