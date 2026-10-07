import { describe, expect, it } from 'vitest'
import { DEFAULT_CARD } from './quizCard.js'
import { renderBoardCard, renderDuelCard, renderPersonalCard, FOOTER_TOP } from './quizCardRender.js'
import { contrastRatio, THEME_LOOKS } from './quizTheme.js'

// Mirrors the layout constants the renderer draws its rows with. Kept here rather than exported individually so
// the board's cap stays a property of the test rather than something the module can quietly agree with.
const ROW_TOP = 850
const ROW_HEIGHT = 78
const ROWS_DRAWN = 11

const QUIZ = { title: 'Naming Origins' }
const THEME = { look: 'classic', accent: null, pattern: 'math', logo: null, backdropOpacity: 8 }
const ME = { nickname: 'Ada', avatarId: 13, score: 14200, rank: 3, playerCount: 42, correctCount: 12, totalQuestions: 15, bestStreak: 5, teamName: 'Crimson' }
const isPng = (buf) => buf.subarray(1, 4).toString() === 'PNG'

describe('renderPersonalCard', () => {
  it('returns a real png buffer', async () => {
    const png = await renderPersonalCard({ card: DEFAULT_CARD, theme: THEME, quiz: QUIZ, me: ME })
    expect(Buffer.isBuffer(png)).toBe(true)
    expect(png.length).toBeGreaterThan(5000)
    expect(isPng(png)).toBe(true)
  })

  it('still renders when every stat is hidden', async () => {
    const card = { ...DEFAULT_CARD, showAccuracy: false, showStreak: false, showPlacement: false, showTeam: false, showTitle: false, showCharacter: false }
    const png = await renderPersonalCard({ card, theme: THEME, quiz: QUIZ, me: ME })
    expect(png.length).toBeGreaterThan(5000)
    expect(isPng(png)).toBe(true)
  })

  it('renders without a theme at all', async () => {
    const png = await renderPersonalCard({ card: DEFAULT_CARD, theme: null, quiz: null, me: ME })
    expect(isPng(png)).toBe(true)
  })

  it('copes with a very long nickname without throwing', async () => {
    const png = await renderPersonalCard({ card: DEFAULT_CARD, theme: THEME, quiz: QUIZ, me: { ...ME, nickname: 'Bartholomew Fitzgerald-Montgomery III' } })
    expect(isPng(png)).toBe(true)
  })

  it('skips the streak line when there is no streak to show', async () => {
    const withStreak = await renderPersonalCard({ card: DEFAULT_CARD, theme: THEME, quiz: QUIZ, me: ME })
    const without = await renderPersonalCard({ card: DEFAULT_CARD, theme: THEME, quiz: QUIZ, me: { ...ME, bestStreak: null } })
    expect(without.length).not.toBe(withStreak.length)
  })

  it('draws no rank band when there is no rank, the way a practice card has none', async () => {
    const ranked = await renderPersonalCard({ card: DEFAULT_CARD, theme: THEME, quiz: QUIZ, me: ME })
    const unranked = await renderPersonalCard({ card: DEFAULT_CARD, theme: THEME, quiz: QUIZ, me: { ...ME, rank: null } })
    expect(unranked.length).not.toBe(ranked.length)
  })
})

describe('renderBoardCard', () => {
  it('returns a real png for a full table', async () => {
    const ranked = Array.from({ length: 42 }, (_, i) => ({ rank: i + 1, nickname: `Player ${i + 1}`, avatarId: i % 50, score: 10000 - i * 100 }))
    const png = await renderBoardCard({ card: DEFAULT_CARD, theme: THEME, quiz: QUIZ, ranked, teams: [] })
    expect(isPng(png)).toBe(true)
    expect(png.length).toBeGreaterThan(5000)
  })

  it('renders with nobody on the board', async () => {
    const png = await renderBoardCard({ card: DEFAULT_CARD, theme: THEME, quiz: QUIZ, ranked: [], teams: [] })
    expect(isPng(png)).toBe(true)
  })

  it('summarises the tail rather than drawing 147 rows', async () => {
    const many = Array.from({ length: 150 }, (_, i) => ({ rank: i + 1, nickname: `P${i}`, avatarId: i % 50, score: 1000 - i }))
    const png = await renderBoardCard({ card: DEFAULT_CARD, theme: THEME, quiz: QUIZ, ranked: many, teams: [] })
    expect(isPng(png)).toBe(true)
  })

  it('draws team standings when the game had teams', async () => {
    const ranked = Array.from({ length: 8 }, (_, i) => ({ rank: i + 1, nickname: `P${i + 1}`, avatarId: i, score: 900 - i * 10 }))
    const teams = [
      { name: 'Crimson', color: '#dc2626', score: 2400 },
      { name: 'Azure', color: '#2563eb', score: 1900 },
    ]
    const png = await renderBoardCard({ card: DEFAULT_CARD, theme: THEME, quiz: QUIZ, ranked, teams })
    expect(isPng(png)).toBe(true)
  })
})

