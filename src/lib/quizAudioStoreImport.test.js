import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { createAudioStore } from './quizAudioStore'

// The import path as the browser runs it: the real probe, the real object URLs and the real store, with only the audio
// element faked. The other store tests inject a probe, so they pass whether the default one works or not, which is
// exactly how an import could be broken in the app and still green in the suite.

// A stand-in for the browser's database, enough for the store to open, put, get and delete. Only the probe and the
// object URLs below are the real code under test here.
function fakeIndexedDB() {
  const rows = new Map()
  const later = (fn) => queueMicrotask(fn)
  const db = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => {},
    transaction() {
      const tx = { oncomplete: null, onerror: null, onabort: null }
      tx.objectStore = () => ({
        put(record) {
          rows.set(record.id, record)
        },
        delete(id) {
          rows.delete(id)
        },
        get(id) {
          const request = {}
          later(() => {
            request.result = rows.get(id) ?? null
            request.onsuccess?.()
          })
          return request
        },
        openCursor() {
          const request = {}
          const all = [...rows.values()]
          let i = 0
          const step = () => {
            if (i >= all.length) {
              request.result = null
              request.onsuccess?.()
              return
            }
            const value = all[i]
            i += 1
            request.result = { value, continue: () => later(step) }
            request.onsuccess?.()
          }
          later(step)
          return request
        },
      })
      later(() => tx.oncomplete?.())
      return tx
    },
  }
  return {
    open() {
      const request = {}
      later(() => {
        request.result = db
        request.onupgradeneeded?.()
        request.onsuccess?.()
      })
      return request
    },
  }
}

let store
let revoked
let createOkUrl

beforeAll(() => {
  // An audio element that behaves like a browser's for metadata: it reports a length for a readable source and an error
  // for one it cannot play. Which of the two is decided by the address, so a test can ask for either.
  class FakeAudio {
    constructor() {
      this.preload = ''
      this.loop = false
      this.volume = 1
      this.onloadedmetadata = null
      this.onerror = null
      this.pause = () => {}
      this.play = () => Promise.resolve()
      this.load = () => {}
      this.removeAttribute = () => {}
    }

    set src(value) {
      this._src = value
      const ok = String(value).startsWith('blob:ok')
      queueMicrotask(() => (ok ? this.onloadedmetadata?.({ target: this }) : this.onerror?.()))
    }

    get src() {
      return this._src
    }

    get duration() {
      return 2.5
    }
  }
  globalThis.Audio = FakeAudio
  let made = 0
  revoked = []
  // One factory for every address, so a test can ask for a readable one or an unreadable one without leaving either
  // behind for the next test.
  createOkUrl = () => { made += 1; return `blob:ok/${made}` }
  globalThis.URL.createObjectURL = createOkUrl
  globalThis.URL.revokeObjectURL = (url) => revoked.push(url)
})

beforeEach(() => {
  // A fresh store per test, built with the real probe and the real object URLs and only the database faked.
  store = createAudioStore({ idb: fakeIndexedDB() })
})

const GOOD = { name: 'Air Horn.mp3', type: 'audio/mpeg', size: 40000 }
const BAD_TYPE = { name: 'notes.txt', type: 'text/plain', size: 100 }
const NO_TYPE = { name: 'Cheer.wav', type: '', size: 20000 }
const UNPLAYABLE = { name: 'Broken.mp3', type: 'audio/mpeg', size: 20000 }

describe('importing through the real probe', () => {
  it('keeps a file the browser can actually load', async () => {
    const saved = await store.save(GOOD, 'effect')
    expect(saved, JSON.stringify(saved)).toMatchObject({ ok: true })
    expect(saved.clip).toMatchObject({ name: 'Air Horn.mp3', kind: 'effect', type: 'audio/mpeg' })
    expect(saved.clip.id).toMatch(/^[a-z0-9-]{8,40}$/)
  })
  it('reports the length it measured, so the panel can show it', async () => {
    const saved = await store.save(GOOD, 'effect')
    expect(saved.clip.seconds).toBeCloseTo(2.5, 1)
    const listed = await store.list()
    expect(listed.clips.at(0).seconds).toBeCloseTo(2.5, 1)
  })
  it('takes a file with no reported type from its extension, because the probe is the real check', async () => {
    const saved = await store.save(NO_TYPE, 'effect')
    expect(saved, JSON.stringify(saved)).toMatchObject({ ok: true })
    expect(saved.clip.type).toBe('audio/wav')
  })
  it('refuses a file that is not audio at all', async () => {
    expect(await store.save(BAD_TYPE, 'effect')).toEqual({ ok: false, reason: 'type' })
  })
  it('refuses a file the browser cannot play, rather than storing it to be found mid-game', async () => {
    // The fake element reports an error for anything that is not an 'ok' address, which stands in for an undecodable file.
    globalThis.URL.createObjectURL = () => 'blob:broken/1'
    try {
      const broken = createAudioStore({ idb: fakeIndexedDB() })
      expect(await broken.save(UNPLAYABLE, 'effect')).toEqual({ ok: false, reason: 'type' })
      expect((await broken.list()).clips).toEqual([])
    } finally {
      globalThis.URL.createObjectURL = createOkUrl
    }
  })
  it('frees the address it made to measure with', async () => {
    // Every probe makes an object URL and must hand it back, or a long lab session leaks one per attempt.
    const before = revoked.length
    await store.save(GOOD, 'effect')
    expect(revoked.length).toBeGreaterThan(before)
  })
  it('hands back the file it was given as the blob, so the engine can decode it', async () => {
    const saved = await store.save(GOOD, 'effect')
    const record = await store.get(saved.clip.id)
    expect(record.blob).toBe(GOOD)
  })
  it('hands out a streamable address for a stored clip', async () => {
    const saved = await store.save(GOOD, 'effect')
    expect(await store.url(saved.clip.id)).toMatch(/^blob:/)
  })
  it('imports several files in a row, as choosing more than one does', async () => {
    const results = []
    for (const file of [GOOD, { ...GOOD, name: 'Boing.mp3' }, NO_TYPE]) results.push(await store.save(file, 'effect'))
    expect(results.map((r) => r.ok)).toEqual([true, true, true])
    expect((await store.list()).clips).toHaveLength(3)
  })
  it('stops measuring a file it is about to refuse for being too big', async () => {
    let probed = 0
    const original = globalThis.Audio
    class Counting extends original {
      constructor() {
        super()
        probed += 1
      }
    }
    globalThis.Audio = Counting
    const store2 = createAudioStore({ idb: fakeIndexedDB() })
    expect(await store2.save({ ...GOOD, size: 40 * 1024 * 1024 }, 'effect')).toEqual({ ok: false, reason: 'size' })
    expect(probed).toBe(0)
    globalThis.Audio = original
  })
})