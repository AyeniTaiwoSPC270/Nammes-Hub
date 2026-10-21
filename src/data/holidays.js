// Supabase wiring for holiday_themes + holiday_settings (supabase/migrations/20261020120000_holiday_themes.sql).
// Spec: docs/superpowers/specs/2026-10-20-holiday-themes-design.md §2, §3
//
// Two clients, two postures. The PUBLIC surface asks the `active_holiday_theme()` RPC once per app load:
// the tables are private to the owner, the schedule is resolved server-side in Africa/Lagos, and the
// holidays kill switch is honoured inside the RPC — so nothing here needs a flag query of its own. The
// OWNER writes go straight at the tables through the owner-only policies, the calendar_looks pattern.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { sanitizeHolidayTheme, isThemeId } from '../../api/_lib/holidayTheme.js'
import { sanitizeTheme } from '../../api/_lib/quizTheme.js'
import { quizImagePath, IMAGE_BUCKET } from '../../api/_lib/quizImage.js'
import { processQuizImage } from '../lib/quizImage'
import { saveQuizLook } from './quiz'

export const HOLIDAY_BUCKET = 'holiday-themes'
export const HOLIDAY_LOOK_PREFIX = 'holiday-'

// Site art vs quiz art: the band fills a homepage strip (large, like a backdrop) and the logo is small,
// mirroring the split quizBranding.js draws between its backdrop and its logos.
const UPLOAD_SIZES = {
  band: { maxEdge: 1600, maxBytes: 1500 * 1024 },
  logo: { maxEdge: 600, maxBytes: 500 * 1024 },
  quiz: { maxEdge: 1600, maxBytes: 1500 * 1024 },
  // The page background is the largest image the site draws (it covers the viewport), so it gets the
  // largest cap — still the same processQuizImage pipeline, still a webp/jpg under 2.5 MB.
  background: { maxEdge: 1920, maxBytes: 2500 * 1024 },
}

// The columns the studio writes. Anything else in a payload is dropped here rather than handed to the
// database — `created_at` is absent so a re-save cannot rewrite when a theme was added, and the touch
// trigger owns `updated_at`.
const THEME_FIELDS = ['id', 'name', 'palette', 'decor', 'imagery', 'background', 'quiz', 'starts_on', 'ends_on', 'enabled']
const SETTINGS_FIELDS = ['mode', 'active_theme_id']

const THEMES_KEY = ['holiday_themes']
const SETTINGS_KEY = ['holiday_settings']
const ACTIVE_KEY = ['active_holiday_theme']

// A refused write comes back as an EMPTY result rather than an error, and a silent no-op in the studio
// would look like a save (the reason src/data/calendar.js and src/data/contentLooks.js assert too).
const assertSaved = (rows, noun) => {
  if (!rows || rows.length === 0) {
    throw new Error(`No changes were saved — your account may not have owner access to change ${noun}.`)
  }
  return rows
}

/** Whether a saved quiz look is one of ours: the studio's apply path branches on this and nothing else. */
export function isHolidayLookId(id) {
  return typeof id === 'string' && id.startsWith(HOLIDAY_LOOK_PREFIX) && isThemeId(id.slice(HOLIDAY_LOOK_PREFIX.length))
}

export function holidayThemeIdFromLook(lookId) {
  return isHolidayLookId(lookId) ? lookId.slice(HOLIDAY_LOOK_PREFIX.length) : null
}

// ---------- Public: what is live ----------

/**
 * The one live theme, or null. The RPC answers with the whole row (or null when the flag is down, the
 * mode is off, or nothing is in range), so the browser never reads the theme list and never resolves a
 * date itself. A failure paints nothing: a holiday is decoration, and the site must render regardless.
 */
export function useActiveHolidayThemeQuery() {
  return useQuery({
    queryKey: ACTIVE_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('active_holiday_theme')
      if (error) return null
      return data ?? null
    },
    staleTime: 5 * 60_000,
  })
}

/**
 * The `holidays` kill switch, as a plain boolean. Same reasoning as useCalendarFlag (src/data/calendar.js):
 * its own query rather than a slice of the admin flag list, because it decides whether the admin tile exists
 * at all, and it fails OPEN — an unreachable flag table must not hide the screen, the RPC already refuses to
 * paint anything when the row is missing (coalesce(enabled, false) inside active_holiday_theme).
 */
export function useHolidayFlag() {
  const { data } = useQuery({
    queryKey: ['feature_flags', 'holidays'],
    queryFn: async () => {
      const { data: row, error } = await supabase
        .from('feature_flags')
        .select('enabled')
        .eq('key', 'holidays')
        .maybeSingle()
      if (error) return true
      return row?.enabled ?? true
    },
  })
  return data ?? true
}

// ---------- Owner: the list and the singleton ----------

export async function fetchHolidayThemes() {
  const { data, error } = await supabase
    .from('holiday_themes')
    .select('*')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw error
  return data
}

export function useHolidayThemesQuery(enabled = true) {
  return useQuery({ queryKey: THEMES_KEY, queryFn: fetchHolidayThemes, enabled })
}

/** The singleton, `.single()` for the reason fetchCalendarSettings gives: an empty result means the row is missing. */
export async function fetchHolidaySettings() {
  const { data, error } = await supabase.from('holiday_settings').select('*').eq('id', 1).single()
  if (error) throw error
  return data
}

export function useHolidaySettingsQuery(enabled = true) {
  return useQuery({ queryKey: SETTINGS_KEY, queryFn: fetchHolidaySettings, enabled })
}

