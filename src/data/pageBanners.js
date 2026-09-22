import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export async function fetchPageBanners() {
  const { data, error } = await supabase.from('page_banners').select('*')
  if (error) throw error
  return data || []
}

export function usePageBannersQuery() {
  return useQuery({ queryKey: ['page_banners'], queryFn: fetchPageBanners })
}

export function usePageBanner(pageKey) {
  const query = usePageBannersQuery()
  return query.data?.find((row) => row.page_key === pageKey)
}

export async function updatePageBanner(pageKey, fields) {
  const { data, error } = await supabase.from('page_banners').update(fields).eq('page_key', pageKey).select().single()
  if (error) throw error
  return data
}
