import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export async function fetchMyVotes(seasonId, userId) {
  const { data, error } = await supabase
    .from('award_votes')
    .select('*, award_categories!inner(season_id)')
    .eq('award_categories.season_id', seasonId)
    .eq('voter_id', userId)
  if (error) throw error
  return data
}
export function useMyVotesQuery(seasonId, userId) {
  return useQuery({
    queryKey: ['award_votes', 'mine', seasonId, userId],
    queryFn: () => fetchMyVotes(seasonId, userId),
    enabled: Boolean(seasonId) && Boolean(userId),
  })
}

export async function submitBallot(choices) {
  const { error } = await supabase.rpc('submit_award_ballot', { p_votes: choices })
  if (error) throw error
}

export async function fetchVotesForSeason(seasonId) {
  const { data, error } = await supabase
    .from('award_votes')
    .select('*, award_categories!inner(season_id)')
    .eq('award_categories.season_id', seasonId)
  if (error) throw error
  return data
}
export function useSeasonVotesQuery(seasonId) {
  return useQuery({
    queryKey: ['award_votes', 'season', seasonId],
    queryFn: () => fetchVotesForSeason(seasonId),
    enabled: Boolean(seasonId),
  })
}

export function buildTally(votes, nominees) {
  const counts = {}
  nominees.forEach((n) => {
    counts[n.id] = 0
  })
  votes.forEach((v) => {
    if (counts[v.nominee_id] !== undefined) counts[v.nominee_id] += 1
  })
  return nominees
    .map((n) => ({ nominee: n, count: counts[n.id] || 0 }))
    .sort((a, b) => b.count - a.count)
}
