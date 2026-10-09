// Supabase wiring for the three calendar tables behind /calendar and the Calendar Design Studio.
// Spec: docs/superpowers/specs/2026-10-08-academic-calendar-design.md §3, §5, §6
//
// All three are public-read, so these are the anon client's queries, not admin ones: the same hooks serve the
// projector's calendar, an admin's editor and the flag check a logged-out visitor makes before the nav item
// renders. The only writes live at the bottom and mirror the grants in
// supabase/migrations/20261009090000_calendar.sql -- notably `calendar_settings`, where the grant is
// column-scoped and `id` is excluded so the singleton key cannot be repointed.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { sanitizeTheme } from '../../api/_lib/calendarTheme.js'

// The columns the studio and the session screen are allowed to write. Anything else in a settings patch is dropped
// here rather than handed to the database, so the column-scoped grant cannot be spent on a row the admin UI
// never had a field for.
const SETTINGS_FIELDS = [
  'active_session',
  'active_look_id',
  'default_view',
  'default_kinds',
  'default_sources',
  'reminder_enabled',
  'reminder_default_days',
]

// The entry columns the admin form owns. `id` is included because a save is an upsert (an admin adding a row
// mints the id on the client), and `created_at` is not, so re-saving an existing row cannot rewrite when it
// was added. `updated_at` is deliberately absent: the touch trigger sets it, and nothing here has to remember.
const ENTRY_FIELDS = ['id', 'session', 'semester', 'title', 'kind', 'starts_at', 'ends_at', 'note', 'remind_days']

/**
 * Every senate row, oldest first, undated rows last.
 *
 * Written against the client directly rather than through `fetchTable` (src/lib/supabaseQueries.js), which
 * takes one `orderBy` column and cannot express the second one or a null placement.
 *
 * The null placement is stated rather than assumed: Postgres treats NULL as larger than any value, so a plain
 * ascending sort already puts undated rows last. `nullsFirst: false` asks for exactly that explicitly, so the
 * ordering survives someone reading `ascending: true` and wondering, and survives a future PostgREST default.
 * A second `.order('id')` makes the result total -- two undated rows would otherwise come back in an order
 * that is allowed to change between identical requests, and the TBA panel would reshuffle on refresh.
 */
export async function fetchAcademicCalendar(session) {
  let query = supabase.from('academic_calendar').select('*')
  if (session) query = query.eq('session', session)
  const { data, error } = await query
    .order('starts_at', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true })
  if (error) throw error
  return data
}

// Without a session every row comes back, which is what the admin's grouped-by-semester list wants; the public
// page always knows its session, so it always passes one. The key carries the session either way, or switching
// sessions in the admin would show the previous session's rows from cache.
export function useAcademicCalendarQuery(session, enabled = true) {
  return useQuery({
    queryKey: ['academic_calendar', session ?? 'all'],
    queryFn: () => fetchAcademicCalendar(session),
    enabled,
  })
}

// The singleton row, read the way site_content reads its own (src/data/siteContent.js:5). `.single()` rather
// than `.maybeSingle()` on purpose: `check (id = 1)` makes the table exactly one row, so an empty result means
// the row is missing rather than "not yet" -- which is a migration problem worth surfacing, not hiding.
export async function fetchCalendarSettings() {
  const { data, error } = await supabase.from('calendar_settings').select('*').eq('id', 1).single()
  if (error) throw error
  return data
}

export function useCalendarSettingsQuery() {
  return useQuery({ queryKey: ['calendar_settings'], queryFn: fetchCalendarSettings })
}

export async function fetchCalendarLooks() {
  const { data, error } = await supabase.from('calendar_looks').select('*').order('id', { ascending: true })
  if (error) throw error
  return data
}

export function useCalendarLooksQuery() {
  return useQuery({ queryKey: ['calendar_looks'], queryFn: fetchCalendarLooks })
}

