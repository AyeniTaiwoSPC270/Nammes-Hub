// Sharing a news article: the phone's own share sheet where it exists, with "Copy link" and
// "WhatsApp" as the two fallbacks everywhere else. Pure helpers, no dependencies, so the article
// page only has to decide which control to render.
//
// Spec: docs/superpowers/specs/2026-10-31-news-slugs-share-preview-design.md

/** The URL that gets shared. Absolute, because a crawler-bound link never reaches the browser. */
export function absoluteUrl(path) {
  const origin = typeof window !== 'undefined' && window?.location?.origin ? window.location.origin : ''
  return `${origin}${path}`
}

export function whatsappUrl(text, path) {
  return `https://wa.me/?text=${encodeURIComponent(`${text} ${absoluteUrl(path)}`.trim())}`
}

/**
 * Hand the link to the phone's share sheet.
 *
 * `dismissed` is a distinct outcome from `error`: someone closing the sheet is the normal end of
 * that flow and must not be reported as a failure the UI apologises for.
 */
export async function shareArticle({ title, path }) {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return { ok: false, reason: 'unsupported' }
  }
  try {
    await navigator.share({ title, url: absoluteUrl(path) })
    return { ok: true, reason: 'shared' }
  } catch (error) {
    return { ok: false, reason: error?.name === 'AbortError' ? 'dismissed' : 'error' }
  }
}

/**
 * Copy the link, falling back to the legacy selection copy when the async API is unavailable —
 * it is, on any origin that is not https, which is exactly where someone testing the site locally
 * will be.
 */
export async function copyLink(path) {
  const url = absoluteUrl(path)
  if (typeof navigator === 'undefined') return false

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url)
      return true
    }
  } catch {
    // Fall through: a rejected clipboard promise is usually a permissions denial on this origin.
  }

  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false
  try {
    const field = document.createElement('textarea')
    field.value = url
    field.setAttribute('readonly', '')
    field.style.position = 'fixed'
    field.style.opacity = '0'
    document.body.appendChild(field)
    field.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(field)
    return Boolean(copied)
  } catch {
    return false
  }
}
