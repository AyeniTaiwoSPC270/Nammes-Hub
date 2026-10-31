import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  shouldPrompt,
  markShown,
  markRated,
  hasRated,
  storageAvailable,
  REASK_AFTER_DAYS,
} from './feedbackStorage.js'

const NOW = Date.parse('2026-10-31T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000

function installStorage() {
  const store = new Map()
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    },
  })
  return store
}

function installBrokenStorage() {
  vi.stubGlobal('window', {
    localStorage: {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
      removeItem: () => {
        throw new Error('denied')
      },
    },
  })
}

beforeEach(() => {
  installStorage()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('shouldPrompt', () => {
  it('asks on a device that has never been asked', () => {
    expect(shouldPrompt(NOW)).toBe(true)
  })

  it('does not ask again straight after a dismissal', () => {
    markShown(NOW)
    expect(shouldPrompt(NOW)).toBe(false)
    expect(shouldPrompt(NOW + REASK_AFTER_DAYS * DAY - 1)).toBe(false)
  })

  it('asks again once the re-ask window has passed', () => {
    markShown(NOW)
    expect(shouldPrompt(NOW + REASK_AFTER_DAYS * DAY)).toBe(true)
  })

  it('never asks again once a rating has been left', () => {
    markShown(NOW)
    markRated(NOW)
    expect(hasRated()).toBe(true)
    expect(shouldPrompt(NOW)).toBe(false)
    expect(shouldPrompt(NOW + 10 * 365 * DAY)).toBe(false)
  })

  it('never auto-appears when storage is unavailable', () => {
    // The load-bearing case: blocked storage must read as "leave me alone", not "ask again".
    installBrokenStorage()
    expect(storageAvailable()).toBe(false)
    expect(shouldPrompt(NOW)).toBe(false)
  })

  it('treats a corrupt stored value as never shown rather than as a date in the future', () => {
    const store = installStorage()
    store.set('nammes:feedback:shownAt', 'not-a-number')
    expect(shouldPrompt(NOW)).toBe(true)
  })
})

describe('the writers', () => {
  it('do not throw when storage refuses the write', () => {
    installBrokenStorage()
    expect(() => markShown(NOW)).not.toThrow()
    expect(() => markRated(NOW)).not.toThrow()
  })

  it('store a timestamp that reads back as one', () => {
    const store = installStorage()
    markShown(NOW)
    expect(store.get('nammes:feedback:shownAt')).toBe(String(NOW))
  })
})

describe('the source', () => {
  // Coarse on purpose, and backed by the behavioural tests above: every path through this module
  // already runs with a throwing localStorage, so an unguarded access would fail there first. This
  // catches the case the behaviour tests cannot -- an access added in a branch they never reach.
  it('keeps every localStorage access within a few lines of a try', () => {
    const lines = readFileSync('src/lib/feedbackStorage.js', 'utf8').split(/\r?\n/)
    lines.forEach((line, index) => {
      if (!line.includes('localStorage') || line.trim().startsWith('//')) return
      const preceding = lines.slice(Math.max(0, index - 4), index)
      expect(
        preceding.some((previous) => previous.includes('try {')),
        `line ${index + 1} touches localStorage outside a try: ${line.trim()}`,
      ).toBe(true)
    })
  })
})
