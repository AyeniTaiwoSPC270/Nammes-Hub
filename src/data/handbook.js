import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { safeFileName } from '../lib/uploadPath'
import { useSiteContentQuery } from './siteContent'

// The copy of the handbook shipped with the site. Used until an admin publishes a newer build from Admin > Handbook.
export const HANDBOOK_FALLBACK_PDF = '/documents/NAMMES-Hub-Handbook.pdf'
export const HANDBOOK_DOWNLOAD_NAME = 'NAMMES-Hub-Handbook.pdf'

/** The address the Download buttons should use: the latest published build, or the shipped copy. */
export function useHandbookPdfUrl() {
  const { data } = useSiteContentQuery()
  return data?.handbook_pdf_url || HANDBOOK_FALLBACK_PDF
}

const KEY = ['handbook']

async function fetchHandbook() {
  const [settings, chapters] = await Promise.all([
    supabase.from('handbook_settings').select('*').eq('id', 1).single(),
    supabase.from('handbook_chapters').select('id, title, intro, html, updated_at'),
  ])
  if (settings.error) throw settings.error
  if (chapters.error) throw chapters.error
  return {
    settings: settings.data,
    chapters: Object.fromEntries(chapters.data.map((row) => [row.id, row])),
  }
}

/** Polls every few seconds while a build is running, so the admin page shows it finishing. */
export function useHandbookQuery() {
  return useQuery({
    queryKey: KEY,
    queryFn: fetchHandbook,
    refetchInterval: (query) => (query.state.data?.settings.build_status === 'building' ? 4000 : false),
  })
}

export function useSaveChapterMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, title, intro, html }) => {
      const { data: userData } = await supabase.auth.getUser()
      const { error } = await supabase.from('handbook_chapters').upsert({
        id,
        title: title || null,
        intro: intro || null,
        html: html || null,
        updated_at: new Date().toISOString(),
        updated_by: userData?.user?.id ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

/** Deleting the saved row brings back the original text written in the repo. */
export function useRestoreChapterMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('handbook_chapters').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

/** Saves any of: edition, as_of, foreword_html, texts, authors. Empty values are stored as null (= use the original). */
export function useSaveSettingsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (fields) => {
      const update = Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [key, value === '' || (value && typeof value === 'object' && !Object.keys(value).length) ? null : value]),
      )
      const { error } = await supabase.from('handbook_settings').update(update).eq('id', 1)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

const MAX_PHOTO_BYTES = 5 * 1024 * 1024

/** Uploads a picture for an author and returns the reference the book stores ('store:<path>'). */
export async function uploadAuthorPhoto(file) {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.')
  if (file.size > MAX_PHOTO_BYTES) throw new Error('The picture must be smaller than 5 MB.')
  const path = `authors/${Date.now()}-${safeFileName(file.name)}`
  const { error } = await supabase.storage.from('handbook').upload(path, file, { contentType: file.type })
  if (error) throw error
  return `store:${path}`
}

/** A URL the admin page can show for an author's photo reference. */
export function authorPhotoUrl(photo, bundled = {}) {
  if (!photo) return ''
  if (photo.startsWith('builtin:')) return bundled[photo.slice(8)] ?? ''
  if (photo.startsWith('store:')) return supabase.storage.from('handbook').getPublicUrl(photo.slice(6)).data.publicUrl
  if (photo.startsWith('url:')) return photo.slice(4)
  return ''
}

export function useBuildPdfMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const response = await fetch('/api/handbook-build', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'The PDF could not be built.')
      return result
    },
    // The server updates the status row itself; refetch on success or failure to show the outcome.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: KEY })
      queryClient.invalidateQueries({ queryKey: ['site_content'] })
    },
  })
}
