import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sanitizeTheme } from '../../api/_lib/quizTheme.js'
import { duplicateQuiz } from './quiz'

// A look's pictures belong to one quiz's own folder, so copying a quiz has to copy them too. The failure this guards
// against is silent rather than loud: the source's paths survive the duplicate, are dropped on the first save of the copy
// because they are foreign to it, and the orphan sweep that follows then deletes the original quiz's logo and backdrop.

const QUIZ = '11111111-1111-4111-8111-111111111111'
const COPY = '22222222-2222-4222-8222-222222222222'
// A stored path is `<quizId>/<uuid>-<13-digit-ms>.webp` (api/_lib/quizImage.js), so the file id has to be a whole uuid.
const pic = (kind) => `${QUIZ}/${kind.repeat(8)}-1111-4111-8111-111111111111-1767261600000.webp`

const spy = vi.hoisted(() => ({ copies: [], updates: [], quiz: null }))

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
from(table) {
      // `select('id')` is the insert that mints the copy's id; the wider select is the read of the quiz being copied.
      let selecting = null
      const api = {
        select: (columns) => { selecting = columns; return api },
        eq: () => api,
        order: () => api,
        insert: () => api,
        update: (values) => { spy.updates.push({ table, values }); return api },
        delete: () => api,
        single: async () => ({ data: selecting === 'id' ? { id: COPY } : spy.quiz, error: null }),
      }
      return api
    },
    storage: {
      from: (bucket) => ({ copy: async (from, to) => { spy.copies.push({ bucket, from, to }); return { error: null } } }),
    },
  },
}))

function sourceTheme() {
  return {
    look: 'royal',
    pattern: 'image',
    image: pic('a'),
    logo: pic('b'),
    sponsors: [{ name: 'Acme', path: pic('c') }],
    headline: 'Freshers Night',
  }
}

beforeEach(() => {
  spy.copies = []
  spy.updates = []
  spy.quiz = { id: QUIZ, title: 'Freshers', max_players: 40, game_options: {}, tags: [], theme: sourceTheme(), quiz_questions: [] }
})

describe('duplicating a quiz', () => {
  it('copies the logo, the sponsors and the backdrop into the new quiz own folder', async () => {
    await duplicateQuiz(QUIZ)
    expect(spy.copies).toHaveLength(3)
    for (const { bucket, from, to } of spy.copies) {
      expect(bucket).toBe('quiz-branding')
      expect(from).toMatch(new RegExp(`^${QUIZ}/`))
      expect(to).toMatch(new RegExp(`^${COPY}/`))
    }
  })

  it('saves the copy with its own picture paths, so the first save of the copy keeps them', async () => {
    await duplicateQuiz(QUIZ)
    const saved = spy.updates.at(-1).values.theme
    expect(saved.logo).toMatch(new RegExp(`^${COPY}/`))
    expect(saved.image).toMatch(new RegExp(`^${COPY}/`))
    expect(saved.sponsors[0].path).toMatch(new RegExp(`^${COPY}/`))
    // The real check: cleaning that theme against the new quiz keeps every picture, where the old behaviour did not.
    expect(sanitizeTheme(saved, { quizId: COPY })).toMatchObject({ pattern: 'image', logo: saved.logo, image: saved.image })
  })

  it('leaves nothing in the copy pointing back at the original quiz folder', async () => {
    await duplicateQuiz(QUIZ)
    const saved = spy.updates.at(-1).values.theme
    for (const path of [saved.logo, saved.image, ...saved.sponsors.map((s) => s.path)]) {
      expect(path).not.toMatch(new RegExp(`^${QUIZ}/`))
    }
  })

  it('carries the rest of the look across unchanged', async () => {
    await duplicateQuiz(QUIZ)
    expect(spy.updates.at(-1).values.theme).toMatchObject({ look: 'royal', headline: 'Freshers Night' })
  })

  it('gives a look with no pictures nothing to copy', async () => {
    spy.quiz.theme = { look: 'ocean', headline: 'No pictures here' }
    await duplicateQuiz(QUIZ)
    expect(spy.copies).toEqual([])
    expect(spy.updates.at(-1).values.theme).toMatchObject({ look: 'ocean', image: null, logo: null, sponsors: [] })
  })
})
