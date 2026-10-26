import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { sanitizeAnalytics } from '../lib/analytics'

// One RPC, one request. The database groups; the browser only draws. sanitizeAnalytics is applied here
// rather than in the page so every consumer -- the screen, the CSV, the PDF -- sees the same clean
// numbers, and a malformed payload cannot reach a chart at all.
export async function fetchAnalytics(days = 30) {
  const { data, error } = await supabase.rpc('admin_analytics', { p_days: days })
  if (error) throw error
  return sanitizeAnalytics(data, days)
}

export function useAnalyticsQuery(days = 30) {
  return useQuery({
    queryKey: ['admin', 'analytics', days],
    queryFn: () => fetchAnalytics(days),
    // A dashboard is opened to look at something, not to watch it. A minute keeps a range switch cheap
    // when the admin flips back and forth, without serving yesterday's numbers all afternoon.
    staleTime: 60_000,
  })
}

// Fire and forget. The caller attaches a no-op catch: a beacon that fails must never surface to a
// reader, and the server drops anything it does not want rather than reporting why.
export async function recordPageView({ path, visitor, referrerHost, signedIn }) {
  const { error } = await supabase.rpc('record_page_view', {
    p_path: path,
    p_visitor: visitor,
    p_referrer_host: referrerHost,
    p_viewer: signedIn ? 'user' : 'anon',
  })
  if (error) throw error
}

export function useAnalyticsFlag() {
  const { data } = useQuery({
    queryKey: ['feature_flags', 'analytics'],
    queryFn: async () => {
      const { data: row, error } = await supabase
        .from('feature_flags')
        .select('enabled')
        .eq('key', 'analytics')
        .maybeSingle()
      if (error) return true
      return row?.enabled ?? true
    },
  })
  return data ?? true
}

