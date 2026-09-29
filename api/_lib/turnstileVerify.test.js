import { describe, it, expect } from 'vitest'
import { verifyTurnstile } from './turnstileVerify.js'

const okFetch = (success) => async (url, opts) => ({ ok: true, json: async () => ({ success }), _url: url, _opts: opts })

describe('verifyTurnstile', () => {
  it('is true when Cloudflare confirms the token', async () => {
    let seen
    const fetchImpl = async (url, opts) => { seen = { url, opts }; return { ok: true, json: async () => ({ success: true }) } }
    expect(await verifyTurnstile({ token: 'tok', secret: 'sec', ip: '1.2.3.4', fetchImpl })).toBe(true)
    expect(seen.url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
    expect(seen.opts.body.get('secret')).toBe('sec')
    expect(seen.opts.body.get('response')).toBe('tok')
    expect(seen.opts.body.get('remoteip')).toBe('1.2.3.4')
  })
  it('is false when Cloudflare rejects the token', async () => {
    expect(await verifyTurnstile({ token: 'tok', secret: 'sec', fetchImpl: okFetch(false) })).toBe(false)
  })
  it('is false without calling Cloudflare when the token or secret is missing', async () => {
    const fetchImpl = async () => { throw new Error('should not be called') }
    expect(await verifyTurnstile({ token: '', secret: 'sec', fetchImpl })).toBe(false)
    expect(await verifyTurnstile({ token: 'tok', secret: '', fetchImpl })).toBe(false)
    expect(await verifyTurnstile({ token: 'x'.repeat(3000), secret: 'sec', fetchImpl })).toBe(false)
  })
  it('is false when Cloudflare cannot be reached', async () => {
    const fetchImpl = async () => { throw new Error('network') }
    expect(await verifyTurnstile({ token: 'tok', secret: 'sec', fetchImpl })).toBe(false)
    expect(await verifyTurnstile({ token: 'tok', secret: 'sec', fetchImpl: async () => ({ ok: false }) })).toBe(false)
  })
})
