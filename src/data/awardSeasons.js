import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

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
