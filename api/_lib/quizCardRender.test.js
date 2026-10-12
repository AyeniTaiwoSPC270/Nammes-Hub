import { describe, expect, it } from 'vitest'
import { createCanvas } from '@napi-rs/canvas'
import { DEFAULT_CARD, sanitizeCard } from './quizCard.js'
import { ensureFonts } from './fonts.js'
import { drawBackdrop, renderBoardCard, renderDuelCard, renderPersonalCard, FOOTER_TOP, rowsThatFit, podiumLayout, PODIUM_TEXT_WIDTH, CARD_WIDTH, CARD_HEIGHT } from './quizCardRender.js'
import { contrastRatio, THEME_LOOKS, THEME_PATTERNS, PATTERN_UNDRAWN } from './quizTheme.js'

const QUIZ = { title: 'Naming Origins' }
const THEME = { look: 'classic', accent: null, pattern: 'math', logo: null, backdropOpacity: 8 }
const ME = { nickname: 'Ada', avatarId: 13, score: 14200, rank: 3, playerCount: 42, correctCount: 12, totalQuestions: 15, bestStreak: 5, teamName: 'Crimson' }
const isPng = (buf) => buf.subarray(1, 4).toString() === 'PNG'
// sanitizeCard only keeps a background that lives in this quiz's folder, so the path has to be shaped like a real
// upload for the picture to reach the renderer at all. Its own name, not QUIZ's: QUIZ is the quiz record and passing
// it as an id would quietly drop the background and leave the picture test comparing three identical blank cards.
const UPLOAD_QUIZ = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const WIDE_PATH = `${UPLOAD_QUIZ}/33333333-3333-4333-8333-333333333333-1700000000000.jpg`

describe('the card backdrop', () => {
  // A pattern added to THEME_PATTERNS with no branch in this renderer would draw nothing and still produce a perfectly
  // valid png, so the check is on the pixels. The baseline is 'none', which by definition draws no pattern at all: a card
  // that still differs from it drew something, and one that matches it drew nothing.
  //
  // Only the backdrop is painted, not the whole card. Rendering thirty cards to ask a question about the bottom layer
  // means rendering a React character tree thirty times, which is minutes of suite time for nothing.
  const backdrop = async (card, theme = THEME, loadBackground = async () => null) => {
    const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT)
    ensureFonts()
    await drawBackdrop(canvas.getContext('2d'), sanitizeCard(card, { quizId: UPLOAD_QUIZ }), theme, undefined, loadBackground)
    return canvas.getContext('2d').getImageData(0, 0, CARD_WIDTH, CARD_HEIGHT).data
  }
  // A wide, two-toned picture, because it is what separates the three fits. Wide: a square picture makes 'cover' and
  // 'stretch' identical and a tall one makes 'contain' and 'cover' identical. Two-toned: on a flat colour there is
  // nothing to stretch, so 'cover' and 'stretch' come out pixel-identical and the test would pass on a card that
  // ignored the setting.
  const widePicture = async () => {
    const source = createCanvas(1600, 400)
    const pen = source.getContext('2d')
    pen.fillStyle = '#ff0000'
    pen.fillRect(0, 0, 800, 400)
    pen.fillStyle = '#0000ff'
    pen.fillRect(800, 0, 800, 400)
    return source.toBuffer('image/png')
  }
  // How many sampled pixels the pattern moved. A count rather than a yes/no because one antialiased stray would satisfy
  // a "differs" check on a backdrop that drew a single smudge in the corner — which is the failure worth catching, and
  // the one the original one-pixel test would have passed.
  const ink = (a, b) => {
    let n = 0
    for (let i = 0; i < a.length; i += 4 * 31) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++
    return n
  }
  const differs = (a, b) => ink(a, b) > 0

  it('draws something for every pattern, rather than leaving the card flat', async () => {
    const blank = await backdrop({ ...DEFAULT_CARD, pattern: 'none' })
    for (const pattern of Object.keys(THEME_PATTERNS)) {
      // 'image' and 'none' have nothing to draw by design — one paints a photograph, the other nothing.
      if (PATTERN_UNDRAWN.includes(pattern)) continue
      expect(ink(await backdrop({ ...DEFAULT_CARD, pattern }), blank), `${pattern} drew nothing`).toBeGreaterThan(9)
    }
  }, 90_000)

  it('honours the card pattern over the game\'s, and falls back to the game when the card has none', async () => {
    const game = { ...THEME, pattern: 'grid' }
    const grid = await backdrop(DEFAULT_CARD, game)
    const blank = await backdrop({ ...DEFAULT_CARD, pattern: 'none' }, game)
    expect(differs(grid, blank), 'the game pattern should have drawn').toBe(true)
    expect(differs(await backdrop({ ...DEFAULT_CARD, pattern: 'rings' }, game), grid), 'the card pattern should win').toBe(true)
    expect(differs(await backdrop({ ...DEFAULT_CARD, pattern: null }, game), grid), 'null should follow the game').toBe(false)
  }, 90_000)

  it('paints a background colour of the card\'s own instead of the scheme gradient', async () => {
    const plain = await backdrop(DEFAULT_CARD)
    expect(differs(await backdrop({ ...DEFAULT_CARD, backgroundColor: '#3b0764' }), plain)).toBe(true)
    // And two different colours of the admin's own are told apart, so the control is not painting one fixed answer.
    expect(differs(await backdrop({ ...DEFAULT_CARD, backgroundColor: '#1a1a1a' }), await backdrop({ ...DEFAULT_CARD, backgroundColor: '#3b0764' }))).toBe(true)
  }, 90_000)

  it('draws an uploaded picture the way the fit control asks, rather than always cropping it', async () => {
    // A wide picture is the case that separates the three: 'contain' leaves background at the top and bottom, 'cover'
    // crops the sides away, and 'stretch' fills all four corners. If the card ignored fit, all three would be identical
    // bytes and the admin's crop choice would change on every device but the card.
    const wide = await widePicture()
    const painted = (fit) => backdrop({ ...DEFAULT_CARD, background: WIDE_PATH }, { ...THEME, backdropFit: fit }, async () => wide)
    const cover = await painted('cover')
    const contain = await painted('contain')
    const stretch = await painted('stretch')
    expect(ink(cover, contain)).toBeGreaterThan(9)
    expect(ink(stretch, cover)).toBeGreaterThan(9)
    // 'contain' is the one that leaves the card's own background showing, so its corner has to match the unpainted card.
    expect(contain[0]).toBe((await backdrop(DEFAULT_CARD, THEME))[0])
  }, 90_000)

  it('reacts to size and strength, which used to be dead on the server', async () => {
    for (const pattern of ['dots', 'grid', 'hexagons', 'stripes', 'party', 'math', 'rings']) {
      const at = { ...THEME, pattern, backdropOpacity: 40 }
      expect(differs(await backdrop(DEFAULT_CARD, { ...at, backdropScale: 175 }), await backdrop(DEFAULT_CARD, at)), pattern).toBe(true)
    }
  }, 120_000)

  it('reacts to blur, on its own test because a full-canvas blur is slow enough to be its own budget', async () => {
    expect(differs(await backdrop(DEFAULT_CARD, { ...THEME, pattern: 'dots', backdropBlur: 8 }), await backdrop(DEFAULT_CARD, { ...THEME, pattern: 'dots' }))).toBe(true)
  }, 120_000)
})

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

