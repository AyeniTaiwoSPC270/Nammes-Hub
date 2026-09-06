import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export async function fetchSiteContent() {
  const { data, error } = await supabase.from('site_content').select('*').eq('id', 1).single()
  if (error) throw error
  return data
}

export function useSiteContentQuery() {
  return useQuery({ queryKey: ['site_content'], queryFn: fetchSiteContent })
}

export async function updateSiteContent(fields) {
  const { data, error } = await supabase.from('site_content').update(fields).eq('id', 1).select().single()
  if (error) throw error
  return data
}

export function splitParagraphs(text) {
  if (!text) return []
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}
