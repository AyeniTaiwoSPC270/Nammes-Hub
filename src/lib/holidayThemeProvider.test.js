import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

// No DOM in this suite (node environment, as QuestionCard.test.jsx notes), so the provider's behaviour
// is held by scanning the wiring that only a merge could break: the overlay must write the vars, strip
// the last theme's keys before the next, re-apply on a light/dark toggle, and sit INSIDE ThemeProvider.
// What the overlay looks like on a real page still needs a browser — see the spec's §4.

const source = (file) => readFileSync(file, 'utf8')

describe('HolidayThemeProvider wiring', () => {
  const provider = source('src/lib/HolidayThemeProvider.jsx')

  it('paints with the pure holidayThemeVars and removes last time\'s keys first', () => {
    expect(provider).toContain('holidayThemeVars(active, theme)')
    const strip = provider.indexOf('removeProperty')
    const write = provider.indexOf('setProperty')
    expect(strip).toBeGreaterThan(-1)
    expect(write).toBeGreaterThan(-1)
    // Stripping runs before writing, or a theme that omits `brand` leaves yesterday's festive red standing.
    expect(strip).toBeLessThan(write)
  })

  it('re-applies when the reader toggles light/dark (the effect depends on the mode)', () => {
    expect(provider).toMatch(/useEffect\(\(\) => \{[\s\S]*holidayThemeVars\(active, theme\)[\s\S]*\}, \[active, theme\]\)/)
  })

  it('mounts inside ThemeProvider in main.jsx — it needs the light/dark mode to re-paint', () => {
    const main = source('src/main.jsx')
    const themeOpen = main.indexOf('<ThemeProvider>')
    const holidayOpen = main.indexOf('<HolidayThemeProvider>')
    const holidayClose = main.indexOf('</HolidayThemeProvider>')
    const themeClose = main.indexOf('</ThemeProvider>')
    expect(themeOpen).toBeGreaterThan(-1)
    expect(holidayOpen).toBeGreaterThan(themeOpen)
    expect(holidayClose).toBeGreaterThan(holidayOpen)
    expect(holidayClose).toBeLessThan(themeClose)
  })
})

describe('decor placement', () => {
  it('the banner renders under the navbar on public pages and inside the admin shell', () => {
    const layout = source('src/components/Layout.jsx')
    expect(layout).toContain('<HolidayBanner />')
    // Directly after the navbar, not before it and not at the foot of the page.
    expect(layout.indexOf('<Navbar />')).toBeLessThan(layout.indexOf('<HolidayBanner />'))
    expect(layout.indexOf('<HolidayBanner />')).toBeLessThan(layout.indexOf('<main'))
    expect(source('src/components/admin/AdminLayout.jsx')).toContain('<HolidayBanner />')
  })

  it('decor never renders on the quiz surfaces — they own their own look system', () => {
    const decor = source('src/components/site/HolidayDecor.jsx')
    for (const prefix of ['/host', '/play', '/battle', '/practice']) {
      expect(decor, `decor has no exclusion for ${prefix}`).toContain(`'${prefix}'`)
    }
    expect(decor).toContain('QUIZ_PREFIXES')
  })

  it('Home draws the band through the shared bucket helper', () => {
    const home = source('src/pages/Home.jsx')
    expect(home).toContain('holidayImageUrl')
    expect(home).toContain('holiday?.imagery?.band')
  })

  it('the navbar logo swap falls back to the site\'s own mark', () => {
    const navbar = source('src/components/Navbar.jsx')
    expect(navbar).toContain("holidayLogoUrl ?? '/logo-small.png'")
  })
})

describe('kill switch wiring', () => {
  it('the admin tile is gated by the holidays flag, and the hook fails open', () => {
    const admin = source('src/pages/Admin.jsx')
    expect(admin).toContain("flag: 'holidays'")
    expect(admin).toContain('useHolidayFlag()')
    // The filter has to honour the flag field, not just carry it.
    expect(admin).toContain('(!s.flag || holidaysEnabled)')

    const data = source('src/data/holidays.js')
    expect(data).toContain("queryKey: ['feature_flags', 'holidays']")
    // Fails open like useCalendarFlag: an unreachable flag table must not hide the screen, since the
    // RPC already refuses to paint anything when the row is missing.
    expect(data).toContain('if (error) return true')
  })

  it('the RPC — the painting half — checks the flag itself', () => {
    const sql = source('supabase/migrations/20261020120000_holiday_themes.sql')
    expect(sql).toContain("from public.feature_flags where key = 'holidays'")
  })
})

describe('studio save hygiene', () => {
  const admin = source('src/pages/admin/AdminHolidays.jsx')
  // Everything that must happen in the right order lives inside handleSave; slicing keeps the
  // assertions about that order honest instead of matching some other function's text.
  const saveBody = admin.slice(admin.indexOf('async function handleSave'), admin.indexOf('function handleDelete'))
  const slotBody = admin.slice(admin.indexOf('function ImageSlot'), admin.indexOf('export default function AdminHolidays'))

  it('the id is settled and validated BEFORE the look sync can write a junk row', () => {
    const validate = saveBody.indexOf('isThemeId(id)')
    const sync = saveBody.indexOf('syncHolidayQuizLook')
    expect(validate).toBeGreaterThan(-1)
    expect(sync).toBeGreaterThan(-1)
    expect(validate).toBeLessThan(sync)
    // One id feeds both writes, or the look id and the row id can disagree.
    expect(saveBody).toContain('syncHolidayQuizLook({ ...draft, id, quiz })')
    expect(saveBody).not.toContain('id: draft.id || slugify')
  })

  it('a replaced picture is deleted only AFTER the save lands, and never by the slot itself', () => {
    // The slot uploads and reports; it must not delete, or a failed save keeps a row pointing at a
    // file that is already gone.
    expect(slotBody).not.toContain('removeHolidayFiles')
    const flush = saveBody.indexOf('flushReplaced()')
    const write = saveBody.indexOf('saveMutation.mutateAsync')
    expect(flush).toBeGreaterThan(-1)
    expect(flush).toBeGreaterThan(write)
    // Abandoning the edit (another theme, or a new one) keeps every old file, because the saved row
    // still points at them.
    expect(admin).toContain('abandonEdit()')
  })

  it('a theme that carries a quiz backdrop picture reopens as a picture backdrop', () => {
    expect(admin).toContain("quiz: t.quiz.image ? { ...t.quiz, design: { ...t.quiz.design, pattern: 'image' } } : t.quiz")
  })
})

describe('quiz studio wiring', () => {
  it('SavedLooks copies a holiday look\'s picture into the quiz BEFORE sanitising it', () => {
    const saved = source('src/components/admin/quizStudio/SavedLooks.jsx')
    const copy = saved.indexOf('applyHolidayLook')
    const sanitise = saved.indexOf('sanitizeTheme(look.design, { quizId })')
    expect(copy).toBeGreaterThan(-1)
    // The copy must be the branch taken first: sanitizeTheme drops a foreign path on purpose, so an
    // order that sanitised first would lose the picture every time.
    expect(copy).toBeLessThan(sanitise)
  })

  it('AdminHolidays syncs the quiz look before the theme save records its id', () => {
    const admin = source('src/pages/admin/AdminHolidays.jsx')
    const sync = admin.indexOf('syncHolidayQuizLook')
    const save = admin.indexOf('saveMutation.mutateAsync')
    expect(sync).toBeGreaterThan(-1)
    // Two writes, look first, so a theme row can never name a look that was never written.
    expect(sync).toBeLessThan(save)
  })
})
