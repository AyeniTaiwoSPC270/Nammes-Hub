import { describe, expect, it, beforeEach, vi } from 'vitest'
import { storeKey, readStore, writeStore, forgetSession, rememberNickname, knownNicknames, STORAGE_KEY } from './quizPlayerStorage'

// A localStorage that can be made hostile, because two of these behaviours only exist in the failure path: private
// mode, and a device that has played far more games than the server still has rows for.
//
// A Proxy, because the module trims rooms with Object.keys(localStorage) -- a real Storage exposes its contents as
// indexed properties, and a plain object of methods would hand that back a list of function names instead. The trim is
// the one part of this module that touches the storage shape rather than one key, so it is worth faking faithfully.
function fakeLocalStorage({ throws = false } = {}) {
  const data = new Map()
  const guard = (fn) => (...args) => {
    if (throws) throw new Error('denied')
    return fn(...args)
  }
  const target = {
    getItem: guard((k) => (data.has(k) ? data.get(k) : null)),
    setItem: guard((k, v) => data.set(k, String(v))),
    removeItem: guard((k) => data.delete(k)),
    clear: guard(() => data.clear()),
  }
  const store = new Proxy(target, {
    get(t, prop) {
      if (typeof prop === 'string' && !(prop in t)) return data.get(prop) ?? null
      if (prop === 'key') return (i) => [...data.keys()][i] ?? null
      if (prop === 'length') return data.size
      return Reflect.get(t, prop)
    },
    has: (t, prop) => (typeof prop === 'string' ? data.has(prop) || prop in t : Reflect.has(t, prop)),
    ownKeys: () => [...data.keys()],
    getOwnPropertyDescriptor: (t, prop) =>
      (typeof prop === 'string' && data.has(prop) ? { value: data.get(prop), enumerable: true, configurable: true } : Reflect.getOwnPropertyDescriptor(t, prop)),
  })
  store._keys = () => [...data.keys()]
  return store
}

function withStorage(options) {
  const ls = fakeLocalStorage(options)
  vi.stubGlobal('localStorage', ls)
  return ls
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('quiz player storage', () => {
  it('keeps a token across a reload and finds it by the code the URL carries', () => {
    withStorage()
    const saved = { token: 't-1', sessionId: 's-1', code: '123456', nickname: 'Ada' }
    writeStore(storeKey('123456'), saved)
    expect(readStore(storeKey('123456'))).toEqual(saved)
  })

  // The browser cannot know the session id until it has already joined, so keying on it would mean never finding the
  // token on the one occasion it matters: the reload.
  it('keys by the join code rather than the session id', () => {
    expect(storeKey('123456')).toBe(`${STORAGE_KEY}:123456`)
  })

  it('keeps rooms apart, so joining a second game does not cost the first its seat', () => {
    withStorage()
    writeStore(storeKey('111111'), { token: 'a', nickname: 'Ada' })
    writeStore(storeKey('222222'), { token: 'b', nickname: 'Grace' })
    expect(readStore(storeKey('111111')).token).toBe('a')
    expect(readStore(storeKey('222222')).token).toBe('b')
  })

  it('prunes a finished room so a dead token is not carried forever', () => {
    withStorage()
    writeStore(storeKey('123456'), { token: 't-1' })
    forgetSession('123456')
    expect(readStore(storeKey('123456'))).toBeNull()
  })

  it('survives private mode instead of breaking the page', () => {
    withStorage({ throws: true })
    expect(() => writeStore(storeKey('123456'), { token: 't-1' })).not.toThrow()
    expect(readStore(storeKey('123456'))).toBeNull()
    expect(() => forgetSession('123456')).not.toThrow()
    expect(() => rememberNickname('Ada')).not.toThrow()
    expect(knownNicknames()).toEqual([])
  })

  // A malformed entry must read as nothing. Handing a mangled token to the server turns a resume into a 409, which is
  // the exact confusion this module exists to remove.
  it('treats an entry with no usable token as absent', () => {
    const ls = withStorage()
    for (const junk of ['', 'not json', '{}', '[]', 'null', JSON.stringify({ token: '' }), JSON.stringify({ token: 7 })]) {
      ls.setItem(storeKey('123456'), junk)
      expect(readStore(storeKey('123456')), junk).toBeNull()
    }
  })

  it('prefills the last nickname, newest first, without repeats of any case', () => {
    withStorage()
    rememberNickname('Ada')
    rememberNickname('Grace')
    rememberNickname('ada')
    expect(knownNicknames()).toEqual(['ada', 'Grace'])
  })

  it('caps the nickname index so a shared phone cannot grow it without bound', () => {
    withStorage()
    for (let i = 0; i < 20; i += 1) rememberNickname(`player-${i}`)
    expect(knownNicknames()).toHaveLength(6)
    expect(knownNicknames()[0]).toBe('player-19')
  })

  it('keeps twelve recent rooms and drops the rest when a device has played far too many', () => {
    const ls = withStorage()
    for (let i = 0; i < 40; i += 1) writeStore(storeKey(`code-${i}`), { token: `t-${i}` })
forgetSession('code-39')
    const left = ls._keys().filter((k) => k !== `${STORAGE_KEY}:index`)
    // 40 rooms written, this one forgotten, the oldest 27 dropped: 12 survive.
    expect(left).toHaveLength(12)
    expect(readStore(storeKey('code-39'))).toBeNull()
    // The survivors are the recent ones -- the room just forgotten is the newest, so the trim is what did the rest.
    expect(readStore(storeKey('code-38'))).not.toBeNull()
    expect(readStore(storeKey('code-27'))).not.toBeNull()
    expect(readStore(storeKey('code-26'))).toBeNull()
    expect(readStore(storeKey('code-0'))).toBeNull()
    // The nickname index is never a casualty of the room trim.
    rememberNickname('Ada')
    expect(knownNicknames()).toEqual(['Ada'])
  })

  it('leaves a normal device alone rather than trimming on every join', () => {
    const ls = withStorage()
    for (let i = 0; i < 8; i += 1) writeStore(storeKey(`code-${i}`), { token: `t-${i}` })
    forgetSession('code-0')
    expect(ls._keys()).toHaveLength(7)
  })
})