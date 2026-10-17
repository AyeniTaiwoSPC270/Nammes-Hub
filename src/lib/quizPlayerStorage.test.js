import { describe, expect, it, beforeEach, vi } from 'vitest'
import { storeKey, readStore, writeStore, forgetSession, forgetSeat, finishSeat, rememberNickname, knownNicknames, rememberedSeats, stampSeat, STORAGE_KEY } from './quizPlayerStorage'

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
describe('rememberedSeats', () => {
it('lists the rooms this device still holds a seat in, newest first', () => {
    withStorage()
    // Fake timers because two joins in the same millisecond are indistinguishable by timestamp, and the point of the
    // ordering is that the room a student is in right now is the one at the top. The base is a realistic instant rather
    // than an arbitrary one: seats are aged out after a day, so a clock near the epoch reads as ancient.
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-10-17T12:00:00Z'))
      writeStore(storeKey('111111'), stampSeat({ token: 'a', code: '111111', nickname: 'Ada' }))
      vi.setSystemTime(new Date('2026-10-17T12:00:30Z'))
      writeStore(storeKey('222222'), stampSeat({ token: 'b', code: '222222', nickname: 'Bisi' }))
    } finally {
      vi.useRealTimers()
    }
    const seats = rememberedSeats()
    expect(seats.map((s) => s.code)).toEqual(['222222', '111111'])
    expect(seats[0].nickname).toBe('Bisi')
  })

  it('recovers the code from the key when the record itself never stored one', () => {
    // A record written by an older build has no `code`, and the key it lives under IS the code.
    withStorage()
    writeStore(storeKey('654321'), stampSeat({ token: 'tok' }))
    expect(rememberedSeats()[0].code).toBe('654321')
  })

  it('skips a record with no usable token rather than offering a dead seat', () => {
    // The nickname index is stored under the same prefix and is not a room; a half-written record is not a seat.
    withStorage()
    rememberNickname('Ada')
    writeStore(storeKey('999999'), { nickname: 'NoToken' })
    expect(rememberedSeats()).toEqual([])
  })

  it('still lists a record written before timestamps existed', () => {
    withStorage()
    writeStore(storeKey('333333'), { token: 'tok', code: '333333', nickname: 'Cee' })
    expect(rememberedSeats().map((s) => s.code)).toEqual(['333333'])
  })

it('is empty, not a crash, when storage is unavailable', () => {
    withStorage({ throws: true })
    expect(rememberedSeats()).toEqual([])
  })

  it('drops a seat from another day, which no longer has a game behind it', () => {
    // quiz-join excludes `state = 'finished'`, so a dead room on this list is a button that cannot work -- and a list
    // of those teaches a student to stop trusting the one thing meant to help them. The day cutoff is the backstop for
    // a game the phone never saw end; `finishSeat` is the precise signal.
    withStorage()
    const now = 10 * 24 * 60 * 60 * 1000
    writeStore(storeKey('111111'), { token: 'a', code: '111111', nickname: 'Ada', at: now - 60_000 })
    writeStore(storeKey('222222'), { token: 'b', code: '222222', nickname: 'Bisi', at: now - 3 * 24 * 60 * 60 * 1000 })
    expect(rememberedSeats({ now }).map((s) => s.code)).toEqual(['111111'])
  })

  it('stops offering a game the phone watched finish, while the other rooms stay', () => {
    // Three finished games used to sit above the code box until they aged out a day later, each one a button that
    // answers "No game found with that code".
    withStorage()
    writeStore(storeKey('111111'), stampSeat({ token: 'a', code: '111111', nickname: 'Ada' }))
    writeStore(storeKey('222222'), stampSeat({ token: 'b', code: '222222', nickname: 'Bisi' }))
    finishSeat('111111')
    expect(rememberedSeats().map((s) => s.code)).toEqual(['222222'])
  })

  it('flags a finished seat instead of deleting it, because the result screen is drawn from its token', () => {
    // The token is still what a reload of /play?code=... uses to paint the final result and the result card. Only the
    // "back into game" button has to go.
    withStorage()
    writeStore(storeKey('111111'), stampSeat({ token: 'a', code: '111111', nickname: 'Ada' }))
    finishSeat('111111')
    expect(readStore(storeKey('111111'))).toMatchObject({ token: 'a', code: '111111', finished: true })
  })

  it('does nothing for a room this device holds no seat in', () => {
    withStorage()
    expect(() => finishSeat('999999')).not.toThrow()
    expect(readStore(storeKey('999999'))).toBeNull()
  })

  it('keeps a seat with no timestamp, because it may well be live', () => {
    // A record from a build that predates the stamp cannot be aged, and a seat is the only way back into a game. It
    // sorts last rather than disappearing.
    withStorage()
    writeStore(storeKey('333333'), { token: 'tok', code: '333333', nickname: 'Cee' })
    expect(rememberedSeats({ now: 10 * 24 * 60 * 60 * 1000 }).map((s) => s.code)).toEqual(['333333'])
  })

  it('drops one room when the server says it is gone', () => {
    withStorage()
    writeStore(storeKey('111111'), stampSeat({ token: 'a', code: '111111' }))
    writeStore(storeKey('222222'), stampSeat({ token: 'b', code: '222222' }))
    forgetSeat('111111')
    expect(readStore(storeKey('111111'))).toBeNull()
    expect(readStore(storeKey('222222'))).not.toBeNull()
  })
})
