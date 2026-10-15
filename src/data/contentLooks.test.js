import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DEFAULT_THEME, defaultTheme, sanitizeTheme } from '../../api/_lib/contentTheme.js'
import {
  deleteContentLook,
  findLiveLook,
  isLookOnHome,
  lookLivePatch,
  lookOnHomePatch,
  saveContentLook,
  updateContentSettings,
} from './contentLooks'

// The data-module counterpart of api/_lib/contentTheme.test.js. The sanitiser is tested there; what is
// tested HERE is the part that only a data module can get wrong -- which table a write lands in, what the
// row carries, and whether a refused write says so.

const spy = vi.hoisted(() => ({ upserts: [], updates: [], deletedRows: null, refuse: false }))

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from(table) {
      const api = {
        select: () => api,
        eq: () => api,
        order: () => api,
        upsert: (values) => { spy.upserts.push({ table, values }); return api },
        update: (values) => { spy.updates.push({ table, values }); return api },
        delete: () => api,
        // `refuse` models what RLS actually does to a refused write: NOT an error, but zero rows back.
        single: async () => ({ data: spy.refuse ? null : { ...(spy.updates.at(-1)?.values ?? spy.upserts.at(-1)?.values) }, error: null }),
        then: (resolve) => resolve({ data: spy.refuse ? null : spy.deletedRows, error: null }),
      }
      return api
    },
  },
}))

beforeEach(() => {
  spy.upserts = []
  spy.updates = []
  spy.deletedRows = [{ id: 'news-look-1' }]
  spy.refuse = false
})

describe('saving a design', () => {
  it('writes to content_looks, never to content_settings', async () => {
    await saveContentLook({ id: 'news-look-1', page: 'news', name: 'Green house', design: { card: { radius: 'lg' } } })
    expect(spy.upserts).toHaveLength(1)
    expect(spy.upserts[0].table).toBe('content_looks')
    expect(spy.updates).toHaveLength(0)
  })

  it('trims the name and caps it at the length the column allows', async () => {
    await saveContentLook({ id: 'news-look-1', page: 'news', name: '  Green house  ', design: {} })
    expect(spy.upserts[0].values.name).toBe('Green house')
    await saveContentLook({ id: 'news-look-2', page: 'news', name: 'x'.repeat(80), design: {} })
    expect(spy.upserts[1].values.name).toHaveLength(40)
  })

  it('cleans on write, so a saved design cannot hold a value the renderer would throw away', async () => {
    await saveContentLook({
      id: 'news-look-1',
      page: 'news',
      name: 'Junk',
      design: { card: { radius: 'HUGE', shadow: 'infinite' }, layout: { columns: 99, ghost: 'x' } },
    })
    const design = spy.upserts[0].values.design
    // `radius: 'HUGE'` is not in the allow-list, so it falls back to the default rather than being repaired
    // into something -- and `columns: 99` clamps, which is a deliberate difference (calendarTheme.js int()).
    expect(design.card.radius).toBe(DEFAULT_THEME.card.radius)
    expect(design.card.shadow).toBe('md')
    expect(design.layout.columns).toBe(4)
    expect(design).not.toHaveProperty('ghost')
    expect(design).not.toHaveProperty('layout.ghost')
  })

  // The point of `page` being a column. A design copied out of the news row must not be able to carry a
  // lead-story setting onto /events, which has nothing to lead with.
  it('cleans for the page it is being saved against, not the page in the payload', async () => {
    await saveContentLook({ id: 'events-look-1', page: 'events', name: 'News copy', design: { layout: { featured: 'image-top', page: 'news' } } })
    const design = spy.upserts[0].values.design
    expect(design.layout.featured).toBe('none')
    expect(design.layout.page).toBe('events')
    expect(spy.upserts[0].values.page).toBe('events')
  })

  it('refuses a page that is neither of the two, rather than writing a row the check would reject', async () => {
    for (const page of ['calendar', 'Events', '', null, undefined]) {
      await expect(saveContentLook({ id: 'x', page, name: 'x', design: {} })).rejects.toThrow(/Unknown content page/)
    }
    expect(spy.upserts).toHaveLength(0)
  })

  it('reports a refused write rather than looking like it worked', async () => {
    // A policy that turns a refused write into an empty result is silent, so the studio would toast success
    // and nothing would change.
    spy.refuse = true
    await expect(saveContentLook({ id: 'x', page: 'news', name: 'x', design: {} })).rejects.toThrow(/admin access/)
    await expect(updateContentSettings(lookLivePatch('news', 'a'))).rejects.toThrow(/admin access/)
    await expect(deleteContentLook('news-look-1')).rejects.toThrow(/admin access/)
  })
})

