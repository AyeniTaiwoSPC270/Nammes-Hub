import { describe, it, expect } from 'vitest'
import { isSafeRecordKey, isWebhookAuthentic } from './webhookAuth.js'

function fakeClient({ signatureOk = false } = {}) {
  const calls = []
  return {
    calls,
    rpc: async (name, args) => {
      calls.push([name, args])
      if (name === 'verify_webhook_signature') return { data: signatureOk, error: null }
      return { data: null, error: { message: 'unknown' } }
    },
  }
}

const signed = { 'x-webhook-timestamp': '1700000000', 'x-webhook-signature': 'abcd' }

describe('isSafeRecordKey', () => {
  it('accepts uuids and simple ids', () => {
    expect(isSafeRecordKey('5ad4560a-6603-4419-b88f-3dd5c0dfdfaa')).toBe(true)
    expect(isSafeRecordKey('news-42_a')).toBe(true)
  })
  it('rejects path tricks, empty and non-strings', () => {
    expect(isSafeRecordKey('../admin')).toBe(false)
    expect(isSafeRecordKey('a/b')).toBe(false)
    expect(isSafeRecordKey('a?b=1')).toBe(false)
    expect(isSafeRecordKey('')).toBe(false)
    expect(isSafeRecordKey(undefined)).toBe(false)
    expect(isSafeRecordKey('x'.repeat(201))).toBe(false)
  })
})

describe('isWebhookAuthentic', () => {
  it('accepts a valid signature', async () => {
    const client = fakeClient({ signatureOk: true })
    expect(await isWebhookAuthentic(client, { headers: signed, table: 'news', key: 'abc' })).toBe(true)
    expect(client.calls.map((c) => c[0])).toEqual(['verify_webhook_signature'])
    expect(client.calls[0][1]).toEqual({ p_ts: 1700000000, p_table: 'news', p_key: 'abc', p_sig: 'abcd' })
  })
  it('rejects a bad signature even if the old shared-secret header is also sent', async () => {
    const client = fakeClient({ signatureOk: false })
    const headers = { ...signed, 'x-webhook-secret': 'legacy' }
    expect(await isWebhookAuthentic(client, { headers, table: 'news', key: 'abc' })).toBe(false)
  })
  it('no longer accepts the old shared-secret header on its own', async () => {
    const client = fakeClient({ signatureOk: true })
    expect(await isWebhookAuthentic(client, { headers: { 'x-webhook-secret': 's' }, table: 'news', key: 'abc' })).toBe(false)
    expect(client.calls).toHaveLength(0)
  })
  it('rejects requests with no credentials at all', async () => {
    const client = fakeClient({ signatureOk: true })
    expect(await isWebhookAuthentic(client, { headers: {}, table: 'news', key: 'abc' })).toBe(false)
    expect(client.calls).toHaveLength(0)
  })
  it('rejects a non-numeric timestamp without calling the database', async () => {
    const client = fakeClient({ signatureOk: true })
    const headers = { 'x-webhook-timestamp': 'nope', 'x-webhook-signature': 'abcd' }
    expect(await isWebhookAuthentic(client, { headers, table: 'news', key: 'abc' })).toBe(false)
    expect(client.calls).toHaveLength(0)
  })
})
