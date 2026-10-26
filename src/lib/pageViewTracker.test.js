import { describe, expect, it, vi } from 'vitest'
import {
  VISITOR_KEY,
  newVisitorId,
  normalisePath,
  optedOutOfTracking,
  readVisitor,
  referrerHost,
  shouldTrack,
} from './pageViewTracker'

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    dump: () => Object.fromEntries(map),
  }
}

describe('shouldTrack', () => {
  it('skips the admin area, the API and the quiz clients', () => {
    expect(shouldTrack('/admin')).toBe(false)
    expect(shouldTrack('/admin/analytics')).toBe(false)
    expect(shouldTrack('/api/system')).toBe(false)
    expect(shouldTrack('/play')).toBe(false)
    expect(shouldTrack('/play/low')).toBe(false)
  })

  it('tracks public pages, including one whose name merely starts with a skipped prefix', () => {
    expect(shouldTrack('/')).toBe(true)
    expect(shouldTrack('/news/scholarship-night')).toBe(true)
    expect(shouldTrack('/administrator')).toBe(true)
    expect(shouldTrack('/playground')).toBe(true)
  })

  it('applies the same rules to a path with a query string', () => {
    expect(shouldTrack('/news?utm_source=x')).toBe(true)
    expect(normalisePath('/news?utm_source=x')).toBe('/news')
  })
})

describe('referrerHost', () => {
  it('keeps the host and drops the path', () => {
    expect(referrerHost('https://www.google.com/search?q=nammes', 'https://hub.nammes.org')).toBe(
      'www.google.com'
    )
  })

  it('ignores an internal referrer and anything unparseable', () => {
    expect(referrerHost('https://hub.nammes.org/news', 'https://hub.nammes.org')).toBeNull()
    expect(referrerHost('', 'https://hub.nammes.org')).toBeNull()
    expect(referrerHost('not a url', 'https://hub.nammes.org')).toBeNull()
  })
})

describe('readVisitor', () => {
  it('reuses the id already in this session', () => {
    const id = '0f8fad5b-d9cb-469f-a165-70867728950e'
    const storage = fakeStorage({ [VISITOR_KEY]: id })
    expect(readVisitor(storage, () => 'should-not-be-used')).toBe(id)
  })

  it('creates and stores one when there is none', () => {
    const storage = fakeStorage()
    const id = readVisitor(storage)
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(storage.dump()[VISITOR_KEY]).toBe(id)
  })

  it('replaces a malformed stored value', () => {
    const storage = fakeStorage({ [VISITOR_KEY]: 'not-a-uuid' })
    const fresh = '0f8fad5b-d9cb-469f-a165-70867728950f'
    expect(readVisitor(storage, () => fresh)).toBe(fresh)
  })

  it('generates an id in memory when storage throws', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(readVisitor(storage, () => 'fallback-id')).toBe('fallback-id')
  })
})

describe('newVisitorId', () => {
  it('produces a valid uuid even when randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {})
    try {
      expect(newVisitorId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('optedOutOfTracking', () => {
  it('honours both signals and treats "0" as consent', () => {
    expect(optedOutOfTracking({ doNotTrack: '1' })).toBe(true)
    expect(optedOutOfTracking({ doNotTrack: 'yes' })).toBe(true)
    expect(optedOutOfTracking({ doNotTrack: '0' })).toBe(false)
    expect(optedOutOfTracking({ globalPrivacyControl: true })).toBe(true)
    expect(optedOutOfTracking(null)).toBe(false)
  })
})
