import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export async function fetchNomineesForCategories(categoryIds) {
  if (categoryIds.length === 0) return []
  const { data, error } = await supabase
    .from('award_nominees')
    .select('*')
    .in('category_id', categoryIds)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data
}
export function useNomineesQuery(categoryIds) {
  return useQuery({
    queryKey: ['award_nominees', categoryIds],
    queryFn: () => fetchNomineesForCategories(categoryIds),
    enabled: categoryIds.length > 0,
  })
}

export async function createNominee({ categoryId, name, photoUrl }) {
  const { error } = await supabase
    .from('award_nominees')
    .insert({ category_id: categoryId, name, photo_url: photoUrl || null })
  if (error) throw error
}

export async function deleteNominee(id) {
  const { error } = await supabase.from('award_nominees').delete().eq('id', id)
  if (error) throw error
}
