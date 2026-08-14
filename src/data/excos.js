import { useQuery } from '@tanstack/react-query'
import { fetchTable } from '../lib/supabaseQueries'

export function fetchExcos() {
  return fetchTable('excos', { orderBy: { column: 'sort_order', ascending: true } })
}

export function useExcosQuery() {
  return useQuery({ queryKey: ['excos'], queryFn: fetchExcos })
}
