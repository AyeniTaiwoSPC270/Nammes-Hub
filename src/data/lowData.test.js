import { describe, expect, it, beforeEach, vi } from 'vitest'
import { PLAYER_POLL_MS, PLAYER_POLL_LOW_MS, HOST_POLL_MS, HOST_POLL_LOW_MS } from './lowData'

// localStorage is read once at module load, so a test that wants to see "what does a returning visitor get" has to
// build the storage first and then import the module afresh.
function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  }
}

async function loadWith(storage) {
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('window', { addEventListener: () => {}, removeEventListener: () => {} })
  vi.resetModules()
  return import('./lowData')
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('the low-data setting', () => {
  it('is off for someone who has never chosen it', async () => {
    const m = await loadWith(fakeStorage())
    expect(m.isLowData()).toBe(false)
  })

  it('is remembered between visits', async () => {
    const storage = fakeStorage()
    const first = await loadWith(storage)
    first.setLowData(true)
    const second = await loadWith(storage)
    expect(second.isLowData()).toBe(true)
  })

  it('turns off again and clears the stored value', async () => {
    const storage = fakeStorage({ 'nammes-low-data': '1' })
    const m = await loadWith(storage)
    expect(m.isLowData()).toBe(true)
    m.setLowData(false)
    expect(m.isLowData()).toBe(false)
    expect(storage.getItem('nammes-low-data')).toBeNull()
  })

  it('reads only the exact value it wrote, not anything truthy', async () => {
    // Anything else in this key would silently put fifty students on the data-saver route.
    const m = await loadWith(fakeStorage({ 'nammes-low-data': 'true' }))
    expect(m.isLowData()).toBe(false)
  })

  it('coerces whatever it is handed to a boolean', async () => {
    const m = await loadWith(fakeStorage())
    m.setLowData(1)
    expect(m.isLowData()).toBe(true)
    m.setLowData(0)
    expect(m.isLowData()).toBe(false)
  })

  it('stays put when set to the value it already has', async () => {
    const m = await loadWith(fakeStorage({ 'nammes-low-data': '1' }))
    m.setLowData(true)
    expect(m.isLowData()).toBe(true)
  })

  // The failure mode has to be "plays at full quality", not "blank screen on the second load".
  it('plays at full quality in private mode rather than failing', async () => {
    const hostile = {
      getItem: () => { throw new Error('denied') },
      setItem: () => { throw new Error('denied') },
      removeItem: () => { throw new Error('denied') },
    }
    const m = await loadWith(hostile)
    expect(m.isLowData()).toBe(false)
    expect(() => m.setLowData(true)).not.toThrow()
    // It still applies for this visit even though it could not be written down.
    expect(m.isLowData()).toBe(true)
  })
})

// The intervals are here so the setting has exactly one lever to move. If a phone halves its own poll rate but the
// host does not, the classroom is still saturated.
describe('what low data changes', () => {
  it('halves the number of requests a phone makes', async () => {
    const m = await loadWith(fakeStorage())
    expect(m.playerPollMs(false)).toBe(PLAYER_POLL_MS)
    expect(m.playerPollMs(true)).toBe(PLAYER_POLL_LOW_MS)
    expect(PLAYER_POLL_LOW_MS).toBeGreaterThan(PLAYER_POLL_MS)
  })

  it('slows the host answer poll too, since the host is on the same network', async () => {
    const m = await loadWith(fakeStorage())
    expect(m.hostPollMs(false)).toBe(HOST_POLL_MS)
    expect(m.hostPollMs(true)).toBe(HOST_POLL_LOW_MS)
    expect(HOST_POLL_LOW_MS).toBeGreaterThan(HOST_POLL_MS)
  })

  it('leaves the normal values exactly where they were', () => {
    // Pinned because "low data" must not quietly become the default by editing one constant.
    expect(PLAYER_POLL_MS).toBe(4000)
    expect(PLAYER_POLL_LOW_MS).toBe(8000)
    expect(HOST_POLL_MS).toBe(1500)
    expect(HOST_POLL_LOW_MS).toBe(2500)
  })
})