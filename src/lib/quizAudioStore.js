// Audio the admin imported on this computer, and nothing else. There is no upload and no account for a clip: it lives in
// this browser's IndexedDB and nowhere else, so a quiz that points at one only plays it on the device that imported it.
// Nothing here may stop the game working, so every call answers with a reason instead of throwing, and a browser with
// no IndexedDB (private mode, an old one) simply reports itself unavailable.

// The clips that may be imported, and how big each may be. Music loops for a whole event, so it gets minutes and
// megabytes; an effect has to fit in a drum roll or a sting, so it gets seconds. The library cap is what stops a
// library of imports from quietly filling a phone's storage.
export const LIMITS = Object.freeze({
  music: Object.freeze({ bytes: 15 * 1024 * 1024, seconds: 8 * 60, label: 'Music' }),
  effect: Object.freeze({ bytes: 1 * 1024 * 1024, seconds: 10, label: 'Sound effect' }),
  clips: 40,
  totalBytes: 100 * 1024 * 1024,
})

// What the browser is asked to play. The type is only a first filter: a file that claims to be one of these and cannot
// actually be decoded is still refused, because a clip that will not play is worse than one that was never imported.
// WAV and M4A are listed under every name a browser reports them under, because which one arrives depends on the system
// the admin picked the file on.
export const AUDIO_TYPES = Object.freeze([
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mp4',
  'audio/x-m4a',
])

export function isAudioType(type) {
  return typeof type === 'string' && AUDIO_TYPES.includes(type.toLowerCase())
}

