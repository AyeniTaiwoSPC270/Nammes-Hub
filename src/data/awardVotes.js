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

// Vote counts come from aggregate-only database functions; raw vote rows (which carry voter_id)
// are readable only by the voter who cast them.
export async function fetchSeasonTally(seasonId) {
  const { data, error } = await supabase.rpc('award_tally', { p_season_id: seasonId })
  if (error) throw error
  return data
}
export function useSeasonTallyQuery(seasonId) {
  return useQuery({
    queryKey: ['award_tally', seasonId],
    queryFn: () => fetchSeasonTally(seasonId),
    enabled: Boolean(seasonId),
  })
}

export async function fetchBallotCount(seasonId) {
  const { data, error } = await supabase.rpc('award_ballot_count', { p_season_id: seasonId })
  if (error) throw error
  return Number(data)
}
export function useBallotCountQuery(seasonId) {
  return useQuery({
    queryKey: ['award_ballot_count', seasonId],
    queryFn: () => fetchBallotCount(seasonId),
    enabled: Boolean(seasonId),
  })
}

// tallyRows: rows of { category_id, nominee_id, votes } — pass only the rows for one category's nominees.
export function buildTallyFromCounts(tallyRows, nominees) {
  const counts = new Map(tallyRows.map((r) => [r.nominee_id, Number(r.votes)]))
  return nominees
    .map((nominee) => ({ nominee, count: counts.get(nominee.id) ?? 0 }))
    .sort((a, b) => b.count - a.count)
}

export function sumVotes(tallyRows) {
  return tallyRows.reduce((total, r) => total + Number(r.votes), 0)
}
