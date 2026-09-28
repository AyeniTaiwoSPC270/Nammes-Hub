const FILE_ID_PATTERNS = [
  /\/file\/d\/([a-zA-Z0-9_-]+)/,
  /\/document\/d\/([a-zA-Z0-9_-]+)/,
  /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
  /\/presentation\/d\/([a-zA-Z0-9_-]+)/,
  /[?&]id=([a-zA-Z0-9_-]+)/,
]

export function extractDriveFileId(url) {
  for (const pattern of FILE_ID_PATTERNS) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

const HTML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }

export function decodeHtmlEntities(text) {
  return text.replace(/&(amp|lt|gt|quot|#39);/g, (_, entity) => HTML_ENTITIES[entity])
}

export function titleToFileName(pageTitle) {
  const decoded = decodeHtmlEntities(pageTitle).trim()
  const stripped = decoded.replace(/\s*-\s*Google (Drive|Docs|Sheets|Slides)\s*$/i, '').trim()
  // A bare "Google Drive" / "Google Accounts" title means the page didn't
  // resolve to a specific file (private file, sign-in wall, etc).
  if (!stripped || /^Google (Drive|Docs|Sheets|Slides|Accounts)$/i.test(stripped)) return ''
  return stripped
}
