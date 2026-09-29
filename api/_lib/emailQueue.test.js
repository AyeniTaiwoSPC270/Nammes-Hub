import { describe, it, expect } from 'vitest'
import { enqueueEmails, nextAttemptAt, MAX_ATTEMPTS } from './emailQueue.js'
import { createEmailWorkerHandler } from './handlers/email-worker.js'
import { createWebhookNewContentHandler } from '../webhook-new-content.js'
import { createWebhookWelcomeHandler } from '../webhook-welcome.js'

const NOW = new Date('2026-10-01T12:00:00Z')

function fakeRes() {
  const res = { statusCode: null, body: null }
  res.status = (c) => { res.statusCode = c; return res }
  res.json = (b) => { res.body = b; return res }
  res.setHeader = () => {}
  return res
}

describe('enqueueEmails', () => {
  it('maps rows, skips duplicate keys, and splits big lists', async () => {
    const upserts = []
    const client = { from: () => ({ upsert: async (rows, opts) => { upserts.push([rows, opts]); return { error: null } } }) }
    const rows = Array.from({ length: 1200 }, (_, i) => ({ kind: 'k', to: `u${i}@x.com`, subject: 's', html: 'h', dedupeKey: `d${i}` }))
    const result = await enqueueEmails(client, rows)
    expect(result).toEqual({ queued: 1200, error: null })
    expect(upserts).toHaveLength(3)
    expect(upserts[0][1]).toEqual({ onConflict: 'dedupe_key', ignoreDuplicates: true })
    expect(upserts[0][0][0]).toMatchObject({ to_email: 'u0@x.com', dedupe_key: 'd0', reply_to: null })
  })

  it('stops and reports the error, with how many were queued before it', async () => {
    let calls = 0
    const client = { from: () => ({ upsert: async () => (++calls === 2 ? { error: { message: 'boom' } } : { error: null }) }) }
    const rows = Array.from({ length: 700 }, (_, i) => ({ kind: 'k', to: `u${i}@x.com`, subject: 's', html: 'h' }))
    const result = await enqueueEmails(client, rows)
    expect(result.queued).toBe(500)
    expect(result.error.message).toBe('boom')
  })
})

describe('nextAttemptAt', () => {
  it('waits longer after each failure', () => {
    const minutes = [1, 2, 3, 4, 5].map((n) => (new Date(nextAttemptAt(n, NOW)) - NOW) / 60000)
    expect(minutes).toEqual([1, 5, 15, 60, 240])
    expect(MAX_ATTEMPTS).toBe(5)
  })
})

function workerSetup({ signatureOk = true, rows = [], sendResult = { error: null }, sendThrows = false, claimError = null } = {}) {
  const updates = []
  const errors = []
  const sends = []
  const client = {
    rpc: async (name) => {
      if (name === 'verify_webhook_signature') return { data: signatureOk }
      return { data: rows, error: claimError }
    },
    from: (table) => {
      if (table === 'error_log') return { upsert: async (row) => { errors.push(row); return { error: null } } }
      return {
        update: (patch) => ({
          in: async (_col, ids) => { updates.push({ patch, ids }); return { error: null } },
          eq: async (_col, id) => { updates.push({ patch, ids: [id] }); return { error: null } },
        }),
      }
    },
  }
  const resend = {
    batch: {
      send: async (msgs) => {
        sends.push(msgs)
        if (sendThrows) throw new Error('network down')
        return sendResult
      },
    },
  }
  const handler = createEmailWorkerHandler({ getClient: () => client, getResend: () => resend, now: () => NOW })
  return { handler, updates, errors, sends }
}

const signed = { 'x-webhook-timestamp': '1700000000', 'x-webhook-signature': 'abcd' }
const workerReq = (headers = signed, method = 'POST') => ({ method, headers, body: {} })
const row = (id, attempts = 1) => ({ id, to_email: `u${id}@x.com`, subject: 's', html: 'h', reply_to: null, attempts })

