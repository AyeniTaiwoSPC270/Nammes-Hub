import { IMAGE_MAX_BYTES, IMAGE_TYPES } from '../../api/_lib/quizImage.js'

// Gets a picture ready for a quiz question: checks the type, shrinks it, and re-encodes it (which also drops any
// hidden metadata such as the place a photo was taken). The result is what gets uploaded.

export const IMAGE_MAX_EDGE = 1280
export const IMAGE_INPUT_MAX_BYTES = 12 * 1024 * 1024

// The size to draw at so the longest side is at most `max`, never scaling up.
export function fitWithin(width, height, max = IMAGE_MAX_EDGE) {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

// Returns an error message for a file that cannot be used, or null.
export function checkImageFile(file) {
  if (!file) return 'Choose an image.'
  if (!Object.hasOwn(IMAGE_TYPES, file.type)) return 'Use a JPG, PNG or WebP image.'
  if (file.size > IMAGE_INPUT_MAX_BYTES) return 'That image is too big (12 MB at most).'
  return null
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

export async function processQuizImage(file, { maxEdge = IMAGE_MAX_EDGE, maxBytes = IMAGE_MAX_BYTES } = {}) {
  const problem = checkImageFile(file)
  if (problem) throw new Error(problem)
  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('That file could not be read as an image.')
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  // WebP first; some browsers silently give a PNG back, in which case use JPEG.
  for (const [type, ext] of [['image/webp', 'webp'], ['image/jpeg', 'jpg']]) {
    for (const quality of [0.82, 0.7, 0.55]) {
      const blob = await toBlob(canvas, type, quality)
      if (blob && blob.type === type && blob.size <= maxBytes) return { blob, ext }
    }
  }
  throw new Error(`That image is too detailed to shrink under ${Math.round(maxBytes / 1024)} KB. Try a simpler one.`)
}
