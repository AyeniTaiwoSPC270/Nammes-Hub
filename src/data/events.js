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

// Strips ordinal suffixes ("3rd", "21st") so human-typed dates like
// "3rd August 2026" parse the same as "3 August 2026".
export function parseEventDate(value) {
  if (!value) return new Date(NaN)
  const cleaned = String(value).replace(/\b(\d+)(st|nd|rd|th)\b/gi, '$1')
  return new Date(cleaned)
}

export function groupEventsByTime(list, now = new Date()) {
  const upcoming = []
  const past = []

  for (const event of list) {
    const parsed = parseEventDate(event.date)
    if (!Number.isNaN(parsed.getTime()) && parsed < now) {
      past.push(event)
    } else {
      upcoming.push(event)
    }
  }

  upcoming.sort((a, b) => parseEventDate(a.date) - parseEventDate(b.date))
  past.sort((a, b) => parseEventDate(b.date) - parseEventDate(a.date))

  return { upcoming, past }
}