describe('making a design live', () => {
  it('writes to content_settings, and only the pointer for that page', async () => {
    await updateContentSettings(lookLivePatch('news', 'news-look-1'))
    expect(spy.updates).toHaveLength(1)
    expect(spy.updates[0].table).toBe('content_settings')
    expect(spy.updates[0].values).toEqual({ news_look_id: 'news-look-1' })
    expect(spy.upserts).toHaveLength(0)
  })

  it('names the two fields apart, so neither page can repoint the other', () => {
    expect(lookLivePatch('news', 'a')).toEqual({ news_look_id: 'a' })
    expect(lookLivePatch('events', 'b')).toEqual({ events_look_id: 'b' })
    expect(lookOnHomePatch('news', true)).toEqual({ news_on_home: true })
    expect(lookOnHomePatch('events', false)).toEqual({ events_on_home: false })
  })

  it('clears a pointer with null, which is what a deleted live design leaves behind', async () => {
    await updateContentSettings(lookLivePatch('news', null))
    expect(spy.updates[0].values).toEqual({ news_look_id: null })
  })

  // The column-scoped grant excludes `id` (20261015100000_content_looks.sql:88-90). A patch carrying it would
  // be refused by the database, so it must never leave this module.
  it('drops any field the grant does not cover', async () => {
    await updateContentSettings({ news_look_id: 'a', id: 7, created_at: '2020-01-01', events_look_id: 'sneaky' })
    expect(Object.keys(spy.updates[0].values).sort()).toEqual(['events_look_id', 'news_look_id'])
    expect(spy.updates[0].values).not.toHaveProperty('id')
    expect(spy.updates[0].values).not.toHaveProperty('created_at')
  })

  it('refuses an empty patch rather than issuing a write that cannot mean anything', async () => {
    await expect(updateContentSettings({})).rejects.toThrow(/Nothing to save/)
    expect(spy.updates).toHaveLength(0)
  })

  it('refuses a page that is neither of the two', async () => {
    expect(() => lookLivePatch('calendar', 'a')).toThrow(/Unknown content page/)
    expect(() => lookOnHomePatch('calendar', true)).toThrow(/Unknown content page/)
  })
})

describe('deleting a design', () => {
  it('reports a refused delete rather than looking like it worked', async () => {
    spy.refuse = true
    await expect(deleteContentLook('news-look-1')).rejects.toThrow(/admin access/)
  })
})

describe('finding the live design: the join that usePageLook is made of', () => {
  const LOOKS = [
    { id: 'news-old', page: 'news', design: { card: { radius: 'sm' } } },
    { id: 'news-live', page: 'news', design: { card: { radius: 'lg' } } },
    { id: 'events-live', page: 'news', design: { card: { radius: 'full' } } },
  ]

  it('picks the row the settings pointer names', () => {
    expect(findLiveLook('news', LOOKS, { news_look_id: 'news-live' })?.id).toBe('news-live')
    expect(findLiveLook('news', LOOKS, { events_look_id: 'events-live' })).toBeNull()
  })

  it('is null rather than a wrong row when there is nothing to point at', () => {
    for (const settings of [undefined, null, {}, { news_look_id: null }, { news_look_id: 'deleted' }]) {
      expect(findLiveLook('news', LOOKS, settings), JSON.stringify(settings)).toBeNull()
    }
    expect(findLiveLook('news', undefined, { news_look_id: 'news-live' })).toBeNull()
  })

  it('is null for a page it does not know, rather than guessing the other one', () => {
    expect(findLiveLook('calendar', LOOKS, { news_look_id: 'news-live' })).toBeNull()
  })

  // The promise that matters: a page which cannot load its design still renders, at exactly what it rendered
  // before this feature existed. Asserted through the same two functions the hook calls.
  it('falls back to the page default when the read failed', () => {
    for (const page of ['events', 'news']) {
      const live = findLiveLook(page, undefined, undefined)
      expect(sanitizeTheme(live?.design, page), page).toEqual(defaultTheme(page))
    }
  })
})

describe('the home opt-in', () => {
  it('is strictly true, so a null or a missing row reads as off', () => {
    expect(isLookOnHome('news', { news_on_home: true })).toBe(true)
    for (const settings of [{ news_on_home: false }, { news_on_home: null }, {}, undefined, null, { news_on_home: 'yes' }]) {
      expect(isLookOnHome('news', settings), JSON.stringify(settings)).toBe(false)
    }
  })

  it('keeps the two pages apart', () => {
    expect(isLookOnHome('news', { events_on_home: true })).toBe(false)
    expect(isLookOnHome('events', { events_on_home: true })).toBe(true)
    expect(isLookOnHome('calendar', { news_on_home: true })).toBe(false)
  })
})