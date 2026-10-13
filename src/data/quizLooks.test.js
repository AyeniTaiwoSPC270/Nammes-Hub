import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sanitizeTheme } from '../../api/_lib/quizTheme.js'
import { saveQuizLook, deleteQuizLook } from './quiz'

// The whole point of quiz_looks: a look an admin made can be put back on any quiz. The one thing it cannot carry is a
// picture, because an uploaded backdrop, logo or sponsor path is `<quizId>/<uuid>.webp` inside that quiz's own storage
// folder. Applying a look to a different quiz therefore has to drop the pictures rather than point at a folder that
// belongs to someone else -- the same failure src/data/quizDuplicate.test.js records for a duplicated quiz, where a
// foreign path survives until the first save and is then deleted along with the original's files.
//
// Saving a look keeps the pictures it was saved with, because a look belongs to no quiz. Stripping at save time
// instead would mean the look could never be applied to the quiz it was made on, which is the common case.

const QUIZ = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const pic = (quizId, kind) => `${quizId}/${kind.repeat(8)}-1111-4111-8111-111111111111-1767261600000.webp`

const spy = vi.hoisted(() => ({ upserts: [], deletes: [], deletedRows: null }))

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
        single: async () => ({ data: { ...spy.upserts.at(-1)?.values, id: spy.upserts.at(-1)?.values.id }, error: null }),
        // A chained delete resolves through `then`, not `single`, so it is awaited here.
        then: (resolve) => resolve({ data: spy.deletedRows, error: null }),
      }
      return api
    },
  },
}))

function sourceTheme() {
  return {
    look: 'royal',
    pattern: 'image',
    image: pic(QUIZ, 'a'),
    logo: pic(QUIZ, 'b'),
    sponsors: [{ name: 'Acme', path: pic(QUIZ, 'c') }],
    headline: 'Freshers Night',
    backdropMotion: 'pan',
  }
}

beforeEach(() => {
  spy.upserts = []
  spy.deletes = []
  spy.deletedRows = [{ id: 'look-1' }]
})

describe('saving a quiz look', () => {
  it('writes to quiz_looks, not to the quiz', async () => {
    await saveQuizLook({ id: 'look-1', name: 'Royal night', design: sourceTheme() })
    expect(spy.upserts).toHaveLength(1)
    expect(spy.upserts[0].table).toBe('quiz_looks')
  })

  // No quizId is passed to sanitizeTheme here, so the pictures are kept. That is what lets the look come back to the
  // quiz it was made on; they are dropped later, by the quiz being applied to.
  it('keeps the pictures it was saved with, so it can go back on its own quiz', async () => {
    await saveQuizLook({ id: 'look-1', name: 'Royal night', design: sourceTheme() })
    const design = spy.upserts[0].values.design
    expect(design.image).toBe(pic(QUIZ, 'a'))
    expect(design.logo).toBe(pic(QUIZ, 'b'))
    expect(design.sponsors[0].path).toBe(pic(QUIZ, 'c'))
  })

  it('cleans everything else on the way in, so a hand-edited row cannot put junk on a projector', async () => {
    await saveQuizLook({ id: 'look-1', name: 'Royal night', design: { look: 'royal', accent: 'chartreuse', headline: 'x'.repeat(500) } })
    const design = spy.upserts[0].values.design
    expect(design.accent).toBe(null)
    expect(design.headline.length).toBeLessThanOrEqual(60)
  })
})

describe('applying a saved look to a quiz', () => {
  // What SavedLooks.jsx does on every click: sanitizeTheme(look.design, { quizId }) is the whole of "what does this
  // look mean on THIS quiz". These four cases are the behaviour it is chosen for.
  it('keeps every picture when the look goes back on the quiz it came from', async () => {
    await saveQuizLook({ id: 'look-1', name: 'Royal night', design: sourceTheme() })
    const applied = sanitizeTheme(spy.upserts[0].values.design, { quizId: QUIZ })
    expect(applied.image).toBe(pic(QUIZ, 'a'))
    expect(applied.logo).toBe(pic(QUIZ, 'b'))
    expect(applied.sponsors).toHaveLength(1)
    expect(applied.pattern).toBe('image')
  })

  it('drops the pictures when it goes on a different quiz, and nothing is left pointing at the old folder', () => {
    const applied = sanitizeTheme(sourceTheme(), { quizId: OTHER })
    expect(applied.image).toBe(null)
    expect(applied.logo).toBe(null)
    expect(applied.sponsors).toEqual([])
    // The stronger form of the claim: no value anywhere in the applied design is one of the stored paths.
    const appliedPaths = [applied.image, applied.logo, ...applied.sponsors.map((s) => s.path)].filter(Boolean)
    expect(appliedPaths).toEqual([])
  })

  // An image backdrop with no picture is not a backdrop the screens can draw, so it settles rather than being kept as
  // a pattern nothing will render (cleanPattern, api/_lib/quizTheme.js:377).
  it('settles the backdrop pattern rather than leaving an image pattern with nothing behind it', () => {
    expect(sanitizeTheme(sourceTheme(), { quizId: OTHER }).pattern).toBe('none')
  })

  // Pan moves a photograph. Carried across with the photograph gone it would animate nothing on every screen.
  it('settles pan, which has nothing to move without a picture', () => {
    expect(sanitizeTheme(sourceTheme(), { quizId: OTHER }).backdropMotion).toBe('off')
  })

  it('carries the rest of the design across untouched', () => {
    expect(sanitizeTheme(sourceTheme(), { quizId: OTHER })).toMatchObject({
      look: 'royal',
      headline: 'Freshers Night',
    })
  })
})

describe('deleting a saved look', () => {
  it('reports a refused delete rather than looking like it worked', async () => {
    spy.deletedRows = []
    await expect(deleteQuizLook('look-1')).rejects.toThrow(/admin access/)
  })
})
