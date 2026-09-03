export function saveBlob(blob, filename) {
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(blobUrl)
}

export async function downloadImage(url, filename) {
  const response = await fetch(url)
  const blob = await response.blob()
  saveBlob(blob, filename)
}
