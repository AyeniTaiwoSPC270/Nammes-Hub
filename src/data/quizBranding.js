import { supabase } from '../lib/supabaseClient'
import { processQuizImage } from '../lib/quizImage'
import { quizImagePath } from '../../api/_lib/quizImage.js'

// Logo and sponsor pictures live in the public quiz-branding bucket (admins upload, everyone can see).

export const BRANDING_BUCKET = 'quiz-branding'
export const BRANDING_MAX_EDGE = 600
export const BRANDING_MAX_BYTES = 500 * 1024

export function brandingUrl(path) {
  return path ? supabase.storage.from(BRANDING_BUCKET).getPublicUrl(path).data.publicUrl : null
}

// Shrinks the picture and uploads it under a fresh name in the quiz's own folder. Returns the stored path.
export async function uploadBrandingImage(quizId, file) {
  const { blob, ext } = await processQuizImage(file, { maxEdge: BRANDING_MAX_EDGE, maxBytes: BRANDING_MAX_BYTES })
  const path = quizImagePath({ quizId, questionId: crypto.randomUUID(), ext, stamp: Date.now() })
  const { error } = await supabase.storage.from(BRANDING_BUCKET).upload(path, blob, { contentType: blob.type })
  if (error) throw new Error(`Could not upload the picture: ${error.message}`)
  return path
}

export async function removeBrandingFiles(paths) {
  if (paths.length > 0) await supabase.storage.from(BRANDING_BUCKET).remove(paths) // best effort
}

// Every picture a theme uses.
export function brandingPaths(theme) {
  return [theme?.logo, ...(theme?.sponsors ?? []).map((s) => s.path)].filter(Boolean)
}
