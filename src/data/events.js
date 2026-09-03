import { useQuery } from '@tanstack/react-query'
import { fetchTable } from '../lib/supabaseQueries'

export function fetchEvents() {
  return fetchTable('events', { orderBy: { column: 'created_at', ascending: true } })
}

export function useEventsQuery() {
  return useQuery({ queryKey: ['events'], queryFn: fetchEvents })
}

export function getEventById(list, id) {
  return list.find((e) => String(e.id) === id)
}

export function groupEventsByTime(list, now = new Date()) {
  const upcoming = []
  const past = []

  for (const event of list) {
    const parsed = new Date(event.date)
    if (!Number.isNaN(parsed.getTime()) && parsed < now) {
      past.push(event)
    } else {
      upcoming.push(event)
    }
  }

  upcoming.sort((a, b) => new Date(a.date) - new Date(b.date))
  past.sort((a, b) => new Date(b.date) - new Date(a.date))

  return { upcoming, past }
}
