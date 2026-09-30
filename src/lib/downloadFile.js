// Saves text (a CSV, say) to the person's computer through a temporary link click.
export function downloadTextFile(filename, text, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// "Freshers' Night Quiz" -> "freshers-night-quiz"
export function fileSlug(text, fallback = 'quiz') {
  return String(text ?? '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || fallback
}
