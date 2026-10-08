import { supabase } from '../lib/supabaseClient'
import { processQuizImage } from '../lib/quizImage'
import { quizImagePath } from '../../api/_lib/quizImage.js'
import { sanitizeCard } from '../../api/_lib/quizCard.js'

// Logo and sponsor pictures live in the public quiz-branding bucket (admins upload, everyone can see).

export const BRANDING_BUCKET = 'quiz-branding'
export const BRANDING_MAX_EDGE = 600
export const BRANDING_MAX_BYTES = 500 * 1024

// A backdrop fills the whole projector, so it is allowed to be far bigger than a logo. Both stay under the bucket's
// file_size_limit, so an upload is turned away by the studio with a readable message rather than by storage.
export const BACKDROP_MAX_EDGE = 1600
export const BACKDROP_MAX_BYTES = 1500 * 1024

export function brandingUrl(path) {
  return path ? supabase.storage.from(BRANDING_BUCKET).getPublicUrl(path).data.publicUrl : null
}

// Shrinks the picture and uploads it under a fresh name in the quiz's own folder. Returns the stored path.
export async function uploadBrandingImage(quizId, file, { maxEdge = BRANDING_MAX_EDGE, maxBytes = BRANDING_MAX_BYTES } = {}) {
  const { blob, ext } = await processQuizImage(file, { maxEdge, maxBytes })
  const path = quizImagePath({ quizId, questionId: crypto.randomUUID(), ext, stamp: Date.now() })
  const { error } = await supabase.storage.from(BRANDING_BUCKET).upload(path, blob, { contentType: blob.type })
  if (error) throw new Error(`Could not upload the picture: ${error.message}`)
  return path
}

export async function removeBrandingFiles(paths) {
  if (paths.length > 0) await supabase.storage.from(BRANDING_BUCKET).remove(paths) // best effort
}

// Every picture a design uses. The backdrop is listed here too, or saving a look would leave an orphan in the bucket
// whenever the admin swaps one backdrop picture for another. The card background is passed separately because it
// lives on its own column and is saved on its own.

export function brandingPaths(theme, card) {
  return [theme?.logo, theme?.image, ...(theme?.sponsors ?? []).map((s) => s.path), card?.background].filter(Boolean)
}

// A short token that changes whenever the card design does. The studio puts it on the preview's url so the browser
// redraws, since /api/quiz-card renders the saved card rather than the draft.
export function cardPreviewVersion(card, quizId) {
  const clean = sanitizeCard(card, { quizId })
  let hash = 0
  for (const ch of JSON.stringify(clean)) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return (hash >>> 0).toString(36)
}
