import { describe, it, expect } from 'vitest'
import account from '../account.js'
import system from '../system.js'

function fakeRes() {
  const res = { statusCode: null, body: null }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (body) => { res.body = body; return res }
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
})