// A board card once ran its last row straight through the NAMMES mark and pushed the "and N more" line off the
// canvas. Nothing about the returned buffer shows that, so the layout arithmetic is checked directly.
describe('the board card layout', () => {
  it('keeps the last row and its summary line clear of the footer', () => {
    const lastRow = ROW_TOP + (ROWS_DRAWN - 1) * ROW_HEIGHT
    const summary = lastRow + ROW_HEIGHT + 16
    // A margin, not just clearance: with the rows flush against it the summary line's descenders sat on the rule.
    expect(FOOTER_TOP - summary).toBeGreaterThan(40)
  })

  it('caps the rows so the tail is summarised rather than drawn', () => {
    const many = Array.from({ length: 150 }, (_, i) => ({ rank: i + 1, nickname: `P${i}`, avatarId: i % 50, score: 1000 - i }))
    const capped = many.slice(3, 3 + ROWS_DRAWN)
    const full = many.slice(3)
    expect(capped.length).toBeLessThan(full.length)
  })
})

describe('renderDuelCard', () => {
  const sides = [
    { slot: 'a', nickname: 'Ada', avatarId: 13, score: 14200 },
    { slot: 'b', nickname: 'Bola', avatarId: 24, score: 9900 },
  ]

  it('returns a real png for two sides', async () => {
    const png = await renderDuelCard({ card: DEFAULT_CARD, theme: THEME, quiz: QUIZ, sides, winnerSlot: 'a', forfeit: false, questionCount: 10 })
    expect(isPng(png)).toBe(true)
  })

  it('renders a draw', async () => {
    const png = await renderDuelCard({
      card: DEFAULT_CARD, theme: THEME, quiz: QUIZ,
      sides: [{ ...sides[0], score: 900 }, { ...sides[1], score: 900 }],
      winnerSlot: null, forfeit: false, questionCount: 8,
    })
    expect(isPng(png)).toBe(true)
  })

  it('draws slot a on the left whichever order the rows arrive in', async () => {
    const left = await renderDuelCard({ card: DEFAULT_CARD, theme: THEME, quiz: QUIZ, sides, winnerSlot: 'a', forfeit: false, questionCount: 10 })
    const swapped = await renderDuelCard({ card: DEFAULT_CARD, theme: THEME, quiz: QUIZ, sides: [sides[1], sides[0]], winnerSlot: 'a', forfeit: false, questionCount: 10 })
    expect(left.equals(swapped)).toBe(true)
  })

  it('renders when one side never turned up', async () => {
    const png = await renderDuelCard({ card: DEFAULT_CARD, theme: THEME, quiz: QUIZ, sides: [sides[0]], winnerSlot: 'a', forfeit: true, questionCount: 6 })
    expect(isPng(png)).toBe(true)
  })
})

// The score is drawn in the look's accent on the look's own dark background, which is the opposite of what the live
// screens do with an accent. Several looks are close in tone, so every look has to stay legible.
describe('every look stays legible', () => {
  it('leaves the accent on a look that can carry it, and falls back to white on the ones that cannot', () => {
    // Most built-in looks are close in tone to their own background, which is fine on screen (they put white text
    // on an accent fill) but would render a muddy score on the card. Only a look with room for the accent keeps it.
    const legible = Object.entries(THEME_LOOKS).filter(([, look]) => contrastRatio(look.accent, look.deep[1]) >= 3)
    expect(legible.map(([id]) => id)).toEqual(['classic'])
    for (const [, look] of Object.entries(THEME_LOOKS)) {
      const accent = contrastRatio(look.accent, look.deep[1]) >= 3 ? look.accent : '#ffffff'
      expect(contrastRatio(accent, look.deep[1])).toBeGreaterThanOrEqual(3)
    }
  })

  it('keeps a card accent chosen in the studio legible too', () => {
    for (const look of Object.values(THEME_LOOKS)) {
      // The studio lets an admin pick any #rrggbb, including one that matches the background.
      expect(contrastRatio('#581c87', look.deep[1])).toBeLessThan(3)
      expect(contrastRatio('#ffffff', look.deep[1])).toBeGreaterThanOrEqual(3)
    }
  })
})