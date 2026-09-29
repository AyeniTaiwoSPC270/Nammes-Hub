// Small input validators shared by API routes. Reject early, before touching the database.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const isUuid = (value) => typeof value === 'string' && UUID_RE.test(value)
