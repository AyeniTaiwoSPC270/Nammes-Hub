// The browser half of the page-view beacon, kept pure so it can be tested without a DOM.
//
// The rules live in the SQL function too (record_page_view drops what it does not want), and that is
// deliberate: this module exists to avoid making a pointless request, not to be the security boundary.

const VISITOR_KEY = 'nammes-visitor'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Three prefixes are never page views. /admin because an exec visiting their own dashboard is not
// readership, /api because nothing navigates there, /play because the projector and phone clients are
// screens in a room. The SQL function repeats this list for the same reason it repeats the rest.
const SKIPPED = [/^\/admin(?:\/|$)/, /^\/api(?:\/|$)/, /^\/play(?:\/|$)/]

export function normalisePath(path) {
  const value = typeof path === 'string' ? path : ''
  if (!value) return '/'
  let clean = value.split('?')[0].split('#')[0]
  if (!clean.startsWith('/')) clean = `/${clean}`
  if (clean.length > 1) clean = clean.replace(/\/+$/, '')
  return clean || '/'
}

export function shouldTrack(path) {
  const clean = normalisePath(path)
  return !SKIPPED.some((pattern) => pattern.test(clean))
}

// The host alone. `document.referrer` is a full URL, and the path of the page someone came from can be
// that site's search results or an internal id -- neither is needed to know where a visitor arrived
// from, and neither should be stored.
export function referrerHost(referrer, origin) {
  if (typeof referrer !== 'string' || !referrer) return null
  try {
    const url = new URL(referrer)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (origin && url.origin === origin) return null
    return url.hostname.slice(0, 120) || null
  } catch {
    return null
  }
}

export function newVisitorId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // fall through to the manual form
  }
  const hex = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0')
  return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-a${hex().slice(1)}-${hex()}${hex()}${hex()}`
}

// One id per browsing session: sessionStorage, not localStorage, so it cannot follow anybody into next
// week. A storage that throws (private mode, disabled storage) must not break the page, so the id is
// simply generated in memory and that visit is not deduplicated with the next one.
export function readVisitor(storage, create = newVisitorId) {
  if (!storage) return create()
  try {
    const existing = storage.getItem(VISITOR_KEY)
    if (existing && UUID_PATTERN.test(existing)) return existing
    const id = create()
    storage.setItem(VISITOR_KEY, id)
    return id
  } catch {
    return create()
  }
}

// doNotTrack is a string in every browser that implements it, and '0' means "do not mind". The Global
// Privacy Control signal is a boolean.
export function optedOutOfTracking(nav) {
  if (!nav) return false
  if (nav.globalPrivacyControl === true) return true
  return nav.doNotTrack === '1' || nav.doNotTrack === 'yes'
}

export { VISITOR_KEY }
