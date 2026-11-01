import { describe, expect, it } from 'vitest'
import { REPORT_CATEGORIES, REPORT_CATEGORY_LABEL_KEYS, reportCategoryLabel } from './reports.js'
import { REPORT_CATEGORIES as SERVER_CATEGORIES } from '../../api/_lib/publicSubmission.js'

describe('report categories', () => {
  it('labels exactly the categories the server accepts', () => {
    // The list a visitor picks from and the list validateReport accepts are two copies of the same
    // idea. A code added to one and not the other shows an admin a raw value in the inbox, or lets
    // a form offer something the server refuses.
    expect([...REPORT_CATEGORY_LABEL_KEYS].sort()).toEqual([...SERVER_CATEGORIES].sort())
    expect([...REPORT_CATEGORIES].sort()).toEqual([...SERVER_CATEGORIES].sort())
  })

  it('falls back to the raw code rather than rendering nothing', () => {
    expect(reportCategoryLabel('broken_link')).toBe('Broken link')
    expect(reportCategoryLabel('invented_code')).toBe('invented_code')
    expect(reportCategoryLabel(undefined)).toBeUndefined()
  })
})
