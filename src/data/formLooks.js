import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { normalizeTheme } from '../lib/formTheme.js'

// ---------- saved appearances ----------
//
// The appearances an admin has made and kept for the Form Design Studio, so they can be put back on this form or any
// other. Before this, the fourteen FORM_PRESETS (src/lib/formTheme.js:108) were the only starting points and there was
// no way to save one you had just built -- the same gap quiz_looks and calendar_looks closed for the other two studios.
//
// Kept out of src/data/forms.js because that module is reads only; this is the writes, the way src/data/emailStudio.js
// holds email_styles separately from the template reads.
//
// Unlike a quiz look, an appearance carries its images to another form. A form's page and header pictures are whole
// https urls (safeImageUrl, src/lib/formTheme.js:224), not per-form storage paths, so there is nothing here that could
// point at another form's folder.

export function useFormLooksQuery(enabled = true) {
  return useQuery({
    queryKey: ['form_looks'],
    queryFn: async () => {
      const { data, error } = await supabase.from('form_looks').select('*').order('id', { ascending: true })
      if (error) throw error
      return data
    },
    enabled,
  })
}

export async function saveFormLook({ id, name, design }) {
  // Cleaned on write as well as on read, so a saved appearance can never hold a value the renderer would later clamp
  // away -- the same discipline as saveQuizLook (src/data/quiz.js) and saveCalendarLook (src/data/calendar.js:171).
  const { data, error } = await supabase
    .from('form_looks')
    .upsert({ id, name: name.trim(), design: normalizeTheme(design) }, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  if (!data) throw new Error('No changes were saved — your account may not have admin access to saved appearances.')
  return data
}

export async function deleteFormLook(id) {
  const { data, error } = await supabase.from('form_looks').delete().eq('id', id).select()
  if (error) throw error
  // An admin-only policy turns a refused delete into an empty result rather than an error, and a silent no-op in the
  // studio would otherwise look like the appearance had been removed.
  if (!data || data.length === 0) {
    throw new Error('No changes were saved — your account may not have admin access to saved appearances.')
  }
}

export function useSaveFormLookMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: saveFormLook,
    // Applying an appearance only fills the studio's draft, so nothing here invalidates ['forms'].
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['form_looks'] }),
  })
}

export function useDeleteFormLookMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteFormLook,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['form_looks'] }),
  })
}
