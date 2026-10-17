import { describe, it, expect } from 'vitest'
import account from '../account.js'
import system from '../system.js'

function fakeRes() {
  const res = { statusCode: null, body: null }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (body) => { res.body = body; return res }
  res.type = (t) => { res.contentType = t; return res }
  res.send = (body) => { res.body = body; return res }
  res.redirect = (status, location) => { res.redirected = { status, location }; return res }
  res.setHeader = () => {}
  return res
}

describe('shared function routers', () => {
  it('return 404 for an unknown or missing action', () => {
    for (const router of [account, system]) {
      for (const query of [{}, { action: 'nope' }, { action: '__proto__' }]) {
        const res = fakeRes()
        router({ query, method: 'POST', headers: {} }, res)
        expect(res.statusCode).toBe(404)
      }
    }
  })

  it('send a known action to its handler', async () => {
    const res = fakeRes()
    await account({ query: { action: 'disable-user' }, method: 'GET', headers: {} }, res)
    expect(res.statusCode).toBe(405)
  })

  // og is the one action that has to be built rather than imported ready-made: og.js's default export is the handler,
  // so importing that and calling it would fire a request-less handler and leave a rejected promise in the map. The
  // symptom was a 404 for every preview and an unhandled rejection the router tests never looked at.
  it('dispatch og to a real handler rather than to whatever the import produced', async () => {
    const res = fakeRes()
    await system({ query: { action: 'og', type: 'join' }, method: 'GET', headers: {} }, res)
    expect(res.statusCode).toBe(200)
    expect(String(res.body)).toContain('og:title')
  })
})
