import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export async function fetchEventPhotos(eventId) {
  const { data, error } = await supabase
    .from('event_photos')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export function useEventPhotosQuery(eventId) {
  return useQuery({
    queryKey: ['event_photos', eventId],
    queryFn: () => fetchEventPhotos(eventId),
    enabled: Boolean(eventId),
  })
}
