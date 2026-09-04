import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export const SUBMISSION_TYPES = ['Past Question', 'Lecture Notes', 'Other']

export function groupSubmissionsByType(rows) {
  return SUBMISSION_TYPES.map((type) => ({ type, items: rows.filter((r) => r.type === type) })).filter(
    (group) => group.items.length > 0
  )
}

export function validateSubmissionDraft({ title, mode, hasFile, externalUrl }) {
  if (!title || !title.trim()) return 'A title is required.'
  if (mode === 'file' && !hasFile) return 'Choose a file to upload.'
  if (mode === 'link' && !(externalUrl || '').trim()) return 'Paste a link.'
  return null
}

export async function fetchApprovedSubmissions(outlineId) {
  const { data, error } = await supabase
    .from('outline_submissions')
    .select('*')
    .eq('outline_id', outlineId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export function useApprovedSubmissionsQuery(outlineId) {
  return useQuery({
    queryKey: ['outline_submissions', 'approved', outlineId],
    queryFn: () => fetchApprovedSubmissions(outlineId),
    enabled: Boolean(outlineId),
  })
}

export async function fetchAllSubmissions() {
  const { data, error } = await supabase
    .from('outline_submissions')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export function useAllSubmissionsQuery() {
  return useQuery({ queryKey: ['outline_submissions', 'all'], queryFn: fetchAllSubmissions })
}
