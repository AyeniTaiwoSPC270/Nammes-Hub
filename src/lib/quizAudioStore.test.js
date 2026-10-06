import { describe, it, expect } from 'vitest'
import {
  createAudioStore,
  checkImport,
  newClipId,
  isAudioType,
  audioTypeOf,
  isClipKind,
  limitFor,
  limitSummary,
  formatSeconds,
  formatBytes,
  LIMITS,
  REFUSALS,
} from './quizAudioStore'

// A stand-in for the browser's IndexedDB: just enough of open/transaction/objectStore for the library to run against,
// with everything deferred to a microtask the way the real one defers to an event loop turn.
function fakeIndexedDB({ rows = new Map(), fail = false } = {}) {
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
      later(() => (fail ? tx.onerror?.() : tx.oncomplete?.()))
      return tx
    },
  }
  return {
    open() {
      const request = {}
      later(() => {
        if (fail) {
          request.onerror?.()
          return
        }
        request.result = db
        request.onupgradeneeded?.()
        request.onsuccess?.()
      })
      return request
    },
  }
}

const MP3 = { name: 'Air Horn.mp3', type: 'audio/mpeg', size: 40000 }

// The store is built with everything the browser owns handed in, so nothing here touches IndexedDB, an Audio element,
// an object URL or the storage quota for real.
function testStore(options = {}) {
  const urls = new Map()
  const made = []
  const store = createAudioStore({
    idb: fakeIndexedDB(),
    makeUrl: (blob) => {
      const made2 = `blob:test/${made.length}`
      made.push({ made2, blob })
      urls.set(made2, blob)
      return made2
    },
    revokeUrl: (u) => urls.delete(u),
    probe: () => Promise.resolve(1.2),
    random: () => 0,
    ...options,
  })
  return { store, urls, made }
}

