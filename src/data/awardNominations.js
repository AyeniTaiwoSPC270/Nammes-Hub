import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export async function fetchMyNominations(seasonId, userId) {
  const { data, error } = await supabase
    .from('award_nominations')
    .select('*, award_categories!inner(season_id)')
    .eq('award_categories.season_id', seasonId)
    .eq('submitted_by', userId)
  if (error) throw error
  return data
}
export function useMyNominationsQuery(seasonId, userId) {
  return useQuery({
    queryKey: ['award_nominations', 'mine', seasonId, userId],
    queryFn: () => fetchMyNominations(seasonId, userId),
    enabled: Boolean(seasonId) && Boolean(userId),
  })
}

export async function upsertNomination({ id, categoryId, userId, nomineeName }) {
  if (id) {
    const { error } = await supabase
      .from('award_nominations')
      .update({ nominee_name: nomineeName, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    return
  }
  const { error } = await supabase
    .from('award_nominations')
    .insert({ category_id: categoryId, submitted_by: userId, nominee_name: nomineeName })
  if (error) throw error
}

export async function fetchNominationsForCategory(categoryId) {
  const { data, error } = await supabase
    .from('award_nominations')
    .select('*')
    .eq('category_id', categoryId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}
export function useCategoryNominationsQuery(categoryId) {
  return useQuery({
    queryKey: ['award_nominations', 'category', categoryId],
    queryFn: () => fetchNominationsForCategory(categoryId),
    enabled: Boolean(categoryId),
  })
}

export function groupNominationsByText(nominations) {
  const groups = new Map()
  for (const n of nominations) {
    const key = n.nominee_name.trim().toLowerCase().replace(/\s+/g, ' ')
    if (!groups.has(key)) groups.set(key, { displayName: n.nominee_name.trim(), count: 0, ids: [] })
    const g = groups.get(key)
    g.count += 1
    g.ids.push(n.id)
  }
  return Array.from(groups.values()).sort((a, b) => b.count - a.count)
}
