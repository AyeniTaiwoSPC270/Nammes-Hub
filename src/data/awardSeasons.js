import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { submitChangeRequest } from './changeRequests'

export const AWARD_PHASES = ['nominating', 'curating', 'voting', 'closed', 'revealed']

export function nextPhase(phase) {
  const i = AWARD_PHASES.indexOf(phase)
  return i >= 0 && i < AWARD_PHASES.length - 1 ? AWARD_PHASES[i + 1] : null
}

export function phaseAdvanceLabel(phase) {
  const labels = {
    nominating: 'Close nominations & start curating',
    curating: 'Open voting',
    voting: 'Close voting',
    closed: 'Reveal results',
  }
  return labels[phase] ?? null
}

function sortCategories(season) {
  const categories = (season.award_categories || []).slice().sort((a, b) => a.sort_order - b.sort_order)
  return { ...season, categories }
}

export async function fetchAllSeasons() {
  const { data, error } = await supabase.from('award_seasons').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data
}
export function useAllSeasonsQuery() {
  return useQuery({ queryKey: ['award_seasons', 'all'], queryFn: fetchAllSeasons })
}

export async function fetchLatestSeason() {
  const { data, error } = await supabase
    .from('award_seasons')
    .select('*, award_categories(*)')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data ? sortCategories(data) : null
}
export function useLatestSeasonQuery() {
  return useQuery({ queryKey: ['award_seasons', 'latest'], queryFn: fetchLatestSeason })
}

export async function fetchSeasonWithCategories(id) {
  const { data, error } = await supabase
    .from('award_seasons')
    .select('*, award_categories(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  return sortCategories(data)
}
export function useSeasonQuery(id) {
  return useQuery({ queryKey: ['award_seasons', id], queryFn: () => fetchSeasonWithCategories(id), enabled: Boolean(id) })
}

export async function fetchCategory(id) {
  const { data, error } = await supabase.from('award_categories').select('*').eq('id', id).single()
  if (error) throw error
  return data
}
export function useCategoryQuery(id) {
  return useQuery({ queryKey: ['award_categories', id], queryFn: () => fetchCategory(id), enabled: Boolean(id) })
}

export async function createSeason({ title, createdBy }) {
  const { data, error } = await supabase
    .from('award_seasons')
    .insert({ title, created_by: createdBy })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateSeasonTitle(id, title) {
  const { error } = await supabase.from('award_seasons').update({ title }).eq('id', id)
  if (error) throw error
}

export async function advanceSeasonPhase(id, toPhase) {
  const { error } = await supabase.from('award_seasons').update({ phase: toPhase }).eq('id', id)
  if (error) throw error
}

function storagePathFromUrl(url, bucket) {
  const marker = `/${bucket}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(url.slice(idx + marker.length))
}

export async function deleteSeason(id) {
  const { data: categories, error: categoriesError } = await supabase
    .from('award_categories')
    .select('id')
    .eq('season_id', id)
  if (categoriesError) throw categoriesError
  const categoryIds = (categories ?? []).map((c) => c.id)

  if (categoryIds.length > 0) {
    const [{ data: nominees, error: nomineesError }, { data: nominations, error: nominationsError }] = await Promise.all([
      supabase.from('award_nominees').select('photo_url').in('category_id', categoryIds),
      supabase.from('award_nominations').select('photo_url').in('category_id', categoryIds),
    ])
    if (nomineesError) throw nomineesError
    if (nominationsError) throw nominationsError

    const paths = [...(nominees ?? []), ...(nominations ?? [])]
      .map((row) => row.photo_url)
      .filter(Boolean)
      .map((url) => storagePathFromUrl(url, 'award-nominee-photos'))
      .filter(Boolean)
    if (paths.length > 0) await supabase.storage.from('award-nominee-photos').remove(paths)
  }

  const { data, error } = await supabase.from('award_seasons').delete().eq('id', id).select()
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('No changes were saved — your account may not have admin access to make this change.')
  }
}

export async function submitSeasonChange({ seasonId, title, categories }) {
  const payload = {
    title,
    categories: categories.map((c, i) => ({
      id: c.id,
      title: c.title.trim(),
      description: c.description?.trim() || null,
      sort_order: i,
    })),
  }
  await submitChangeRequest('award_season', seasonId ? 'update' : 'insert', seasonId ?? null, payload)
}
