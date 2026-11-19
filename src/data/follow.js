import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

// Fire and forget from the page: a counter that fails must never be a page error, so the caller attaches a
// no-op catch. The server drops a source or campaign it does not recognise rather than reporting why.
export async function recordFollowScan(source, campaign = '') {
  const { error } = await supabase.rpc('record_follow_scan', {
    p_source: source,
    p_campaign: campaign ?? '',
  })
  if (error) throw error
}

// The other half of the picture: a scan says somebody arrived, this says what they did next. A click that
// opens WhatsApp must not wait on this request, so it is fire and forget for the same reason.
export async function recordFollowLinkClick(link) {
  const { error } = await supabase.rpc('record_follow_link_click', { p_link: link })
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