// A board card twice ran its last row through the NAMMES mark: once with a full table, and again once team
// standings took space the row cap did not account for. Nothing about the returned buffer shows either, so the
// layout is checked through the same helper the renderer uses.
describe('the board card layout', () => {
  it('keeps the last row and its summary line clear of the footer', () => {
    const from = 850
    const rows = rowsThatFit(from)
    expect(rows).toBeGreaterThan(0)
    const lastRow = from + (rows - 1) * 78
    expect(FOOTER_TOP - (lastRow + 78 + 16)).toBeGreaterThan(40)
  })

  it('gives fewer rows when the teams have already had theirs', () => {
    // Six teams push the rows down by the heading, six rows and a gap, which is what broke it before.
    const teamsBottom = 850 + 52 + 6 * 72 + 12
    expect(rowsThatFit(teamsBottom)).toBeLessThan(rowsThatFit(850))
  })

  it('never returns a negative row count, however far down the rows start', () => {
    expect(rowsThatFit(FOOTER_TOP + 500)).toBe(0)
  })

  it('caps the rows so the tail is summarised rather than drawn', async () => {
    const many = Array.from({ length: 150 }, (_, i) => ({ rank: i + 1, nickname: `P${i}`, avatarId: i % 50, score: 1000 - i }))
    const png = await renderBoardCard({ card: DEFAULT_CARD, theme: THEME, quiz: QUIZ, ranked: many, teams: [] })
    expect(isPng(png)).toBe(true)
    expect(many.length).toBeGreaterThan(rowsThatFit(850) + 3)
  })
})

// The podium was drawn at hardcoded x values (120/300/480, every block 200 wide). On a 1080 card that put the
// group at 120..680 — 140px left of centre — and left 180px between block centres while a nickname could be drawn
// 190px wide, so neighbouring names overlapped into one unreadable run. Nothing in the returned buffer shows
// either, so the geometry is checked through the same helper the renderer uses.
describe('the podium layout', () => {
  const blocks = podiumLayout()

  it('centres the whole group on the card', () => {
    const left = Math.min(...blocks.map((b) => b.x))
    const right = Math.max(...blocks.map((b) => b.x + b.width))
    expect((left + right) / 2).toBeCloseTo(CARD_WIDTH / 2, 5)
  })

  it('puts the winner in the middle block, tallest', () => {
    const middle = blocks[1]
    expect(middle.place).toBe(1)
    expect(middle.height).toBe(Math.max(...blocks.map((b) => b.height)))
    expect(blocks.map((b) => b.place)).toEqual([2, 1, 3])
  })

  it('leaves a real gap between blocks rather than butting them together', () => {
    for (let i = 1; i < blocks.length; i += 1) {
      expect(blocks[i].x - (blocks[i - 1].x + blocks[i - 1].width)).toBeGreaterThan(0)
    }
  })

  it('gives a nickname less room than the distance to the next centre, so two names cannot overlap', () => {
    const spacing = blocks[1].centre - blocks[0].centre
    expect(PODIUM_TEXT_WIDTH).toBeLessThan(spacing)
  })

  it('keeps every block on the card', () => {
    for (const b of blocks) {
      expect(b.x).toBeGreaterThanOrEqual(0)
      expect(b.x + b.width).toBeLessThanOrEqual(CARD_WIDTH)
    }
  })

  it('stands every block on the same baseline, which is what makes it a podium', () => {
    for (const b of blocks) expect(b.top + b.height).toBe(blocks[0].top + blocks[0].height)
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
    // This names the exceptions rather than asserting an exact list, so adding a look does not fail the test.
    const legible = Object.entries(THEME_LOOKS).filter(([, look]) => contrastRatio(look.accent, look.deep[1]) >= 3)
    expect(legible.map(([id]) => id)).toEqual(expect.arrayContaining(['classic']))
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