function cleanThemePatch(fields) {
  // Cleaned on write as well as on read, so a saved theme can never hold a value the renderer would
  // later throw away (saveCalendarLook's discipline).
  const clean = sanitizeHolidayTheme(fields)
  if (!isThemeId(clean.id)) throw new Error('A theme needs an id of lowercase letters, numbers and dashes.')
  const patch = {}
  for (const field of THEME_FIELDS) if (clean[field] !== undefined) patch[field] = clean[field]
  return patch
}

export async function saveHolidayTheme(fields) {
  const patch = cleanThemePatch(fields)
  const { data, error } = await supabase.from('holiday_themes').upsert(patch, { onConflict: 'id' }).select().single()
  if (error) throw error
  assertSaved(data ? [data] : [], 'holiday themes')
  return data
}

export async function deleteHolidayTheme(id) {
  const { data, error } = await supabase.from('holiday_themes').delete().eq('id', id).select('id')
  if (error) throw error
  assertSaved(data, 'holiday themes')
  // The settings pointer clears through its `on delete set null` key; the quiz look row stays, because
  // quizzes that already applied it keep working (the spec's one-way copy, §5.3).
}

export async function updateHolidaySettings(fields) {
  const patch = {}
  for (const field of SETTINGS_FIELDS) if (fields[field] !== undefined) patch[field] = fields[field]
  if (Object.keys(patch).length === 0) throw new Error('Nothing to save.')
  const { data, error } = await supabase.from('holiday_settings').update(patch).eq('id', 1).select().single()
  if (error) throw error
  assertSaved(data ? [data] : [], 'the holiday settings')
  return data
}

export function useSaveHolidayThemeMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: saveHolidayTheme,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: THEMES_KEY })
      // The live theme is resolved from these rows, so a save can change what every visitor sees.
      queryClient.invalidateQueries({ queryKey: ACTIVE_KEY })
    },
  })
}

export function useDeleteHolidayThemeMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteHolidayTheme,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: THEMES_KEY })
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY })
      queryClient.invalidateQueries({ queryKey: ACTIVE_KEY })
    },
  })
}

export function useUpdateHolidaySettingsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateHolidaySettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY })
      queryClient.invalidateQueries({ queryKey: ACTIVE_KEY })
    },
  })
}

// ---------- Imagery ----------

export function holidayImageUrl(path) {
  return path ? supabase.storage.from(HOLIDAY_BUCKET).getPublicUrl(path).data.publicUrl : null
}

/**
 * Shrink and upload one picture into the theme's own folder. The stored path — not a URL — is what the
 * row holds, so the bucket can move behind a CDN without touching a single theme.
 */
export async function uploadHolidayImage(themeId, file, kind = 'band') {
  if (!isThemeId(themeId)) throw new Error('Save the theme with an id before uploading its pictures.')
  const { blob, ext } = await processQuizImage(file, UPLOAD_SIZES[kind] ?? UPLOAD_SIZES.band)
  const path = `${themeId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(HOLIDAY_BUCKET).upload(path, blob, { contentType: blob.type })
  if (error) throw new Error(`Could not upload the picture: ${error.message}`)
  return path
}

export async function removeHolidayFiles(paths) {
  if (paths.length > 0) await supabase.storage.from(HOLIDAY_BUCKET).remove(paths) // best effort
}

// ---------- The quiz surface ----------

/**
 * Write the theme's quiz mapping into the studio's saved-looks list, under a `holiday-<themeId>` id so
 * the apply path can find its picture later. saveQuizLook does the sanitising — one judge for every look.
 */
export async function syncHolidayQuizLook(theme) {
  const clean = sanitizeHolidayTheme(theme)
  const lookId = `${HOLIDAY_LOOK_PREFIX}${clean.id}`
  await saveQuizLook({ id: lookId, name: clean.name, design: clean.quiz.design })
  return lookId
}

/**
 * Applying a holiday look in the quiz studio, beyond what sanitizeTheme(look.design, { quizId }) does.
 *
 * Returns null for a look that is not a holiday look — the studio's normal path is untouched. For one
 * of ours: the design carries no picture (a holiday path is not a `<quizId>/uuid` path, so sanitizeTheme
 * would drop it), so the picture is copied from the holiday bucket into THIS quiz's own quiz-images
 * folder first, and only then handed to sanitizeTheme with the quizId. That honours the AGENTS.md rule —
 * a quiz's pictures live in the quiz's folder — instead of weakening it, and a failed copy simply settles
 * to a patternless backdrop rather than pointing at a file the quiz does not own.
 */
export async function applyHolidayLook(look, quizId) {
  if (!isHolidayLookId(look?.id) || !quizId) return null
  const themeId = holidayThemeIdFromLook(look.id)
  const { data: row, error } = await supabase.from('holiday_themes').select('quiz').eq('id', themeId).maybeSingle()
  if (error || !row) return { theme: sanitizeTheme(look.design, { quizId }), imageFailed: false }

  const quiz = sanitizeHolidayTheme({ id: themeId, quiz: row.quiz }).quiz
  let image = null
  if (quiz.image) {
    const dest = quizImagePath({ quizId, questionId: crypto.randomUUID(), ext: quiz.image.split('.').pop(), stamp: Date.now() })
    const { error: copyError } = await supabase.storage.from(HOLIDAY_BUCKET).copy(quiz.image, dest, { destinationBucket: IMAGE_BUCKET })
    if (!copyError) image = dest
  }
  const theme = sanitizeTheme(
    { ...quiz.design, ...(image ? { image, pattern: 'image' } : {}) },
    { quizId },
  )
  return { theme, imageFailed: Boolean(quiz.image) && !image }
}