/**
 * The `calendar` feature flag, as a plain boolean.
 *
 * Deliberately its own query rather than a slice of `useFeatureFlagsQuery` (src/data/systemLogs.js:72): that one
 * fetches every flag and is only ever enabled for admins, while this decides whether the nav item and the route
 * exist at all, so it has to be answerable by an anonymous visitor -- which it is, `feature_flags` grants select
 * to anon (20260929121000_feature_flags.sql:13,15).
 *
 * Returns `true` until the row has actually said otherwise, for two reasons: a flash of a nav item that
 * disappears is noise, and a route that renders and then redirects away from itself is worse. The flag is a kill
 * switch, so what it must be able to do is switch something off, not hold a page hostage while the query runs.
 */
export function useCalendarFlag() {
  const { data } = useQuery({
    queryKey: ['feature_flags', 'calendar'],
    queryFn: async () => {
      const { data: row, error } = await supabase
        .from('feature_flags')
        .select('enabled')
        .eq('key', 'calendar')
        .maybeSingle()
      // An unreachable table or a missing row both read as "not switched off". Failing closed would hide the
      // calendar for every visitor whenever the flag table is briefly unavailable.
      if (error) return true
      return row?.enabled ?? true
    },
  })
  return data ?? true
}

function cleanEntry(fields) {
  const entry = {}
  for (const field of ENTRY_FIELDS) if (fields[field] !== undefined) entry[field] = fields[field]
  return entry
}

function cleanPatch(fields) {
  const patch = {}
  for (const field of SETTINGS_FIELDS) if (fields[field] !== undefined) patch[field] = fields[field]
  return patch
}

// Every write below reports the admin "nothing was saved" error when zero rows come back. An owner-only
// policy turns a refused write into an empty result rather than an error, and a silent no-op in the studio would
// otherwise look like a save (same reason as src/data/quiz.js:372).
const assertSaved = (rows, noun) => {
  if (!rows || rows.length === 0) {
    throw new Error(`No changes were saved — your account may not have admin access to change ${noun}.`)
  }
  return rows
}

export async function saveCalendarEntry(fields) {
  const entry = cleanEntry(fields)
  const { data, error } = await supabase.from('academic_calendar').upsert(entry, { onConflict: 'id' }).select()
  if (error) throw error
  assertSaved(data, 'the calendar')
  return data[0]
}

export async function deleteCalendarEntry(id) {
  const { data, error } = await supabase.from('academic_calendar').delete().eq('id', id).select()
  if (error) throw error
  assertSaved(data, 'the calendar')
}

// The settings row is a singleton with a column-scoped grant, so there is nothing to insert and nothing to
// delete here -- only this update.
export async function updateCalendarSettings(fields) {
  const patch = cleanPatch(fields)
  const { data, error } = await supabase
    .from('calendar_settings')
    .update(patch)
    .eq('id', 1)
    .select()
    .single()
  if (error) throw error
  assertSaved(data ? [data] : [], 'the calendar settings')
  return data
}

// The design is cleaned through the shared sanitizeTheme on the way in as well as on the way out, so the studio
// cannot store a colour the renderer would later throw away -- the same discipline as saveQuizTheme
// (src/data/quiz.js:368).
export async function saveCalendarLook({ id, name, design }) {
  const { data, error } = await supabase
    .from('calendar_looks')
    .upsert({ id, name, design: sanitizeTheme(design) }, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  assertSaved(data ? [data] : [], 'saved designs')
  return data
}

export async function deleteCalendarLook(id) {
  const { data, error } = await supabase.from('calendar_looks').delete().eq('id', id).select()
  if (error) throw error
  assertSaved(data, 'saved designs')
}

export function useSaveCalendarEntryMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: saveCalendarEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['academic_calendar'] }),
  })
}

export function useDeleteCalendarEntryMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteCalendarEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['academic_calendar'] }),
  })
}

export function useUpdateCalendarSettingsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateCalendarSettings,
    // A look id is stored in the settings row, so saving one can invalidate the other: the active design the
    // calendar paints is a join of two tables.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar_settings'] })
      queryClient.invalidateQueries({ queryKey: ['calendar_looks'] })
    },
  })
}

export function useSaveCalendarLookMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: saveCalendarLook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar_looks'] })
      queryClient.invalidateQueries({ queryKey: ['calendar_settings'] })
    },
  })
}

export function useDeleteCalendarLookMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteCalendarLook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar_looks'] })
      queryClient.invalidateQueries({ queryKey: ['calendar_settings'] })
    },
  })
}
