import { describe, it, expect } from 'vitest'
import { logError, scrubForLog } from './logError.js'

function fakeClient({ failInsert = false } = {}) {
  const calls = []
  return {
    calls,
    from: (table) => ({
      upsert: async (row, opts) => {
        calls.push([table, row, opts])
        if (failInsert) throw new Error('db down')
        return { error: null }
      },
    }),
  }
}

describe('scrubForLog', () => {
  it('masks emails, matric numbers and tokens, and trims length', () => {
    expect(scrubForLog('bad ada@example.com 240406012 Bearer abc.def')).toBe('bad [email] [matric] Bearer [token]')
    expect(scrubForLog('x'.repeat(900))).toHaveLength(500)
  })
})

describe('logError', () => {
  it('writes a scrubbed row and ignores duplicates within the same minute', async () => {
    const client = fakeClient()
    await logError(client, 'send-broadcast', new Error('failed for ada@example.com'), 502, 120_000)
    expect(client.calls).toHaveLength(1)
    const [table, row, opts] = client.calls[0]
    expect(table).toBe('error_log')
    expect(row).toEqual({ route: 'send-broadcast', status: 502, message: 'failed for [email]', bucket: 2 })
    expect(opts).toEqual({ onConflict: 'route,message,bucket', ignoreDuplicates: true })
  })
  it('accepts plain strings and objects with a message', async () => {
    const client = fakeClient()
    await logError(client, 'r', 'plain text', undefined, 60_000)
    await logError(client, 'r', { message: 'from object' }, 500, 60_000)
    expect(client.calls[0][1].message).toBe('plain text')
    expect(client.calls[1][1].message).toBe('from object')
  })
  it('never throws, even if the database write fails', async () => {
    await expect(logError(fakeClient({ failInsert: true }), 'r', new Error('x'), 500)).resolves.toBe(false)
    await expect(logError(null, 'r', new Error('x'), 500)).resolves.toBe(false)
  })
  it('reports whether the row was written', async () => {
    await expect(logError(fakeClient(), 'r', new Error('x'), 500)).resolves.toBe(true)
    const rejecting = { from: () => ({ upsert: async () => ({ error: { message: 'denied' } }) }) }
    await expect(logError(rejecting, 'r', new Error('x'), 500)).resolves.toBe(false)
  })
})
