// Small input validators shared by API routes. Reject early, before touching the database.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const isUuid = (value) => typeof value === 'string' && UUID_RE.test(value)

// True only for https URLs whose hostname is exactly one of allowedHosts.
export function isAllowedImageUrl(value, allowedHosts) {
  if (typeof value !== 'string' || !value) return false
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    return false
  }
  return parsed.protocol === 'https:' && allowedHosts.includes(parsed.hostname)
}

// True for a string whose trimmed length is between min and max (inclusive).
export function boundedString(value, min, max) {
  if (typeof value !== 'string') return false
  const length = value.trim().length
  return length >= min && length <= max
}
