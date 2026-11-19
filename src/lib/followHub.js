// The /follow page and the QR code that points at it, kept pure so the rules can be tested without a DOM.
//
// The code points at this site, not at a link-in-bio service, for one reason: a printed flyer must never
// have to be reprinted because a social handle changed. The QR always carries /follow; the links behind
// that page are edited in Admin -> Site Links.
//
// A poster may also carry a campaign name (`...?src=qr&c=october-flyer`), so the scans it produces can be
// told apart from every other poster's. The name is folded into a slug here; the database checks the same
// shape again, for the same reason it repeats FOLLOW_SCAN_SOURCES -- the browser's copy avoids a pointless
// request, the server's copy is the actual boundary.

export const FOLLOW_PATH = '/follow'

// What may be reported as the reason somebody landed on /follow. The database repeats this list for the
// same reason it repeats the last checks in record_page_view: the browser's copy avoids a pointless
// request, and the server's copy is the actual boundary.
export const FOLLOW_SCAN_SOURCES = ['qr', 'link']

export const CAMPAIGN_MAX_LENGTH = 32
export const LINK_MAX_LENGTH = 40

// A slug has to survive a query string, a clipboard and a check constraint, so it is lower case letters
// and digits separated by single dashes -- never a leading or trailing one.
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function normaliseSlug(value, maxLength) {
  if (typeof value !== 'string') return ''
  const limited = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, maxLength)
  const slug = limited.replace(/^-+|-+$/g, '')
  return SLUG_PATTERN.test(slug) ? slug : ''
}

export function normaliseCampaign(value) {
  return normaliseSlug(value, CAMPAIGN_MAX_LENGTH)
}

// One shape for both a poster name and a link that was chosen after the visit (`whatsapp`, `newsletter`,
// `calendar`). The database stores exactly this string, so the admin panel does not need to know the list.
export function followLinkKey(value) {
  return normaliseSlug(value, LINK_MAX_LENGTH) || null
}

// The URL a person taps after the scan. `src=qr` is what makes a scan distinguishable from a direct visit,
// because a plain /follow visit is ordinary traffic and already counted by the page-view beacon. `c` is
// omitted entirely when the admin never named a poster, so the general code stays as short as it was.
export function followQrTarget(origin, campaign) {
  const base = typeof origin === 'string' ? origin.replace(/\/+$/, '') : ''
  const slug = normaliseCampaign(campaign)
  return `${base}${FOLLOW_PATH}?src=qr${slug ? `&c=${slug}` : ''}`
}

// The clean page, for a link an admin copies or shares.
export function followPageUrl(origin) {
  const base = typeof origin === 'string' ? origin.replace(/\/+$/, '') : ''
  return `${base}${FOLLOW_PATH}`
}

// A link an admin shares rather than prints. `src=link` keeps it out of the QR column, and the campaign
// rides along when there is one, so a WhatsApp broadcast can be told apart from the poster it echoes.
export function followSharedTarget(origin, campaign) {
  const base = typeof origin === 'string' ? origin.replace(/\/+$/, '') : ''
  const slug = normaliseCampaign(campaign)
  return `${base}${FOLLOW_PATH}?src=link${slug ? `&c=${slug}` : ''}`
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

export function campaignFromSearch(search) {
  const value = typeof search === 'string' ? search : ''
  let campaign = null
  try {
    campaign = new URLSearchParams(value.replace(/^\?/, '')).get('c')
  } catch {
    return null
  }
  return normaliseCampaign(campaign) || null
}

// The /follow page pins a channel that is a community rather than a feed: a student who joins a WhatsApp
// group gets everything the department posts, while an Instagram follow is one of several feeds they may
// never open again. The other links stay one tap away underneath; they just do not compete for the first
// look. Adding a second pinned platform is editing this list, not the page.
export const PRIMARY_SOCIAL_KEYS = ['whatsapp_url']

export function splitSocialLinks(links) {
  const list = Array.isArray(links) ? links : []
  const isPrimary = (link) => PRIMARY_SOCIAL_KEYS.includes(link.key)
  return { primary: list.filter(isPrimary), secondary: list.filter((link) => !isPrimary(link)) }
}
