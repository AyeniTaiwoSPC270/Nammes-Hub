import { fetchTable } from '../lib/supabaseQueries'

export function fetchOpportunities() {
  return fetchTable('opportunities')
}

export function getOpportunities(list) {
  return [...list].sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
}