describe('what may be imported', () => {
  it('takes the audio formats browsers can actually play', () => {
    for (const good of ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4', 'AUDIO/OGG']) expect(isAudioType(good), good).toBe(true)
    for (const bad of ['video/mp4', 'text/plain', 'audio/aac', '', null, 42, undefined]) expect(isAudioType(bad), String(bad)).toBe(false)
  })
  it('falls back to the extension when the system reports no useful type, since the probe is the real check', () => {
    expect(audioTypeOf({ name: 'Air Horn.MP3', type: '' })).toBe('audio/mpeg')
    expect(audioTypeOf({ name: 'Setlist.ogg', type: '' })).toBe('audio/ogg')
    expect(audioTypeOf({ name: 'Cheer.wav', type: '' })).toBe('audio/wav')
    expect(audioTypeOf({ name: 'Jingle.m4a', type: '' })).toBe('audio/mp4')
    // Some systems hand back a generic binary blob, and some mislabel mp3 as its own type.
    expect(audioTypeOf({ name: 'Air Horn.mp3', type: 'application/octet-stream' })).toBe('audio/mpeg')
    expect(audioTypeOf({ name: 'Air Horn.mp3', type: 'AUDIO/MP3' })).toBe('audio/mpeg')
    // An extension nobody recognises stays refused, and a real mismatch is never papered over.
    expect(audioTypeOf({ name: 'virus.exe', type: '' })).toBe('')
    expect(audioTypeOf({ name: 'Air Horn.mp3', type: 'video/mp4' })).toBe('video/mp4')
    expect(audioTypeOf(null)).toBe('')
  })
  it('separates music from effects, with a length and a size for each', () => {
    expect(limitFor('music').seconds).toBeGreaterThan(limitFor('effect').seconds)
    expect(limitFor('music').bytes).toBeGreaterThan(limitFor('effect').bytes)
    expect(limitFor('nonsense')).toEqual(limitFor('effect'))
    expect(isClipKind('music')).toBe(true)
    expect(isClipKind('effect')).toBe(true)
    expect(isClipKind('Music')).toBe(false)
    expect(isClipKind(null)).toBe(false)
  })
  it('says what it accepts, in words, before anything is picked', () => {
    const summary = limitSummary()
    expect(summary.music).toContain('15 MB')
    expect(summary.effect).toContain('1 MB')
    expect(summary.library).toContain(String(LIMITS.clips))
    expect(Object.values(REFUSALS).every(Boolean)).toBe(true)
  })
})

describe('checking an import', () => {
  const ok = { kind: 'effect', type: 'audio/mpeg', size: 40000, seconds: 2 }
  it('accepts a clip inside every limit', () => {
    expect(checkImport(ok)).toEqual({ ok: true })
    expect(checkImport({ ...ok, kind: 'music', seconds: 460, size: 15 * 1024 * 1024 - 1 })).toEqual({ ok: true })
    expect(checkImport({ ...ok, seconds: 10, size: LIMITS.effect.bytes })).toEqual({ ok: true })
  })
  it('refuses a kind it has no limits for', () => {
    for (const kind of ['nope', '', null, undefined, 5, ['effect']]) expect(checkImport({ ...ok, kind }).reason, String(kind)).toBe('kind')
  })
  it('refuses a file the browser could not play, whatever it calls itself', () => {
    // The length is what proves the browser could read it, so a file that could not be measured is a format problem
    // rather than an unknown length to wave through.
    for (const bad of [{ type: 'video/mp4' }, { type: '' }, { type: null }, { seconds: null }, { seconds: NaN }, { seconds: 0 }, { seconds: -3 }]) {
      expect(checkImport({ ...ok, ...bad }).reason, JSON.stringify(bad)).toBe('type')
    }
  })
  it('refuses a file that is too big for its kind, and judges length by the same kind', () => {
    expect(checkImport({ ...ok, size: LIMITS.effect.bytes + 1 }).reason).toBe('size')
    expect(checkImport({ ...ok, kind: 'music', size: LIMITS.music.bytes + 1, seconds: 100 }).reason).toBe('size')
    // The same 60 seconds is a perfectly good music track and far too long as an effect, because an effect has to fit
    // inside a drum roll or a sting.
    expect(checkImport({ ...ok, kind: 'music', seconds: 60, size: 5 * 1024 * 1024 }).ok).toBe(true)
    expect(checkImport({ ...ok, kind: 'effect', seconds: 60 }).reason).toBe('length')
    expect(checkImport({ ...ok, kind: 'music', seconds: 481, size: 5 * 1024 * 1024 }).reason).toBe('length')
    expect(checkImport({ ...ok, seconds: LIMITS.effect.seconds + 0.5 }).reason).toBe('length')
    expect(checkImport({ ...ok, seconds: LIMITS.effect.seconds }).ok).toBe(true)
    expect(checkImport({ ...ok, size: 0 }).reason).toBe('size')
    expect(checkImport({ ...ok, size: NaN }).reason).toBe('size')
  })
  it('refuses once the library is full, by count or by space', () => {
    expect(checkImport({ ...ok, clips: LIMITS.clips }).reason).toBe('too-many')
    expect(checkImport({ ...ok, clips: LIMITS.clips - 1 }).ok).toBe(true)
    expect(checkImport({ ...ok, totalBytes: LIMITS.totalBytes }).reason).toBe('full')
    expect(checkImport({ ...ok, totalBytes: LIMITS.totalBytes - ok.size }).ok).toBe(true)
  })
  it('refuses nothing in at all, rather than throwing on it', () => {
    expect(() => checkImport()).not.toThrow()
    expect(checkImport().reason).toBe('kind')
  })
})

describe('a clip id', () => {
  it('is short, lowercase and only letters, digits and dashes, so it can only ever be a library key', () => {
    // The same shape quizTheme.js accepts, because the id is what a saved theme stores.
    expect(/^[a-z0-9-]{8,40}$/.test(newClipId())).toBe(true)
    expect(newClipId(() => 0)).toBe('000000000000-000000000000')
    expect(newClipId(() => 0.999999)).toBe('zzzzzzzzzzzz-zzzzzzzzzzzz')
  })
  it('does not run out of characters on an unlucky random source', () => {
    expect(/^[a-z0-9-]{8,40}$/.test(newClipId(() => 1))).toBe(true)
    expect(new Set(Array.from({ length: 50 }, () => newClipId())).size).toBe(50)
  })
})

describe('the local library', () => {
  it('stores a clip and hands it back without its audio attached to anything renderable', async () => {
    const { store } = testStore()
    expect(store.isAvailable()).toBe(true)
    const saved = await store.save(MP3, 'effect')
    expect(saved.ok).toBe(true)
    expect(saved.clip).toMatchObject({ name: 'Air Horn.mp3', kind: 'effect', type: 'audio/mpeg', size: 40000, seconds: 1.2 })
    expect(saved.clip).not.toHaveProperty('blob')
    expect(saved.clip.id).toBe('000000000000-000000000000')

    const listed = await store.list()
    expect(listed.ok).toBe(true)
    expect(listed.clips).toHaveLength(1)
    expect(listed.clips[0]).not.toHaveProperty('blob')
  })
  it('newest first, and counts what it holds', async () => {
    const rows = new Map([
      ['aaa', { id: 'aaa', name: 'Old', kind: 'music', type: 'audio/mpeg', size: 10, seconds: 1, createdAt: 100 }],
      ['bbb', { id: 'bbb', name: 'New', kind: 'effect', type: 'audio/ogg', size: 20, seconds: 2, createdAt: 200 }],
    ])
    const { store } = testStore({ idb: fakeIndexedDB({ rows }) })
    expect((await store.list()).clips.map((c) => c.name)).toEqual(['New', 'Old'])
    expect(await store.usage()).toEqual({ ok: true, clips: 2, bytes: 30 })
  })
  it('reads one clip back whole, audio and all, for the engine to decode', async () => {
    const { store } = testStore()
    const saved = await store.save(MP3, 'effect')
    const record = await store.get(saved.clip.id)
    expect(record.blob).toBe(MP3)
    expect(await store.get('not-a-clip')).toBeNull()
    expect(await store.get(null)).toBeNull()
  })
  it('makes one address per clip for streaming, and keeps it until the clip is deleted', async () => {
    const { store, urls } = testStore()
    const saved = await store.save(MP3, 'effect')
    const first = await store.url(saved.clip.id)
    expect(first).toMatch(/^blob:/)
    expect(await store.url(saved.clip.id)).toBe(first)
    expect(urls.size).toBe(1)
    expect(await store.url('not-a-clip')).toBeNull()
  })
  it('takes a clip out for good, audio and address with it', async () => {
    const { store, urls } = testStore()
    const saved = await store.save(MP3, 'effect')
    const address = await store.url(saved.clip.id)
    expect(await store.remove(saved.clip.id)).toEqual({ ok: true })
    expect((await store.list()).clips).toEqual([])
    expect(await store.get(saved.clip.id)).toBeNull()
    expect(urls.has(address)).toBe(false)
  })
  it('checks every limit before writing anything, so a refused import leaves nothing behind', async () => {
    const rows = new Map(Array.from({ length: LIMITS.clips }, (_, i) => [`clip${i}`, { id: `clip${i}`, kind: 'effect', size: 1, createdAt: i }]))
    const { store } = testStore({ idb: fakeIndexedDB({ rows }) })
    const saved = await store.save(MP3, 'effect')
    expect(saved).toEqual({ ok: false, reason: 'too-many' })
    expect(rows.size).toBe(LIMITS.clips)
    // The same clip is accepted the moment there is room, so the refusal was the limit and not a broken store.
    rows.delete('clip0')
    expect((await store.save(MP3, 'effect')).ok).toBe(true)
  })
  it('refuses by the browser measure rather than by what the file calls itself', async () => {
    const rows = new Map()
    const { store } = testStore({ idb: fakeIndexedDB({ rows }), probe: () => Promise.resolve(null) })
    const saved = await store.save({ ...MP3, type: 'audio/mpeg' }, 'effect')
    expect(saved).toEqual({ ok: false, reason: 'type' })
    expect(rows.size).toBe(0)
  })
  it('asks the browser to keep the library once, and only once something is safely stored', async () => {
    const asked = []
    const { store } = testStore({ storage: { persist: () => { asked.push(1); return Promise.resolve(true) } } })
    expect(await store.askToPersist()).toBe(true)
    // Asked once and never again: another tab or another quiz must not keep asking.
    expect(await store.askToPersist()).toBe(false)
    expect(asked).toHaveLength(1)
    await store.save(MP3, 'effect')
    expect(asked).toHaveLength(1)
  })
  it('is not put off by a browser that says no, or cannot be asked', async () => {
    const refused = testStore({ storage: { persist: () => Promise.resolve(false) } })
    expect(await refused.store.askToPersist()).toBe(false)
    const broken = testStore({ storage: { persist: () => Promise.reject(new Error('denied')) } })
    expect(await broken.store.askToPersist()).toBe(false)
    const missing = testStore({ storage: {} })
    expect(await missing.store.askToPersist()).toBe(false)
    // None of them stops an import.
    expect((await refused.store.save(MP3, 'effect')).ok).toBe(true)
  })
  it('cleans a file name of anything that is not plain text', async () => {
    const { store } = testStore()
    const saved = await store.save({ ...MP3, name: `  Set\u0000list\u007f\n  .mp3  ` }, 'music')
    expect(saved.clip.name).toBe('Setlist .mp3')
    expect((await store.save({ ...MP3, name: '   ' }, 'music')).clip.name).toBe('Imported clip')
  })
})

describe('a browser with no library to keep', () => {
  it('reports itself unavailable and answers every call without throwing', async () => {
    const store = createAudioStore({ idb: null, probe: () => Promise.resolve(1) })
    expect(store.isAvailable()).toBe(false)
    expect(await store.list()).toEqual({ ok: false, reason: 'unavailable' })
    expect(await store.usage()).toEqual({ ok: false, reason: 'unavailable' })
    expect(await store.get('abc12345')).toBeNull()
    expect(await store.url('abc12345')).toBeNull()
    expect(await store.remove('abc12345')).toEqual({ ok: false, reason: 'unavailable' })
    expect(await store.save(MP3, 'effect')).toEqual({ ok: false, reason: 'unavailable' })
  })
  it('reports itself unavailable when the database refuses to open at all', async () => {
    const store = createAudioStore({ idb: fakeIndexedDB({ fail: true }), probe: () => Promise.resolve(1) })
    expect(await store.list()).toEqual({ ok: false, reason: 'unavailable' })
    expect(await store.save(MP3, 'effect')).toEqual({ ok: false, reason: 'unavailable' })
    expect(store.isAvailable()).toBe(false)
  })
  it('reports itself unavailable when opening the database throws rather than answering', async () => {
    const store = createAudioStore({
      idb: {
        open() {
          throw new Error('blocked')
        },
      },
      probe: () => Promise.resolve(1),
    })
    expect(await store.list()).toEqual({ ok: false, reason: 'unavailable' })
  })
  it('refuses a file too big for its kind before loading it into an audio element', async () => {
    let probed = 0
    const rows = new Map()
    const { store } = testStore({ idb: fakeIndexedDB({ rows }), probe: () => { probed += 1; return Promise.resolve(1.2) } })
    const huge = { name: 'Concert.wav', type: 'audio/wav', size: 40 * 1024 * 1024 }
    expect(await store.save(huge, 'music')).toEqual({ ok: false, reason: 'size' })
    expect(probed).toBe(0)
    expect(rows.size).toBe(0)
    // The same file is fine as an effect? No: an effect's own ceiling is smaller still.
    expect((await store.save(huge, 'effect')).reason).toBe('size')
    expect(probed).toBe(0)
  })
  it('refuses a file that is not a file at all, before it goes near the library', async () => {
    const { store } = testStore()
    for (const bad of [null, undefined, {}, { size: 10 }]) expect((await store.save(bad, 'effect')).ok, String(bad)).toBe(false)
  })
})

describe('saying what a clip is', () => {
  it('shows a length and a size the way a person would say them', () => {
    expect(formatSeconds(0)).toBe('0:00')
    expect(formatSeconds(4.2)).toBe('0:04')
    expect(formatSeconds(65)).toBe('1:05')
    expect(formatSeconds(480)).toBe('8:00')
    expect(formatSeconds(-1)).toBe('0:00')
    expect(formatSeconds(NaN)).toBe('0:00')
    expect(formatBytes(0)).toBe('0 KB')
    expect(formatBytes(900)).toBe('1 KB')
    expect(formatBytes(40000)).toBe('39 KB')
    expect(formatBytes(12 * 1024 * 1024)).toBe('12.0 MB')
  })
})