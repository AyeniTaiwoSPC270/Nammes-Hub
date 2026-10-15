// Supabase wiring for the two tables behind the Events and News Design Studio.
// Spec: docs/superpowers/specs/2026-10-15-content-design-studio-design.md §3, §6
//
// `content_looks` holds the designs and `content_settings` holds which one each page is showing, so a
// live theme is a JOIN of two tables rather than a single row. That is why every write invalidates both
// keys (useSaveContentLookMutation) -- invalidating one leaves a stale pointer on screen.
//
// Its own module rather than a section of src/data/events.js or src/data/news.js. AGENTS.md records that
// the four existing studios keep separate tables and separate data modules on purpose, and this is the
// fifth; it also means the studio never has to import the row-reading half of either page's module.
//
// Reads here are the anon client's, not admin ones: /events and /news are anonymous pages and read the
// live design themselves, exactly as /calendar reads calendar_settings.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { PAGES, cleanLookName, sanitizeTheme } from '../../api/_lib/contentTheme.js'

// The columns the studio is allowed to write. Anything else in a settings patch is dropped here rather
// than handed to the database, so the column-scoped grant (20261015100000_content_looks.sql:88-90) cannot
// be spent on a field no admin UI has. `id` is absent for the same reason it is absent there.
const SETTINGS_FIELDS = ['events_look_id', 'news_look_id', 'events_on_home', 'news_on_home']

// `created_at` is deliberately absent: re-saving an existing design must not rewrite when it was added.
// `page` is present but is never taken from the payload -- see saveContentLook.
const LOOK_FIELDS = ['id', 'page', 'name', 'design']

const lookKey = (page) => ['content_looks', page]
const SETTINGS_KEY = ['content_settings']

const isPage = (value) => PAGES.includes(value)

// Every write below reports the admin "nothing was saved" error when zero rows come back. A policy that
// refuses a write turns it into an EMPTY result rather than an error, and a silent no-op in the studio
// would otherwise report success while nothing changed (same reason as src/data/calendar.js:130-137).
const assertSaved = (rows, noun) => {
  if (!rows || rows.length === 0) {
    throw new Error(`No changes were saved — your account may not have admin access to change ${noun}.`)
  }
  return rows
}

/** Every saved design for one page, oldest first. `page` is checked here so a bad prop cannot read both. */
export async function fetchContentLooks(page) {
  if (!isPage(page)) throw new Error(`Unknown content page: ${page}`)
  const { data, error } = await supabase
    .from('content_looks')
    .select('*')
    .eq('page', page)
    // `created_at`, not `id`: ids are client-minted as `slugify(name)-random` (src/lib/adminFields.js:9-12),
    // so ordering by id is ordering by how the designs happen to be NAMED. The studio's seed falls back to
    // "the first saved design" when nothing is live, and an admin who saved three over a term would expect
    // the oldest rather than whichever name sorts first.
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw error
  return data
}

export function useContentLooksQuery(page, enabled = true) {
  return useQuery({
    queryKey: lookKey(page),
    queryFn: () => fetchContentLooks(page),
    enabled: enabled && isPage(page),
  })
}

/**
 * The singleton row. `.single()` rather than `.maybeSingle()` for the reason fetchCalendarSettings gives
 * (src/data/calendar.js:64-67): the migration seeds it and `check (id = 1)` makes the table exactly one
 * row, so an empty result means the row is missing -- a migration problem worth surfacing, not hiding.
 */
export async function fetchContentSettings() {
  const { data, error } = await supabase.from('content_settings').select('*').eq('id', 1).single()
  if (error) throw error
  return data
}

export function useContentSettingsQuery() {
  return useQuery({ queryKey: SETTINGS_KEY, queryFn: fetchContentSettings })
}

/** The pointer name for a page, so the two call sites below cannot disagree about it. */
const lookIdField = (page) => `${page}_look_id`
const onHomeField = (page) => `${page}_on_home`

/**
 * Which design a page is showing, given the two rows.
 *
 * Pure, and exported, because this is the whole of the join and it is the one piece of `usePageLook` that
 * can be wrong in a way that renders the wrong design on a public page. The hook below is then a thin
 * wrapper with nothing left to get wrong, and this is what the tests check.
 */
export function findLiveLook(page, looks, settings) {
  if (!isPage(page)) return null
  const liveId = settings?.[lookIdField(page)] ?? null
  if (!liveId) return null
  return (looks ?? []).find((look) => look.id === liveId) ?? null
}

