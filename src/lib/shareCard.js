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