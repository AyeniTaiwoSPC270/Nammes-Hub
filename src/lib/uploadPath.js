// Builds storage paths from user-supplied file names without letting a crafted name
// escape its folder. Storage rules require member uploads to live under "<user-id>/".

export function safeFileName(name) {
  const cleaned = String(name ?? '').replace(/[^\w.-]+/g, '-')
  return /[A-Za-z0-9]/.test(cleaned) ? cleaned : 'file'
}

export function ownFolderPath(userId, fileName, now = Date.now()) {
  return `${userId}/${now}-${safeFileName(fileName)}`
}
