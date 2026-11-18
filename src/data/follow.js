import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

// Fire and forget from the page: a counter that fails must never be a page error, so the caller attaches a
// no-op catch. The server drops a source it does not recognise rather than reporting why.
export async function recordFollowScan(source) {
  const { error } = await supabase.rpc('record_follow_scan', { p_source: source })
  if (error) throw error
}

export function useFollowScanSummaryQuery() {
  return useQuery({
    queryKey: ['admin', 'follow_scans'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('follow_scan_summary')
      if (error) throw error
      return data
    },
    // A count of scans is not a live number; a minute keeps a tab switch cheap without serving last
    // month's total all afternoon.
    staleTime: 60_000,
  })
}
