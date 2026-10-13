import { describe, it, expect, vi, beforeEach } from 'vitest'
import { normalizeTheme, hasTheme, safeImageUrl } from '../lib/formTheme'
import { saveFormLook, deleteFormLook } from './formLooks'

// The form counterpart of src/data/quizLooks.test.js, and the interesting difference is the pictures.
//
// A quiz look's backdrop and logo are `<quizId>/<uuid>.webp` paths, so a look applied to another quiz has to lose
// them. A form's page background and header are whole https urls (safeImageUrl below), which are the picture wherever
// they are -- so a saved form appearance keeps its images when it is applied to another form, and there is no stripping
// step at all. Getting that wrong in either direction would be silent: a form that quietly loses its header, or a quiz
// that quietly points at another quiz's storage folder.

const spy = vi.hoisted(() => ({ upserts: [], deletedRows: null }))

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from(table) {
      let selecting = null
      const api = {
        select: (columns) => { selecting = columns; return api },
        eq: () => api,
        order: () => api,
        upsert: (values) => { spy.upserts.push({ table, values }); return api },
        delete: () => api,
        single: async () => ({ data: { ...spy.upserts.at(-1)?.values }, error: null }),
        then: (resolve) => resolve({ data: spy.deletedRows, error: null }),
      }
      return api
    },
  },
}))

const HEADER = 'https://xyz.supabase.co/storage/v1/object/public/form-media/upl/abc/cover.webp'
const BACKDROP = 'https://xyz.supabase.co/storage/v1/object/public/form-media/upl/abc/bg.webp'

function appearance() {
  return normalizeTheme({
    accent: '#c2185b',
    page: { type: 'image', color: '#fde7ef', image: { url: BACKDROP }, imageBlur: 4 },
    header: { url: HEADER },
    fonts: { heading: 'Playfair Display', body: 'Lora' },
    width: 'wide',
  })
}

beforeEach(() => {
  spy.upserts = []
  spy.deletedRows = [{ id: 'form-look-1' }]
})

describe('a form image is a whole url, not a per-form path', () => {
  // This is the fact the whole no-stripping decision rests on, so it is asserted rather than assumed: if safeImageUrl
  // ever starts refusing these, or the uploader stops producing them, this fails and the stripping question reopens.
  it('accepts the storage urls the uploader produces', () => {
    expect(safeImageUrl(BACKDROP)).toBe(BACKDROP)
    expect(safeImageUrl(HEADER)).toBe(HEADER)
  })

  it('still refuses anything that is not an https url', () => {
    expect(safeImageUrl('javascript:alert(1)')).toBe('')
    expect(safeImageUrl(`/form-media/${HEADER}`)).toBe('')
  })
})

describe('saving a form appearance', () => {
  it('writes to form_looks', async () => {
    await saveFormLook({ id: 'form-look-1', name: 'Pink hero', design: appearance() })
    expect(spy.upserts).toHaveLength(1)
    expect(spy.upserts[0].table).toBe('form_looks')
  })

  it('trims the name, so a look cannot be called the same thing twice by accident', async () => {
    await saveFormLook({ id: 'form-look-1', name: '  Pink hero  ', design: appearance() })
    expect(spy.upserts[0].values.name).toBe('Pink hero')
  })

  // The contrast with a quiz look, and the reason the two modules are not one: nothing here is dropped for belonging
  // to another form, because an https url is not scoped to one.
  it('keeps the header and the background intact', async () => {
    await saveFormLook({ id: 'form-look-1', name: 'Pink hero', design: appearance() })
    const design = spy.upserts[0].values.design
    expect(design.header.url).toBe(HEADER)
    expect(design.page.image.url).toBe(BACKDROP)
  })

  it('cleans on write, so a hand-edited row cannot hold a value the renderer would clamp away', async () => {
    await saveFormLook({ id: 'form-look-1', name: 'Pink hero', design: { accent: '#ff0000', card: { radius: 999 }, fonts: { heading: 'Comic Papyrus' } } })
    const design = spy.upserts[0].values.design
    expect(design.card.radius).toBe(32)
    expect(design.fonts.heading).toBe('Public Sans')
    expect(hasTheme(design)).toBe(true)
  })
})

describe('applying a saved form appearance', () => {
  it('keeps the pictures and the design on any other form', () => {
    const applied = normalizeTheme(spy.upserts.length ? spy.upserts[0].values.design : appearance())
    expect(applied.header.url).toBe(HEADER)
    expect(applied.page.image.url).toBe(BACKDROP)
    expect(applied.fonts).toEqual({ heading: 'Playfair Display', body: 'Lora' })
    expect(applied.width).toBe('wide')
  })

  // Belt and braces: applying to a form that has nothing saved yet must still produce a renderable theme.
  it('produces a complete theme even from an empty row', () => {
    expect(normalizeTheme(undefined)).toEqual(normalizeTheme({}))
    expect(normalizeTheme({}).accent).toBe('#0b2417')
  })
})

describe('deleting a saved appearance', () => {
  it('reports a refused delete rather than looking like it worked', async () => {
    spy.deletedRows = []
    await expect(deleteFormLook('form-look-1')).rejects.toThrow(/admin access/)
  })
})