/** Whether Home's block for this page follows the design. Strictly `=== true`, so a null or a missing row
 *  reads as "off" rather than as truthy. */
export function isLookOnHome(page, settings) {
  return isPage(page) && settings?.[onHomeField(page)] === true
}

/**
 * The live design for one page, as a hook.
 *
 * NEVER throws and never blocks. A failed or still-running query falls back to `defaultTheme(page)`, which
 * is exactly what the page rendered before this feature existed: a page that cannot load its design must
 * still render its cards, because a theme is presentation and the news is the content.
 *
 * Returns `theme` and `onHome` and nothing else. The studio needs to know which row is live and whether the
 * queries have resolved, but it already reads both tables directly to drive its own list and its save
 * buttons -- so anything else here would be a second answer to a question the studio asks elsewhere.
 */
export function usePageLook(page) {
  const looksQuery = useContentLooksQuery(page)
  const settingsQuery = useContentSettingsQuery()

  const live = findLiveLook(page, looksQuery.data, settingsQuery.data)
  return {
    theme: sanitizeTheme(live?.design, page),
    onHome: isLookOnHome(page, settingsQuery.data),
  }
}

function cleanLook(fields) {
  const look = {}
  for (const field of LOOK_FIELDS) if (fields[field] !== undefined) look[field] = fields[field]
  return look
}

function cleanPatch(fields) {
  const patch = {}
  for (const field of SETTINGS_FIELDS) if (fields[field] !== undefined) patch[field] = fields[field]
  return patch
}

/**
 * Save a design, or save a copy of one.
 *
 * `page` comes from the caller and the design is cleaned for THAT page, so an events design can never
 * hold a featured-card setting even if the payload was copied out of a news row.
 */
export async function saveContentLook({ id, page, name, design }) {
  if (!isPage(page)) throw new Error(`Unknown content page: ${page}`)
  const row = cleanLook({
    id,
    page,
    name: cleanLookName(name),
    // Cleaned on write as well as on read, so a saved design can never hold a value the renderer would
    // later throw away (same discipline as saveCalendarLook, src/data/calendar.js:168-170).
    design: sanitizeTheme(design, page),
  })
  const { data, error } = await supabase.from('content_looks').upsert(row, { onConflict: 'id' }).select().single()
  if (error) throw error
  assertSaved(data ? [data] : [], 'saved designs')
  return data
}

export async function deleteContentLook(id) {
  const { data, error } = await supabase.from('content_looks').delete().eq('id', id).select()
  if (error) throw error
  // The `on delete set null` foreign key clears the live pointer in the same statement, so a page that was
  // showing this design drops back to its default rather than pointing at nothing.
  assertSaved(data, 'saved designs')
}

/**
 * The settings row is a singleton with a column-scoped grant, so there is nothing to insert and nothing
 * to delete -- only this update.
 */
export async function updateContentSettings(fields) {
  const patch = cleanPatch(fields)
  if (Object.keys(patch).length === 0) throw new Error('Nothing to save.')
  const { data, error } = await supabase.from('content_settings').update(patch).eq('id', 1).select().single()
  if (error) throw error
  assertSaved(data ? [data] : [], 'the page settings')
  return data
}

/**
 * The patch that points one page at one design, or clears it with `null`.
 *
 * Returned as a patch rather than written directly, so the studio hands it to its settings mutation and the
 * invalidation, the toast and the error handling all stay in one place.
 */
export function lookLivePatch(page, lookId) {
  if (!isPage(page)) throw new Error(`Unknown content page: ${page}`)
  return { [lookIdField(page)]: lookId }
}

/** The patch that says whether Home's block for this page follows the design. */
export function lookOnHomePatch(page, onHome) {
  if (!isPage(page)) throw new Error(`Unknown content page: ${page}`)
  return { [onHomeField(page)]: onHome === true }
}

export function useSaveContentLookMutation(page) {
  const queryClient = useQueryClient()
  return useMutation({
    // `page` is bound here rather than passed by the caller at each call site, so a save cannot land in
    // the other page's cache key by mistake.
    mutationFn: (fields) => saveContentLook({ ...fields, page }),
    // Both keys: the settings row names the look, so saving one can invalidate the other.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lookKey(page) })
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY })
    },
  })
}

export function useDeleteContentLookMutation(page) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteContentLook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lookKey(page) })
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY })
    },
  })
}

export function useUpdateContentSettingsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateContentSettings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEY }),
  })
}