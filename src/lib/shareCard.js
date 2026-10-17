// The blob half, split out so a caller that already has the bytes (a card fetched with an auth header, say) does
// not have to fetch a second time just to share them.
export async function shareOrDownloadBlob(blob, filename, shareTitle) {
  const file = new File([blob], filename, { type: blob.type || 'image/png' })

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: shareTitle })
    return
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function shareOrDownloadCard(imageUrl, filename, shareTitle) {
  const response = await fetch(imageUrl)
  if (!response.ok) throw new Error('Could not load the card image')
  return shareOrDownloadBlob(await response.blob(), filename, shareTitle)
}

// Always saves, never opens the share sheet.
export function saveCardBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoked on a delay, not straight away: some browsers have not started reading the blob by the time click()
  // returns, and an early revoke downloads an empty file. Same reason as downloadTextFile.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ---- Links, which reach a phone in a way a PNG does not ----

// The page a crawler should describe. Kept separate from the URL people actually tap, because that one carries the
// join code and must stay out of anything a preview service will fetch or cache.
// The page a person taps. The QR uses this: it is opened in the room, where a preview card is irrelevant.
export function joinUrl(code) {
  return `${window.location.origin}/play?code=${encodeURIComponent(code)}`
}

// What a host actually pastes into a group. It carries the same destination but goes through the Open Graph endpoint,
// because a preview service reads the link that was pasted and /play alone can only ever answer with the site's generic
// tags. The endpoint serves the card to a crawler and redirects a browser to the join page, so one URL does both.
export function shareJoinUrl(code) {
  return `${window.location.origin}/api/og?type=join&code=${encodeURIComponent(code)}`
}

export function shareResultsUrl(sessionId) {
  return `${window.location.origin}/api/og?type=result&session=${encodeURIComponent(sessionId)}`
}

export function whatsappUrl(text) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

// navigator.share is close to absent on Android browsers in practice, so the WhatsApp fallback is the path that
// actually reaches a phone. The card modal keeps its file share for tablets; this is for everyone else.
export async function shareLink(url, title) {
  const text = `${title} — ${url}`
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url })
      return
    } catch (error) {
      // A user cancelling the sheet is not a failure worth reporting, and there is nothing to fall back to.
      if (error?.name === 'AbortError') return
    }
  }
  window.open(whatsappUrl(text), '_blank', 'noopener,noreferrer')
}