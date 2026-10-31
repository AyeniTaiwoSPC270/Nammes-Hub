import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import {
  INBOX_CATEGORIES,
  categoryMeta,
  normaliseInbox,
  groupInboxItems,
  totalUnread,
  formatBadge,
  validateAnnouncement,
  relativeTime,
} from './adminInbox.js'

const T0 = Date.parse('2026-10-17T10:00:00Z')
const iso = (ms) => new Date(ms).toISOString()

function payload(overrides = {}) {
  return {
    categories: {
      submissions: { outstanding: 3, seenAt: null },
      messages: { outstanding: 0, seenAt: iso(T0 - 60 * 60 * 1000) },
    },
    items: [
      {
        category: 'submissions',
        id: 's1',
        title: 'New course material submission',
        detail: 'PHY 101 past questions',
        createdAt: iso(T0),
      },
      {
        category: 'messages',
        id: 'm2',
        title: 'New contact message',
        detail: 'Ada',
        createdAt: iso(T0),
      },
      {
        category: 'messages',
        id: 'm1',
        title: 'New contact message',
        detail: 'Older',
        createdAt: iso(T0 - 2 * 60 * 60 * 1000),
      },
    ],
    ...overrides,
  }
}

describe('normaliseInbox', () => {
  it('counts everything in a category that was never opened as unread', () => {
    const { categories } = normaliseInbox(payload())
    expect(categories.find((c) => c.key === 'submissions').unread).toBe(1)
  })

  it('only counts items newer than the category seenAt', () => {
    const { categories, unread } = normaliseInbox(payload())
    // The newer message survives the seenAt cutoff; the two-hour-old one does not.
    expect(categories.find((c) => c.key === 'messages').unread).toBe(1)
    expect(unread).toBe(2)
  })

  it('treats a seenAt at or after the item as read, not unread', () => {
    const { items } = normaliseInbox({
      categories: { messages: { outstanding: 0, seenAt: iso(T0) } },
      items: [{ category: 'messages', id: 'm', title: 't', detail: 'd', createdAt: iso(T0) }],
    })
    expect(items[0].unread).toBe(false)
  })

  it('drops a category this build does not know, rather than rendering a blank row', () => {
    const { items, categories } = normaliseInbox({
      categories: { submissions: { outstanding: 0, seenAt: null }, mystery: { outstanding: 4 } },
      items: [
        { category: 'mystery', id: 'x', title: 'x', detail: 'x', createdAt: iso(T0) },
        { category: 'submissions', id: 's', title: 's', detail: 's', createdAt: iso(T0) },
      ],
    })
    expect(items.map((i) => i.id)).toEqual(['s'])
    expect(categories.map((c) => c.key)).toEqual(['submissions'])
  })

  it('keeps display order from INBOX_CATEGORIES regardless of payload order', () => {
    const { categories } = normaliseInbox({
      categories: {
        announcements: { outstanding: 0, seenAt: null },
        submissions: { outstanding: 0, seenAt: null },
      },
      items: [],
    })
    expect(categories.map((c) => c.key)).toEqual(['submissions', 'announcements'])
  })

  it('attaches the label, icon and href from the single category list', () => {
    const { items } = normaliseInbox(payload())
    expect(items[0]).toMatchObject({
      label: 'Submissions',
      icon: 'fact_check',
      href: '/admin/submissions',
    })
  })

  it('survives an empty or malformed payload', () => {
    expect(normaliseInbox(undefined)).toEqual({ categories: [], items: [], unread: 0 })
    expect(normaliseInbox({ categories: {}, items: [{ id: 'no-category' }] }).items).toEqual([])
  })

  it('drops an item whose createdAt cannot be parsed', () => {
    const { items } = normaliseInbox({
      categories: { messages: { outstanding: 0, seenAt: null } },
      items: [{ category: 'messages', id: 'm', title: 't', detail: 'd', createdAt: 'not-a-date' }],
    })
    expect(items).toEqual([])
  })
})

describe('groupInboxItems', () => {
  it('groups in category order and drops empty groups', () => {
    const { items } = normaliseInbox(payload())
    const groups = groupInboxItems(items)
    expect(groups.map((g) => g.key)).toEqual(['submissions', 'messages'])
    expect(groups[0].items).toHaveLength(1)
  })

  it('returns nothing for an empty inbox', () => {
    expect(groupInboxItems([])).toEqual([])
  })

  it('keeps a category whose pending work is older than the item window', () => {
    const groups = groupInboxItems([], [{ key: 'submissions', outstanding: 3, seenAt: null }])
    expect(groups.map((g) => g.key)).toEqual(['submissions'])
    expect(groups[0].items).toEqual([])
    expect(groups[0].outstanding).toBe(3)
  })

  it('does not invent a group for a category with no items and nothing outstanding', () => {
    const groups = groupInboxItems([], [{ key: 'submissions', outstanding: 0, seenAt: null }])
    expect(groups).toEqual([])
  })
})

