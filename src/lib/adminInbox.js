// The admin inbox's one source of truth for what a category is called, where it points and which
// glyph draws it. admin_inbox() in SQL returns bare category keys on purpose: a route that moves
// must not leave a stale href behind in a database function.
//
// Every icon here must also be in index.html's icon_names= list. The icon-font test only scans
// .jsx files for literal names, and these are rendered as {category.icon}, so adminInbox.test.js
// checks this list against the stylesheet instead.

export const INBOX_CATEGORIES = [
  {
    key: 'submissions',
    label: 'Submissions',
    icon: 'fact_check',
    href: '/admin/submissions',
    description: 'Course material waiting for review',
  },
  {
    key: 'messages',
    label: 'Messages',
    icon: 'mail',
    href: '/admin/messages',
    description: 'Sent through the contact form',
  },
  {
    key: 'responses',
    label: 'Form responses',
    icon: 'checklist',
    href: '/admin/forms',
    description: 'Submitted to an admin-built form',
  },
  {
    key: 'reviews',
    label: 'Reviews',
    icon: 'pending_actions',
    href: '/admin/reviews',
    description: 'Edits waiting for owner approval',
  },
  {
    key: 'errors',
    label: 'System errors',
    icon: 'error',
    href: '/admin/system',
    description: 'Recorded by the API',
  },
  {
    key: 'announcements',
    label: 'Announcements',
    icon: 'campaign',
    href: '/admin',
    description: 'Posted by an admin',
  },
]

const BY_KEY = new Map(INBOX_CATEGORIES.map((category) => [category.key, category]))

export function categoryMeta(key) {
  return BY_KEY.get(key) ?? null
}

function toTime(value) {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? null : ms
}

// Turns the RPC payload into what the bell renders. Unknown categories are dropped rather than
// shown with no label or link: that only happens when a newer server sends a source this build
// does not know about, and a blank row is worse than an older-looking bell.
export function normaliseInbox(payload) {
  const rawCategories = payload?.categories ?? {}
  const seenAt = new Map()

  for (const category of INBOX_CATEGORIES) {
    const entry = rawCategories[category.key]
    if (entry) seenAt.set(category.key, toTime(entry.seenAt))
  }

  const items = []
  for (const item of payload?.items ?? []) {
    const meta = BY_KEY.get(item?.category)
    if (!meta || !item.id) continue
    const createdAt = toTime(item.createdAt)
    if (createdAt === null) continue
    const seen = seenAt.get(meta.key)
    items.push({
      ...meta,
      category: meta.key,
      id: String(item.id),
      title: String(item.title ?? ''),
      detail: String(item.detail ?? ''),
      createdAt,
      // A category never opened has no seenAt, so everything returned for it is new.
      unread: seen == null || createdAt > seen,
    })
  }

  const categories = INBOX_CATEGORIES.filter((category) => rawCategories[category.key] != null).map(
    (category) => {
      const entry = rawCategories[category.key]
      return {
        ...category,
        outstanding: Number(entry.outstanding) || 0,
        seenAt: toTime(entry.seenAt),
        unread: items.filter((item) => item.category === category.key && item.unread).length,
      }
    }
  )

  return { categories, items, unread: totalUnread(categories) }
}

export function totalUnread(categories) {
  return categories.reduce((sum, category) => sum + (category.unread || 0), 0)
}

// Ordering follows INBOX_CATEGORIES, not the order rows arrived: a bell grouped by arrival time
// mixes six unrelated jobs into one list. Empty groups are dropped so a quiet category leaves no
// heading behind -- except a category with outstanding work, which must not vanish just because
// the pending row is older than the 30-day window the items cover.
export function groupInboxItems(items, categories = []) {
  const outstanding = new Map(categories.map((category) => [category.key, category.outstanding || 0]))
  return INBOX_CATEGORIES.map((category) => ({
    ...category,
    outstanding: outstanding.get(category.key) ?? 0,
    items: items.filter((item) => item.category === category.key),
  })).filter((group) => group.items.length > 0 || group.outstanding > 0)
}

export function formatBadge(count) {
  if (!count || count < 1) return ''
  return count > 9 ? '9+' : String(count)
}

// The SQL checks are the real limit; this exists so the composer refuses before the round trip
// and the admin is told which field is wrong.
export function validateAnnouncement({ title, body } = {}) {
  const cleanTitle = (title ?? '').trim()
  const cleanBody = (body ?? '').trim()
  if (!cleanTitle) return 'Give the announcement a title.'
  if (cleanTitle.length > 120) return 'Keep the title to 120 characters or fewer.'
  if (!cleanBody) return 'Write the announcement.'
  if (cleanBody.length > 2000) return 'Keep the announcement to 2000 characters or fewer.'
  return null
}

// Relative for the first week, then a date. `now` is injectable so the test does not race a clock.
export function relativeTime(ms, now = Date.now()) {
  const diff = Math.max(0, now - ms)
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ms).toLocaleDateString()
}