describe('email-worker handler', () => {
  it('rejects non-POST, a bad signature and the legacy secret header', async () => {
    let res = fakeRes()
    await workerSetup().handler(workerReq(signed, 'GET'), res)
    expect(res.statusCode).toBe(405)
    res = fakeRes()
    await workerSetup({ signatureOk: false }).handler(workerReq(), res)
    expect(res.statusCode).toBe(401)
    res = fakeRes()
    await workerSetup().handler(workerReq({ 'x-webhook-secret': 'legacy' }), res)
    expect(res.statusCode).toBe(401)
  })

  it('does nothing when the queue is empty', async () => {
    const { handler, sends } = workerSetup()
    const res = fakeRes()
    await handler(workerReq(), res)
    expect(res.body).toEqual({ sent: 0, retried: 0, failed: 0 })
    expect(sends).toHaveLength(0)
  })

  it('sends in batches of 100 and marks them sent', async () => {
    const rows = Array.from({ length: 150 }, (_, i) => row(i + 1))
    const { handler, sends, updates } = workerSetup({ rows })
    const res = fakeRes()
    await handler(workerReq(), res)
    expect(res.body).toEqual({ sent: 150, retried: 0, failed: 0 })
    expect(sends.map((s) => s.length)).toEqual([100, 50])
    expect(updates.every((u) => u.patch.status === 'sent')).toBe(true)
  })

  it('passes reply-to through', async () => {
    const { handler, sends } = workerSetup({ rows: [{ ...row(1), reply_to: 'ada@x.com' }] })
    await handler(workerReq(), fakeRes())
    expect(sends[0][0].replyTo).toBe('ada@x.com')
  })

  it('schedules a retry when the provider returns an error, without marking failed', async () => {
    const { handler, updates, errors } = workerSetup({ rows: [row(1, 1), row(2, 1)], sendResult: { error: { message: 'rate limited' } } })
    const res = fakeRes()
    await handler(workerReq(), res)
    expect(res.body).toEqual({ sent: 0, retried: 2, failed: 0 })
    expect(updates[0].patch.status).toBeUndefined()
    expect(updates[0].patch.next_attempt_at).toBe(nextAttemptAt(1, NOW))
    expect(updates[0].patch.last_error).toBe('rate limited')
    expect(errors).toHaveLength(0)
  })

  it('retries when the send throws', async () => {
    const { handler } = workerSetup({ rows: [row(1, 2)], sendThrows: true })
    const res = fakeRes()
    await handler(workerReq(), res)
    expect(res.body.retried).toBe(1)
  })

  it('gives up after the last attempt and logs once', async () => {
    const { handler, updates, errors } = workerSetup({ rows: [row(1, MAX_ATTEMPTS), row(2, MAX_ATTEMPTS)], sendResult: { error: { message: 'bad address' } } })
    const res = fakeRes()
    await handler(workerReq(), res)
    expect(res.body).toEqual({ sent: 0, retried: 0, failed: 2 })
    expect(updates[0].patch.status).toBe('failed')
    expect(errors).toHaveLength(1)
  })

  it('reports a generic error when the queue cannot be read', async () => {
    const { handler } = workerSetup({ claimError: { message: 'secret detail' } })
    const res = fakeRes()
    await handler(workerReq(), res)
    expect(res.statusCode).toBe(500)
    expect(JSON.stringify(res.body)).not.toContain('secret detail')
  })
})

describe('webhook-new-content and webhook-welcome queue their emails', () => {
  const okClient = (extra = {}) => ({ rpc: async (name) => (name === 'verify_webhook_signature' ? { data: true } : { data: [{ email: 'a@x.com' }, { email: 'b@x.com' }], error: null }), ...extra })

  it('new content: one queued email per recipient with a per-recipient dedupe key', async () => {
    const queued = []
    const enqueue = async (_c, rows) => { queued.push(...rows); return { queued: rows.length, error: null } }
    const handler = createWebhookNewContentHandler({ getClient: () => okClient(), enqueue })
    const res = fakeRes()
    await handler({ method: 'POST', headers: signed, body: { table: 'news', record: { id: 'my-post', title: 'Big news' } } }, res)
    expect(res.statusCode).toBe(200)
    expect(queued.map((r) => r.dedupeKey)).toEqual(['new-content:news:my-post:a@x.com', 'new-content:news:my-post:b@x.com'])
    expect(queued[0].subject).toBe('News update: Big news')
  })

  it('welcome: queues one email keyed by the user', async () => {
    const queued = []
    const enqueue = async (_c, rows) => { queued.push(...rows); return { queued: rows.length, error: null } }
    const client = okClient({ auth: { admin: { getUserById: async () => ({ data: { user: { email: 'new@x.com' } }, error: null }) } } })
    const handler = createWebhookWelcomeHandler({ getClient: () => client, enqueue })
    const res = fakeRes()
    await handler({ method: 'POST', headers: signed, body: { record: { user_id: 'u-1', full_name: 'Ada' } } }, res)
    expect(res.body).toEqual({ sent: true })
    expect(queued[0]).toMatchObject({ to: 'new@x.com', dedupeKey: 'welcome:u-1' })
  })

  it('a queue failure is logged, not thrown', async () => {
    const enqueue = async () => ({ queued: 0, error: { message: 'db down' } })
    const handler = createWebhookNewContentHandler({ getClient: () => okClient({ from: () => ({ upsert: async () => ({ error: null }) }) }), enqueue })
    const res = fakeRes()
    await handler({ method: 'POST', headers: signed, body: { table: 'events', record: { id: 'e1', title: 'Party' } } }, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.queued).toBe(0)
  })
})
