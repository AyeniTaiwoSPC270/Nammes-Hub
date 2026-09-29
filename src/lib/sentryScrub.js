// Removes personal data from error reports before they leave the browser.
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const MATRIC_RE = /\b\d{2}0406\d{3}\b/g
const BEARER_RE = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi
const JWT_RE = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g

export function scrubText(text) {
  return text
    .replace(BEARER_RE, 'Bearer [token]')
    .replace(JWT_RE, '[token]')
    .replace(EMAIL_RE, '[email]')
    .replace(MATRIC_RE, '[matric]')
}

function scrubDeep(value) {
  if (typeof value === 'string') return scrubText(value)
  if (Array.isArray(value)) return value.map(scrubDeep)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, scrubDeep(inner)]))
  }
  return value
}

export function scrubEvent(event) {
  const cleaned = scrubDeep(event)
  delete cleaned.user
  if (cleaned.request) {
    delete cleaned.request.headers
    delete cleaned.request.cookies
    delete cleaned.request.data
  }
  return cleaned
}
