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

// The instant an event is judged by. `starts_at` wins when it is there (20261009090000_calendar.sql:44) and the
// free-text `date` is the fallback, so a row written before the timestamp existed still buckets. Returns an
// Invalid Date when neither column gives one -- `date = 'TBA'`, an empty string, or nothing at all.
function eventInstant(event) {
  if (event.starts_at) {
    const parsed = new Date(event.starts_at)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return parseEventDate(event.date)
}

// Buckets into `{ upcoming, past, tba }`.
//
// An event with no `starts_at` and no parseable `date` is not upcoming. It used to be: an unparseable date fell
// through the `else`, which pinned a `date = 'TBA'` row at the top of Home's upcoming list forever, never
// scrolling away and never becoming past. The senate calendar makes that visible rather than tolerable -- its
// two "To be determined" rows are undated on purpose (spec §3.1) -- so undated rows get their own bucket, which
// the calendar's TBA panel reads (spec §10.1).
export function groupEventsByTime(list, now = new Date()) {
  const upcoming = []
  const past = []
  const tba = []

  for (const event of list) {
    const at = eventInstant(event)
    if (Number.isNaN(at.getTime())) {
      tba.push(event)
    } else if (at < now) {
      past.push(event)
    } else {
      upcoming.push(event)
    }
  }

  upcoming.sort((a, b) => eventInstant(a) - eventInstant(b))
  past.sort((a, b) => eventInstant(b) - eventInstant(a))
  // Undated rows have nothing to sort on, so they keep the order the query returned -- which is `created_at`,
  // the same order the old upcoming list showed them in.

  return { upcoming, past, tba }
}
