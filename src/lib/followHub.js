// The /follow page and the QR code that points at it, kept pure so the rules can be tested without a DOM.
//
// The code points at this site, not at a link-in-bio service, for one reason: a printed flyer must never
// have to be reprinted because a social handle changed. The QR always carries /follow; the links behind
// that page are edited in Admin -> Site Links.

export const FOLLOW_PATH = '/follow'

// What may be reported as the reason somebody landed on /follow. The database repeats this list for the
// same reason it repeats the last checks in record_page_view: the browser's copy avoids a pointless
// request, and the server's copy is the actual boundary.
export const FOLLOW_SCAN_SOURCES = ['qr', 'link']

// The URL a person taps after the scan. `src=qr` is what makes a scan distinguishable from a direct visit,
// because a plain /follow visit is ordinary traffic and already counted by the page-view beacon.
export function followQrTarget(origin) {
  const base = typeof origin === 'string' ? origin.replace(/\/+$/, '') : ''
  return `${base}${FOLLOW_PATH}?src=qr`
}

// The clean page, for a link an admin copies or shares.
export function followPageUrl(origin) {
  const base = typeof origin === 'string' ? origin.replace(/\/+$/, '') : ''
  return `${base}${FOLLOW_PATH}`
}

export function scanSourceFromSearch(search) {
  const value = typeof search === 'string' ? search : ''
  let source = null
  try {
    source = new URLSearchParams(value.replace(/^\?/, '')).get('src')
  } catch {
    return null
  }
  return FOLLOW_SCAN_SOURCES.includes(source) ? source : null
}