const EXTENSION_TYPES = { mp3: 'audio/mpeg', ogg: 'audio/ogg', oga: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4' }

// What to call a file when the system's own label is missing or unhelpful. The probe still has to be able to play it.
export function audioTypeOf(file) {
  const reported = typeof file?.type === 'string' ? file.type.toLowerCase() : ''
  if (isAudioType(reported)) return reported
  if (reported === 'audio/mp3') return 'audio/mpeg'
  if (reported === '' || reported === 'application/octet-stream') {
    const extension = String(file?.name ?? '').toLowerCase().split('.').pop()
    return EXTENSION_TYPES[extension] ?? reported
  }
  return reported
}

export function limitFor(kind) {
  return LIMITS[kind] ?? LIMITS.effect
}

// The reasons an import can be refused, in the words the import UI shows. Keeping them here means the list is tested
// rather than spelled out again in a component.
export const REFUSALS = Object.freeze({
  kind: 'That kind of file cannot be imported.',
  type: 'The browser could not play that file. Use an MP3, OGG, WAV or M4A.',
  size: 'That file is too big.',
  length: 'That file is too long.',
  'too-many': 'The library already holds as many clips as it can.',
  full: 'The library is full. Delete a clip to make room.',
})

// A clip id is a key into this library on one device, and a theme only ever stores it, so it is built to a fixed shape
// that matches what quizTheme.js accepts: lowercase letters, digits and dashes. That is why it is made from a random
// string rather than a uuid, whose length and case are not worth depending on.
export function newClipId(random = Math.random) {
  let out = ''
  // The character has to be written in base 36 explicitly: adding a number to a string would spell it in base 10, so
  // anything from 10 up would take two characters and the id could grow past the length a saved theme accepts.
  for (let i = 0; i < 24; i += 1) out += (Math.floor(random() * 36) % 36).toString(36)
  return `${out.slice(0, 12)}-${out.slice(12)}`
}

export function isClipKind(kind) {
  return kind === 'music' || kind === 'effect'
}

// Whether one file may be imported, and if not why. `seconds` is what the browser measured; null means it could not
// measure it at all, which is treated as a file it cannot play rather than as a length to skip.
export function checkImport({ kind, type, size, seconds, clips = 0, totalBytes = 0 } = {}) {
  if (!isClipKind(kind)) return { ok: false, reason: 'kind' }
  if (!isAudioType(type)) return { ok: false, reason: 'type' }
  if (!Number.isFinite(seconds) || seconds <= 0) return { ok: false, reason: 'type' }
  const limit = limitFor(kind)
  if (!Number.isFinite(size) || size <= 0 || size > limit.bytes) return { ok: false, reason: 'size' }
  if (seconds > limit.seconds) return { ok: false, reason: 'length' }
  if (clips >= LIMITS.clips) return { ok: false, reason: 'too-many' }
  if (totalBytes + size > LIMITS.totalBytes) return { ok: false, reason: 'full' }
  return { ok: true }
}

// The plain words for a limit, so the import control can say what it accepts before anything is picked.
export function limitSummary() {
  const mb = (bytes) => `${Math.round(bytes / 1024 / 1024)} MB`
  return {
    music: `Up to ${mb(LIMITS.music.bytes)} and ${LIMITS.music.seconds / 60} minutes`,
    effect: `Up to ${mb(LIMITS.effect.bytes)} and ${LIMITS.effect.seconds} seconds`,
    library: `The library holds up to ${LIMITS.clips} clips in ${mb(LIMITS.totalBytes)}`,
  }
}

export function formatSeconds(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const total = Math.round(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

// A clip as the UI and the engine want it: the blob stays out of anything rendered or saved, it is only ever read back
// to be decoded or streamed.
function toClip(record) {
  if (!record || typeof record !== 'object') return null
  const { id, name, kind, type, size, seconds, createdAt } = record
  if (typeof id !== 'string' || !isClipKind(kind)) return null
  return { id, name: typeof name === 'string' ? name : 'Imported clip', kind, type, size, seconds, createdAt }
}

const DB_NAME = 'nammes-quiz-audio'
const DB_VERSION = 1
const STORE = 'clips'
// How long to wait for the browser to report a clip's length before giving up on the file. A codec the browser cannot
// decode never fires either event, and the import must still finish rather than hang on a dialog.
const PROBE_TIMEOUT_MS = 8000

function defaultIdb() {
  try {
    return typeof indexedDB === 'undefined' ? null : indexedDB
  } catch {
    // some privacy modes throw on the very access
    return null
  }
}

function defaultObjectUrl() {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null
  return URL.createObjectURL
}

function defaultRevokeObjectUrl() {
  if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return () => {}
  return URL.revokeObjectURL
}

// Ask the browser to measure a clip by handing it to a plain audio element, which decodes far less of the file than
// decoding it into an AudioBuffer would. This is also the format check: a file the browser cannot load never fires
// loadedmetadata, so it is refused rather than stored to be discovered at the reveal.
function defaultProbe(blob, makeUrl, revokeUrl) {
  return new Promise((resolve) => {
    if (typeof Audio === 'undefined') {
      resolve(null)
      return
    }
    const url = makeUrl(blob)
    if (!url) {
      resolve(null)
      return
    }
    const audio = new Audio()
    let settled = false
    const finish = (seconds) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      audio.onloadedmetadata = null
      audio.onerror = null
      audio.removeAttribute?.('src')
      try {
        audio.load()
      } catch {
        // an element that will not even load is already answered
      }
      revokeUrl(url)
      resolve(seconds)
    }
    const timer = setTimeout(() => finish(null), PROBE_TIMEOUT_MS)
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => finish(Number.isFinite(audio.duration) ? audio.duration : null)
    audio.onerror = () => finish(null)
    audio.src = url
  })
}

// One library, in one browser. The database, the object URLs and the length probe are all injectable so the whole thing
// can be tested against a fake without a browser, and so a host that refuses to be told anything still gets an answer.
export function createAudioStore({ idb = defaultIdb(), makeUrl = defaultObjectUrl(), revokeUrl = defaultRevokeObjectUrl(), probe = defaultProbe, storage = null, random = Math.random } = {}) {
  let opening = null
  let unavailable = false
  const objectUrls = new Map()
  let askedToPersist = false

  function open() {
    if (unavailable || !idb) return Promise.resolve(null)
    if (opening) return opening
    opening = new Promise((resolve) => {
      let request
      try {
        request = idb.open(DB_NAME, DB_VERSION)
      } catch {
        unavailable = true
        resolve(null)
        return
      }
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => {
        unavailable = true
        resolve(null)
      }
      request.onblocked = () => resolve(null)
    }).then((db) => {
      if (!db) opening = null
      return db
    })
    return opening
  }

  function run(mode, work) {
    return open().then((db) => {
      if (!db) return { ok: false, reason: 'unavailable' }
      return new Promise((resolve) => {
        let transaction
        try {
          transaction = db.transaction(STORE, mode)
        } catch {
          resolve({ ok: false, reason: 'unavailable' })
          return
        }
        let settled = false
        const settle = (result) => {
          if (settled) return
          settled = true
          resolve(result)
        }
        // The work and the transaction both have to finish, and a transaction can complete before the promise the work
        // returned has been read, so the answer waits for both and takes whichever arrives last.
        let worked
        try {
          worked = Promise.resolve(work(transaction.objectStore(STORE)))
        } catch {
          settle({ ok: false, reason: 'unavailable' })
          return
        }
        const done = () => worked.then((value) => settle({ ok: true, value }), () => settle({ ok: false, reason: 'unavailable' }))
        transaction.oncomplete = done
        transaction.onerror = () => settle({ ok: false, reason: 'unavailable' })
        transaction.onabort = () => settle({ ok: false, reason: 'unavailable' })
      })
    })
  }

  // Reading the list must not drag every blob into memory just to show a name, so this goes through a cursor and drops
  // the blob from what it hands back.
  function readAll(store) {
    return new Promise((resolve) => {
      const clips = []
      const request = store.openCursor()
      request.onsuccess = () => {
        const cursor = request.result
        if (!cursor) {
          resolve(clips)
          return
        }
        const clip = toClip(cursor.value)
        if (clip) clips.push(clip)
        cursor.continue()
      }
      request.onerror = () => resolve([])
    })
  }

  // Ask the browser not to throw the library away when the device runs low on space. It can still say no, and it may
  // have already been asked by another tab, so this is asked once and never blocks an import.
  function askToPersist() {
    if (askedToPersist) return Promise.resolve(false)
    askedToPersist = true
    try {
      const quota = storage ?? (typeof navigator === 'undefined' ? null : navigator.storage)
      if (!quota || typeof quota.persist !== 'function') return Promise.resolve(false)
      return Promise.resolve(quota.persist()).then((granted) => granted === true).catch(() => false)
    } catch {
      return Promise.resolve(false)
    }
  }

  // Every clip on this device, newest first, without their audio.
  function list() {
    return run('readonly', (store) => readAll(store)).then((result) => {
      if (!result.ok) return { ok: false, reason: 'unavailable' }
      return { ok: true, clips: result.value.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)) }
    })
  }

  function usage() {
    return list().then((result) => {
      if (!result.ok) return result
      return { ok: true, clips: result.clips.length, bytes: result.clips.reduce((sum, c) => sum + (c.size ?? 0), 0) }
    })
  }

  // One clip with its audio, for the engine to decode or stream.
  function get(id) {
    if (typeof id !== 'string') return Promise.resolve(null)
    return run('readonly', (store) => new Promise((resolve) => {
      const request = store.get(id)
      request.onsuccess = () => resolve(request.result ?? null)
      request.onerror = () => resolve(null)
    })).then((result) => (result.ok ? result.value : null))
  }

  // A streamable address for a clip. Music is far too big to hold in memory once decoded, so it is played from a blob
  // URL instead, and the same URL is kept until the clip is deleted rather than made again every time it starts.
  function url(id) {
    if (objectUrls.has(id)) return Promise.resolve(objectUrls.get(id))
    return get(id).then((record) => {
      if (!record?.blob || !makeUrl) return null
      const made = makeUrl(record.blob)
      if (made) objectUrls.set(id, made)
      return made
    })
  }

  // Import one file. Every limit is checked before anything is written, so a refused import leaves no half-stored clip
  // behind and the library's own totals stay true.
  function save(file, kind) {
    if (!file || typeof file !== 'object') return Promise.resolve({ ok: false, reason: 'type' })
    const type = audioTypeOf(file)
    // Judged before the probe, so a file far too big is refused without loading it into an audio element first.
    if (file.size > limitFor(kind).bytes) return Promise.resolve({ ok: false, reason: 'size' })
    return Promise.resolve(probe(file, makeUrl, revokeUrl)).then((seconds) =>
      usage().then((current) => {
        if (!current.ok) return current
        const verdict = checkImport({
          kind,
          type,
          size: file.size,
          seconds,
          clips: current.clips,
          totalBytes: current.bytes,
        })
        if (!verdict.ok) return verdict
        const clip = {
          id: newClipId(random),
          // The file's own name is only ever shown on this device, never saved to a quiz, but it is trimmed and
          // stripped of anything that is not plain text anyway.
          // eslint-disable-next-line no-control-regex
          name: String(file.name ?? 'Imported clip').replace(/\s+/g, ' ').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 60) || 'Imported clip',
          kind,
          type,
          size: file.size,
          seconds,
          createdAt: Date.now(),
          blob: file,
        }
        return run('readwrite', (store) => {
          store.put(clip)
          return clip
        }).then((result) => {
          if (!result.ok) return result
          // Only once something is safely stored is it worth asking the browser to keep it.
          askToPersist()
          return { ok: true, clip: toClip(clip) }
        })
      }))
  }

  // Deleting a clip takes its audio with it. Any quiz still pointing at the id falls back to the built-in sound, which
  // is the whole point: a clip can go without taking a game with it.
  function remove(id) {
    const made = objectUrls.get(id)
    if (made) {
      revokeUrl(made)
      objectUrls.delete(id)
    }
    return run('readwrite', (store) => {
      store.delete(id)
    })
  }

  return {
    isAvailable: () => Boolean(idb) && !unavailable,
    list,
    usage,
    get,
    url,
    save,
    remove,
    askToPersist,
  }
}

export const quizAudio = createAudioStore()