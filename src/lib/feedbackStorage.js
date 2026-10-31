// Remembering whether this device has been asked for a rating, and whether it answered.
//
// Every access is wrapped: in private mode, with a full quota, or on a browser that blocks storage
// outright, `localStorage` throws. The rule below then reads "never auto-prompt" rather than
// "prompt on every page" -- a modal that appears on every visit because storage is blocked is the
// worst possible outcome of this feature.
//
// Spec: docs/superpowers/specs/2026-10-31-rate-the-hub-modal-design.md

const SHOWN_KEY = 'nammes:feedback:shownAt'
const RATED_KEY = 'nammes:feedback:ratedAt'
const DAY = 24 * 60 * 60 * 1000

/** How long before someone who dismissed without answering is asked again. */
export const REASK_AFTER_DAYS = 90

export function storageAvailable() {
  try {
    const probe = 'nammes:feedback:probe'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

function readTime(key) {
  try {
    const value = Number(window.localStorage.getItem(key))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

function writeTime(key, value) {
  try {
    window.localStorage.setItem(key, String(value))
  } catch {
    // Nothing to do: the worst case is being asked again, which is what happens today anyway.
  }
}

/** Once a rating has been left, this device is never auto-asked again. */
export function hasRated() {
  return readTime(RATED_KEY) !== null
}

/**
 * Should the modal appear by itself?
 *
 * Rated -> never. Never shown -> yes. Shown and dismissed -> only once REASK_AFTER_DAYS have passed,
 * because the person who closed it without answering is exactly the one worth asking once more.
 */
export function shouldPrompt(now = Date.now()) {
  if (!storageAvailable()) return false
  if (hasRated()) return false
  const shownAt = readTime(SHOWN_KEY)
  if (shownAt === null) return true
  return now - shownAt >= REASK_AFTER_DAYS * DAY
}

export function markShown(now = Date.now()) {
  writeTime(SHOWN_KEY, now)
}

export function markRated(now = Date.now()) {
  writeTime(RATED_KEY, now)
}
