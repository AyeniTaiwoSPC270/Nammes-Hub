import { useQuery } from '@tanstack/react-query'
import { fetchTable } from '../lib/supabaseQueries'

export function fetchEvents() {
  return fetchTable('events', { orderBy: { column: 'created_at', ascending: true } })
}

export function useEventsQuery() {
  return useQuery({ queryKey: ['events'], queryFn: fetchEvents })
}
