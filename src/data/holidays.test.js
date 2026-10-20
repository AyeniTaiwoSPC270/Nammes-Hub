import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  isHolidayLookId, holidayThemeIdFromLook,
  syncHolidayQuizLook, applyHolidayLook,
} from './holidays'

// The data-module counterpart of api/_lib/holidayTheme.test.js. The pure rules are tested there; what
// is tested HERE is the part only a data module can get wrong: which bucket a picture is copied FROM
// and TO, what row a sync writes, and whether a non-holiday look leaves the studio's ordinary path
// completely alone.

const spy = vi.hoisted(() => ({
  upserts: [],
  holidayRow: null,
  copies: [],
  copyError: null,
}))

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from(table) {
      const api = {
        select: () => api,
        eq: () => api,
        order: () => api,
        upsert: (values, options) => {
          spy.upserts.push({ table, values, options })
          return api
        },
        maybeSingle: async () => ({ data: spy.holidayRow, error: null }),
        single: async () => ({ data: { ...(spy.upserts.at(-1)?.values ?? {}) }, error: null }),
        then: (resolve) => resolve({ data: [], error: null }),
      }
      return api
    },
    storage: {
      from(bucket) {
        return {
          copy: async (fromPath, toPath, options) => {
            spy.copies.push({ bucket, fromPath, toPath, options })
            return { error: spy.copyError }
          },
        }
      },
    },
  },
}))

beforeEach(() => {
  spy.upserts = []
  spy.holidayRow = null
  spy.copies = []
  spy.copyError = null
})

describe('holiday look ids', () => {
  it('recognises only the holiday- prefix over a real theme slug', () => {
    expect(isHolidayLookId('holiday-christmas-2026')).toBe(true)
    expect(isHolidayLookId('christmas-2026')).toBe(false)
    expect(isHolidayLookId('holiday-NOT A SLUG')).toBe(false)
    expect(holidayThemeIdFromLook('holiday-easter-2027')).toBe('easter-2027')
    expect(holidayThemeIdFromLook('plain-look')).toBeNull()
  })
})

describe('syncHolidayQuizLook', () => {
  it('writes the studio\'s quiz_looks row under the holiday id, design cleaned by sanitizeTheme', async () => {
    const lookId = await syncHolidayQuizLook({
      id: 'christmas-2026',
      name: 'Christmas / New Year',
      quiz: { design: { look: 'forest', pattern: 'stars', sound: { music: 'polka' } } },
    })
    expect(lookId).toBe('holiday-christmas-2026')
    const row = spy.upserts.find((u) => u.table === 'quiz_looks')
    expect(row).toBeTruthy()
    expect(row.values.id).toBe('holiday-christmas-2026')
    expect(row.values.name).toBe('Christmas / New Year')
    // saveQuizLook sanitises: an unknown music style is settled here, not stored for the studio to trip on.
    expect(row.values.design.sound.music).toBe('off')
  })
})

describe('applyHolidayLook', () => {
  const quizId = '11111111-2222-3333-4444-555555555555'

  it('returns null for an ordinary look and touches nothing', async () => {
    expect(await applyHolidayLook({ id: 'my-look', design: {} }, quizId)).toBeNull()
    expect(spy.copies).toHaveLength(0)
    expect(spy.upserts).toHaveLength(0)
  })

  it('copies the picture holiday-themes → quiz-images/<quizId>/ and only then sanitises it in', async () => {
    spy.holidayRow = {
      quiz: {
        design: { look: 'forest', pattern: 'stars', sound: { music: 'cinematic' } },
        image: 'christmas-2026/0f9db1e2-3c4a-4b5e-8c7d-1a2b3c4d5e6f.webp',
      },
    }
    const out = await applyHolidayLook({ id: 'holiday-christmas-2026', design: {} }, quizId)
    expect(spy.copies).toHaveLength(1)
    expect(spy.copies[0].bucket).toBe('holiday-themes')
    expect(spy.copies[0].options.destinationBucket).toBe('quiz-images')
    expect(spy.copies[0].toPath.startsWith(`${quizId}/`)).toBe(true)
    expect(spy.copies[0].toPath.endsWith('.webp')).toBe(true)
    // The copied path is INSIDE this quiz's folder, which is exactly what keeps sanitizeTheme from
    // dropping it (the AGENTS.md rule the copy exists to honour).
    expect(out.theme.image).toBe(spy.copies[0].toPath)
    expect(out.theme.pattern).toBe('image')
    expect(out.theme.sound.music).toBe('cinematic')
    expect(out.imageFailed).toBe(false)
  })

  it('a failed copy reports it, keeps the drawn pattern and never carries a foreign path', async () => {
    spy.holidayRow = {
      quiz: {
        design: { look: 'forest', pattern: 'stars' },
        image: 'christmas-2026/0f9db1e2-3c4a-4b5e-8c7d-1a2b3c4d5e6f.webp',
      },
    }
    spy.copyError = { message: 'boom' }
    const out = await applyHolidayLook({ id: 'holiday-christmas-2026', design: {} }, quizId)
    expect(out.imageFailed).toBe(true)
    expect(out.theme.image).toBeNull()
    // The drawn pattern is still drawable without the picture, so it stays.
    expect(out.theme.pattern).toBe('stars')
  })

  it('a failed copy of a picture-only backdrop settles to plain, per cleanPattern', async () => {
    spy.holidayRow = {
      quiz: {
        design: { look: 'forest', pattern: 'image' },
        image: 'christmas-2026/0f9db1e2-3c4a-4b5e-8c7d-1a2b3c4d5e6f.webp',
      },
    }
    spy.copyError = { message: 'boom' }
    const out = await applyHolidayLook({ id: 'holiday-christmas-2026', design: {} }, quizId)
    expect(out.theme.image).toBeNull()
    expect(out.theme.pattern).toBe('none')
  })

  it('a theme row that vanished still applies the look design', async () => {
    spy.holidayRow = null
    const out = await applyHolidayLook({ id: 'holiday-gone', design: { look: 'forest' } }, quizId)
    expect(out.theme.look).toBe('forest')
    expect(out.theme.image).toBeNull()
  })
})
