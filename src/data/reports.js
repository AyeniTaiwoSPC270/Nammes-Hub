import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { REPORT_CATEGORIES } from '../../api/_lib/publicSubmission.js'

// The label each stored code is shown as, in the report form and in the inbox. The keys are held
// against REPORT_CATEGORIES (the server's closed list) by reports.test.js, so a category added on
// one side and not the other fails here rather than showing a raw code to an admin.
const LABELS = {
  broken_link: 'Broken link',
  wrong_info: 'Wrong information',
  outdated: 'Outdated',
  other: 'Something else',
}

export const reportCategoryLabel = (value) => LABELS[value] ?? value
export const REPORT_CATEGORY_LABEL_KEYS = Object.keys(LABELS)
export { REPORT_CATEGORIES }

/**
 * The `reports` kill switch, as a plain boolean.
 *
 * Its own per-key query rather than a slice of `useFeatureFlagsQuery` (src/data/systemLogs.js:72): that one
 * fetches every flag and is only ever enabled for admins, while this decides whether a "Report a problem"
 * link renders on four public pages, and `feature_flags` grants select to anon
 * (20260929121000_feature_flags.sql:15).
 *
 * True until the row has actually said otherwise, for the same reason `useCalendarFlag`
 * (src/data/calendar.js:97) is: the row is seeded off, so a failed read must not be mistaken for
 * "off" -- that would hide the link for every visitor whenever feature_flags is briefly unreachable,
 * and a kill switch's job is to switch something off, not to hold a page hostage while a query runs.
 */
export function useReportsFlag() {
  const { data } = useQuery({
    queryKey: ['feature_flags', 'reports'],
    queryFn: async () => {
      const { data: row, error } = await supabase
        .from('feature_flags')
        .select('enabled')
        .eq('key', 'reports')
        .maybeSingle()
      if (error) return true
      return row?.enabled ?? true
    },
  })
  return data ?? true
}
