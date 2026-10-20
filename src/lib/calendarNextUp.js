// The one rule that answers "what is coming up" for a strip of calendar items.
//
// Both /calendar and its Design Studio held this as an inline filter, and Home would have been the third copy.
// `endsAt >= todayKey` rather than `startsAt >= todayKey`, because a three-week exam block that opened last week is
// the single most useful thing the strip could say today. Ordering is the merge's own (by start), so the first
// `limit` items are the soonest.
//
// Whether the strip is wanted at all is the caller's decision -- a feature flag and an admin setting, never this
// function -- so a test can pass plain arrays without standing up either.
export function selectNextUp(items, todayKey, { enabled = true, limit = 4 } = {}) {
  if (!enabled || !Array.isArray(items)) return []
  return items.filter((item) => item.endsAt >= todayKey).slice(0, limit)
}