describe('totalUnread and formatBadge', () => {
  it('sums the per-category unread counts', () => {
    expect(totalUnread([{ unread: 2 }, { unread: 0 }, { unread: 1 }])).toBe(3)
  })

  it('caps the pill at 9+ and hides a zero', () => {
    expect(formatBadge(0)).toBe('')
    expect(formatBadge(null)).toBe('')
    expect(formatBadge(4)).toBe('4')
    expect(formatBadge(9)).toBe('9')
    expect(formatBadge(10)).toBe('9+')
    expect(formatBadge(120)).toBe('9+')
  })
})

describe('validateAnnouncement', () => {
  it('accepts a title and body at the boundary lengths', () => {
    expect(validateAnnouncement({ title: 'A', body: 'B' })).toBeNull()
    expect(validateAnnouncement({ title: 't'.repeat(120), body: 'b'.repeat(2000) })).toBeNull()
  })

  it('rejects an empty or whitespace-only field', () => {
    expect(validateAnnouncement({ title: '   ', body: 'body' })).toMatch(/title/i)
    expect(validateAnnouncement({ title: 'title', body: '\n\t ' })).toMatch(/announcement/i)
  })

  it('rejects a field over the SQL check length', () => {
    expect(validateAnnouncement({ title: 't'.repeat(121), body: 'b' })).toMatch(/120/)
    expect(validateAnnouncement({ title: 't', body: 'b'.repeat(2001) })).toMatch(/2000/)
  })
})

describe('relativeTime', () => {
  const now = T0

  it('reads as relative inside the first week', () => {
    expect(relativeTime(now - 20 * 1000, now)).toBe('just now')
    expect(relativeTime(now - 5 * 60 * 1000, now)).toBe('5m ago')
    expect(relativeTime(now - 3 * 60 * 60 * 1000, now)).toBe('3h ago')
    expect(relativeTime(now - 2 * 24 * 60 * 60 * 1000, now)).toBe('2d ago')
  })

  it('does not go negative when the host clock is behind the server', () => {
    expect(relativeTime(now + 5000, now)).toBe('just now')
  })
})

describe('category definitions', () => {
  it('keeps every key unique', () => {
    const keys = INBOX_CATEGORIES.map((c) => c.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('gives every category a label, href and description', () => {
    for (const category of INBOX_CATEGORIES) {
      expect(category.label, category.key).toBeTruthy()
      expect(category.href, category.key).toMatch(/^\/admin/)
      expect(category.description, category.key).toBeTruthy()
    }
  })

  it('resolves a known key and refuses an unknown one', () => {
    expect(categoryMeta('messages')?.href).toBe('/admin/messages')
    expect(categoryMeta('nope')).toBeNull()
  })

  // The icon-font test only scans .jsx for literal names, and these are drawn through
  // {category.icon}, so a category icon missing from index.html would show as text undetected.
  it('uses only icons that index.html actually loads', () => {
    const html = readFileSync('index.html', 'utf8')
    const loaded = new Set((html.match(/icon_names=([a-z_,]+)&/)?.[1] ?? '').split(','))
    for (const category of INBOX_CATEGORIES) {
      expect(loaded.has(category.icon), `${category.key} needs ${category.icon}`).toBe(true)
    }
  })

  // The same guard quizTypes uses: a source added to one side and not the other fails here.
  // Read from the LATEST migration that declares the function, not the original: `create or
  // replace` rewrites the whole body, so the original is no longer what the database runs.
  const latestInboxSql = () => {
    const files = readdirSync('supabase/migrations')
      .filter((f) => f.endsWith('.sql'))
      .filter((f) => readFileSync(`supabase/migrations/${f}`, 'utf8').includes('function public.admin_inbox()'))
    expect(files.length, 'no migration defines admin_inbox()').toBeGreaterThan(0)
    return readFileSync(`supabase/migrations/${files[files.length - 1]}`, 'utf8')
  }

  it('matches the categories unioned by admin_inbox()', () => {
    const sql = latestInboxSql()
    const fromSql = [...sql.matchAll(/select '([a-z]+)'::text as category/g)].map((m) => m[1])
    expect(fromSql.sort()).toEqual(INBOX_CATEGORIES.map((c) => c.key).sort())
  })

  it('matches the categories the seen table will accept', () => {
    // The constraint is widened rather than re-created in place, so the definition that matters is
    // the last migration that writes `admin_inbox_seen_category_check check (category in`.
    const files = readdirSync('supabase/migrations')
      .filter((f) => f.endsWith('.sql'))
      .filter((f) =>
        readFileSync(`supabase/migrations/${f}`, 'utf8').includes('admin_inbox_seen_category_check check (category in'),
      )
    expect(files.length, 'no migration declares the seen-table category constraint').toBeGreaterThan(0)
    const sql = readFileSync(`supabase/migrations/${files[files.length - 1]}`, 'utf8')
    const constraint = sql.match(/admin_inbox_seen_category_check check \(category in\s*\(([\s\S]*?)\)/)
    const allowed = [...(constraint?.[1] ?? '').matchAll(/'([a-z]+)'/g)].map((m) => m[1])
    expect(allowed.sort()).toEqual(INBOX_CATEGORIES.map((c) => c.key).sort())
  })
})
