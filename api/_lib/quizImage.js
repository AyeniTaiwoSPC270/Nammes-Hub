// Images on quiz questions live in the public `quiz-images` storage bucket. A question only stores a path, and the
// path must match this exact shape (and belong to the question's own quiz) before the server turns it into a URL.
// That way a hand-edited row can never make phones load some other address.

export const IMAGE_BUCKET = 'quiz-images'
export const IMAGE_ALT_MAX = 200
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024
export const IMAGE_TYPES = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' }

const PATH = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(-\d{10,13})?\.(webp|jpg|png)$/

// `quizId` is optional: when given, the path must sit in that quiz's folder.
export function isQuizImagePath(path, quizId) {
  if (typeof path !== 'string') return false
  const m = PATH.exec(path)
  if (!m) return false
  return quizId === undefined || m[1] === String(quizId).toLowerCase()
}

export function quizImagePath({ quizId, questionId, ext, stamp }) {
  return `${quizId}/${questionId}${stamp ? `-${stamp}` : ''}.${ext}`
}

// The public address of a stored image, or null if the path is not a valid one for this quiz.
export function publicImageUrl(baseUrl, path, quizId) {
  if (!baseUrl || !isQuizImagePath(path, quizId)) return null
  return `${String(baseUrl).replace(/\/+$/, '')}/storage/v1/object/public/${IMAGE_BUCKET}/${path}`
}

export function cleanAlt(value) {
  // eslint-disable-next-line no-control-regex
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, IMAGE_ALT_MAX) : ''
}
