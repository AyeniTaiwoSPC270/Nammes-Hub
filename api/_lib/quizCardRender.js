import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { characterSvg } from './characterSvg.js'
import { sanitizeCard } from './quizCard.js'
import { sanitizeTheme, contrastRatio, THEME_LOOKS } from './quizTheme.js'

// The result cards: one shared 1080x1920 story layout per variant, drawn with @napi-rs/canvas exactly the way
// api/_lib/awardCardRender.js draws the award cards. Like that file, this is server-only: it reads node:path and
// pulls in Character.jsx through characterSvg.js, so nothing in src/ may import it.

// 1080x1920 is the story format: it is what Instagram and WhatsApp status both crop to without losing the middle.
export const CARD_WIDTH = 1080
export const CARD_HEIGHT = 1920

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let fontsRegistered = false
function ensureFonts() {
  if (fontsRegistered) return
  GlobalFonts.registerFromPath(path.join(__dirname, 'fonts/PlayfairDisplay-Bold.ttf'), 'Playfair Display')
  GlobalFonts.registerFromPath(path.join(__dirname, 'fonts/PublicSans-Regular.ttf'), 'Public Sans')
  GlobalFonts.registerFromPath(path.join(__dirname, 'fonts/PublicSans-Bold.ttf'), 'Public Sans Bold')
  // The maths backdrop needs glyphs the two Public Sans faces do not carry (pi, sigma, root, infinity).
  GlobalFonts.registerFromPath(path.join(__dirname, 'fonts/DejaVuSans.ttf'), 'DejaVu Sans')
  GlobalFonts.registerFromPath(path.join(__dirname, 'fonts/DejaVuSans-Bold.ttf'), 'DejaVu Sans Bold')
  fontsRegistered = true
}

const GOLD = '#e9b64f'
const GOLD_LIGHT = '#f7dfa0'
const SILVER = '#c7ccd1'
const BRONZE = '#b07a3c'
const QUIZ_GLYPHS = ['π', 'Σ', '∫', '√', 'Δ', 'λ', 'θ', '∞', '≈', '±']

// Rows stop short of the footer rather than being counted from the top: a 150-player game used to run the last row
// straight through the NAMMES mark, and push the "and N more" line off the bottom of the canvas where nobody could
// read it.
const ROW_TOP = 850
const ROW_HEIGHT = 78
const ROWS_DRAWN = 11
// Where the footer rule sits, which is the floor every row has to stay above.
export const FOOTER_TOP = CARD_HEIGHT - 110

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Shrinks the type until it fits the box, so a 20-character nickname never runs off the card.
function fittedFont(ctx, text, maxWidth, startSize, family = 'Public Sans Bold') {
  let size = startSize
  ctx.font = `bold ${size}px "${family}"`
  while (ctx.measureText(text).width > maxWidth && size > 24) {
    size -= 4
    ctx.font = `bold ${size}px "${family}"`
  }
  return size
}

// The card's palette: the studio's own choice first, then the theme's accent, then the look's own accent. The same
// precedence themeAccent uses, so a card never disagrees with the screens it was shared from.
function palette(card, theme) {
  const t = sanitizeTheme(theme)
  const look = THEME_LOOKS[t.look]
  const accent = card.accent ?? t.accent ?? look.accent
  // Several looks are close in tone to their own background (mono grey on near-black, forest green on dark green),
  // and the live screens never notice because they put white text *on* an accent. The card does the opposite, so it
  // has to check: an accent too close to the background falls back to white rather than rendering a muddy score.
  const onBackground = contrastRatio(accent, look.deep[1]) >= 3 ? accent : '#ffffff'
  return { accent, onBackground, deepA: look.deep[0], deepB: look.deep[1] }
}

// Injected by the endpoint so that only the endpoint reaches the network, and tests never do.
let backgroundLoader = async () => null
export function setBackgroundLoader(fn) { backgroundLoader = fn }

async function drawBackdrop(ctx, card, theme, colors) {
  const t = sanitizeTheme(theme)
  const bg = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT)
  bg.addColorStop(0, colors.deepA)
  bg.addColorStop(1, colors.deepB)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  // A background picture replaces the pattern rather than sitting under it: two busy layers read as noise.
  const buffer = card.background ? await backgroundLoader(card.background) : null
  if (buffer) {
    try {
      const image = await loadImage(buffer)
      const scale = Math.max(CARD_WIDTH / image.width, CARD_HEIGHT / image.height)
      ctx.save()
      ctx.globalAlpha = 0.45
      ctx.drawImage(image, (CARD_WIDTH - image.width * scale) / 2, (CARD_HEIGHT - image.height * scale) / 2, image.width * scale, image.height * scale)
      ctx.restore()
      return
    } catch {
      // A picture that will not decode falls through to the pattern: a card must still render.
    }
  }

  // The pattern is drawn faint, the way QuizBackdrop draws it behind the live screens.
  ctx.save()
  ctx.globalAlpha = Math.max(0.04, t.backdropOpacity / 100)
  ctx.fillStyle = colors.accent
  ctx.font = 'bold 64px "DejaVu Sans"'
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 10; col++) {
      ctx.fillText(QUIZ_GLYPHS[(row * 7 + col * 3) % QUIZ_GLYPHS.length], col * 130 + (row % 2 ? 65 : 0) - 20, row * 130 + 40)
    }
  }
  ctx.restore()
}

async function drawCharacter(ctx, avatarId, cx, cy, size, mood = 'happy') {
  const image = await loadImage(Buffer.from(characterSvg(avatarId, { mood, size })))
  ctx.drawImage(image, cx - size / 2, cy - size / 2, size, size)
}

// Rank 1 gets a drawn gold band. The emoji medals the live screens use have no glyphs in the bundled fonts, so they
// would render as nothing at all on a canvas.
function drawRankBand(ctx, rank, cx, cy, width) {
  const colors = rank === 1 ? [GOLD_LIGHT, GOLD, '#a9781f']
    : rank === 2 ? ['#eef1f3', SILVER, '#8d949b']
    : ['#f0d9c2', BRONZE, '#7d5227']
  const grad = ctx.createLinearGradient(cx - width / 2, cy, cx + width / 2, cy)
  grad.addColorStop(0, colors[0])
  grad.addColorStop(0.45, colors[1])
  grad.addColorStop(1, colors[2])
  ctx.fillStyle = grad
  roundRect(ctx, cx - width / 2, cy - 34, width, 68, 12)
  ctx.fill()
}

function drawFooter(ctx, colors) {
  ctx.strokeStyle = colors.accent
  ctx.globalAlpha = 0.5
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(CARD_WIDTH / 2 - 160, FOOTER_TOP)
  ctx.lineTo(CARD_WIDTH / 2 + 160, FOOTER_TOP)
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = 'bold 30px "Public Sans Bold"'
  ctx.textAlign = 'center'
  ctx.fillText('NAMMES HUB', CARD_WIDTH / 2, CARD_HEIGHT - 60)
}

export async function renderPersonalCard({ card, theme, quiz, me }) {
  ensureFonts()
  const c = sanitizeCard(card)
  const t = sanitizeTheme(theme)
  const colors = palette(c, t)
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT)
  const ctx = canvas.getContext('2d')

  await drawBackdrop(ctx, c, t, colors)
  ctx.textAlign = 'center'

  if (c.showTitle && quiz?.title) {
    ctx.fillStyle = 'rgba(255,255,255,0.72)'
    fittedFont(ctx, quiz.title, CARD_WIDTH - 160, 40, 'Public Sans')
    ctx.fillText(quiz.title, CARD_WIDTH / 2, 150)
  }

  if (c.showCharacter) {
    // Podium players get the dancing character, everyone else the plain happy face.
    await drawCharacter(ctx, me.avatarId, CARD_WIDTH / 2, 620, 460, me.rank && me.rank <= 3 ? 'dance' : 'happy')
  }

  // The one big line on the card.
  ctx.fillStyle = '#ffffff'
  fittedFont(ctx, me.nickname, CARD_WIDTH - 120, 96, 'Playfair Display')
  ctx.fillText(me.nickname, CARD_WIDTH / 2, 960)

  // Rank when there is one. Practice has none, so no band is drawn at all rather than an empty one.
  const hasRank = Boolean(c.showPlacement && me.rank)
  if (hasRank) {
    drawRankBand(ctx, me.rank, CARD_WIDTH / 2, 1060, 460)
    ctx.fillStyle = me.rank === 1 ? '#3a2a06' : '#ffffff'
    ctx.font = 'bold 52px "Public Sans Bold"'
    ctx.fillText(me.rank === 1 ? '#1 CROWNED' : `#${me.rank}`, CARD_WIDTH / 2, 1078)
  }

  ctx.fillStyle = colors.onBackground
  ctx.font = 'bold 92px "Public Sans Bold"'
  ctx.fillText(String(me.score), CARD_WIDTH / 2, hasRank ? 1230 : 1120)
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = '34px "Public Sans"'
  ctx.fillText('points', CARD_WIDTH / 2, (hasRank ? 1230 : 1120) + 48)

  const lines = []
  if (hasRank && me.playerCount) lines.push(`Placed ${me.rank} of ${me.playerCount}`)
  if (c.showTeam && me.teamName) lines.push(me.teamName)
  if (c.showAccuracy && me.correctCount !== null && me.correctCount !== undefined) {
    lines.push(`${me.correctCount} of ${me.totalQuestions} correct`)
  }
  if (c.showStreak && me.bestStreak) lines.push(`Best streak ${me.bestStreak}`)

  let y = hasRank ? 1380 : 1270
  for (const line of lines) {
    ctx.fillStyle = 'rgba(255,255,255,0.82)'
    ctx.font = '40px "Public Sans"'
    ctx.fillText(line, CARD_WIDTH / 2, y)
    y += 62
  }

  drawFooter(ctx, colors)
  return canvas.toBuffer('image/png')
}

export async function renderBoardCard({ card, theme, quiz, ranked, teams }) {
  ensureFonts()
  const c = sanitizeCard(card)
  const t = sanitizeTheme(theme)
  const colors = palette(c, t)
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT)
  const ctx = canvas.getContext('2d')
  const rows = ranked ?? []

  await drawBackdrop(ctx, c, t, colors)
  ctx.textAlign = 'center'

  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.font = '36px "Public Sans"'
  ctx.fillText(quiz?.title ?? 'Quiz results', CARD_WIDTH / 2, 140)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 72px "Playfair Display"'
  ctx.fillText('Final results', CARD_WIDTH / 2, 230)

  // Podium three, tallest in the middle, matching the projector's FinishedScreen ordering.
  const podium = [[1, 300, 190], [2, 120, 150], [3, 480, 130]]
  for (const [place, x, height] of podium) {
    const p = rows[place - 1]
    ctx.fillStyle = place === 1 ? colors.accent : 'rgba(255,255,255,0.14)'
    roundRect(ctx, x, 700 - height, 200, height, 16)
    ctx.fill()
    ctx.fillStyle = place === 1 ? '#ffffff' : 'rgba(255,255,255,0.8)'
    ctx.font = 'bold 72px "Public Sans Bold"'
    ctx.textAlign = 'center'
    ctx.fillText(String(place), x + 100, 700 - 24)
    if (!p) continue
    await drawCharacter(ctx, p.avatarId, x + 100, 700 - height - 100, 160, place === 1 ? 'dance' : 'happy')
    ctx.fillStyle = '#ffffff'
    fittedFont(ctx, p.nickname, 190, 34)
    ctx.fillText(p.nickname, x + 100, 740)
    ctx.font = 'bold 30px "Public Sans Bold"'
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillText(String(p.score), x + 100, 782)
  }

  // Team standings take the space a board card has for them, and push the rows down to match.
  let y = ROW_TOP
  if (teams?.length) {
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.font = 'bold 34px "Public Sans Bold"'
    ctx.fillText('Teams', CARD_WIDTH / 2, y + 10)
    y += 52
    for (const team of teams.slice(0, 6)) {
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      roundRect(ctx, 80, y - 40, CARD_WIDTH - 160, 64, 14)
      ctx.fill()
      ctx.textAlign = 'left'
      if (team.color) {
        ctx.fillStyle = team.color
        roundRect(ctx, 100, y - 28, 20, 40, 6)
        ctx.fill()
      }
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 34px "Public Sans Bold"'
      fittedFont(ctx, team.name ?? '', 700, 34)
      ctx.fillText(team.name ?? '', 140, y)
ctx.textAlign = 'right'
    ctx.fillStyle = colors.onBackground
    ctx.fillText(String(team.score ?? ''), CARD_WIDTH - 110, y)
      ctx.textAlign = 'center'
      y += 72
    }
    y += 12
  }

  // Everyone below the podium as rows, capped so a 150-player game still fits above the footer.
  const rest = rows.slice(3)
  const shown = rest.slice(0, ROWS_DRAWN)
  for (const p of shown) {
    ctx.fillStyle = 'rgba(255,255,255,0.10)'
    roundRect(ctx, 80, y - 44, CARD_WIDTH - 160, 68, 14)
    ctx.fill()
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.font = 'bold 32px "Public Sans Bold"'
    ctx.fillText(String(p.rank), 110, y)
    await drawCharacter(ctx, p.avatarId, 210, y - 10, 52, 'happy')
    ctx.fillStyle = '#ffffff'
    fittedFont(ctx, p.nickname, 520, 34)
    ctx.fillText(p.nickname, 280, y)
    ctx.textAlign = 'right'
    ctx.fillStyle = colors.onBackground
    ctx.font = 'bold 36px "Public Sans Bold"'
    ctx.fillText(String(p.score), CARD_WIDTH - 110, y)
    ctx.textAlign = 'center'
    y += ROW_HEIGHT
  }
  if (rest.length > shown.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.font = '34px "Public Sans"'
    ctx.fillText(`and ${rest.length - shown.length} more`, CARD_WIDTH / 2, y + 16)
  }

  drawFooter(ctx, colors)
  return canvas.toBuffer('image/png')
}

export async function renderDuelCard({ card, theme, quiz, sides, winnerSlot, forfeit, questionCount }) {
  ensureFonts()
  const c = sanitizeCard(card)
  const t = sanitizeTheme(theme)
  const colors = palette(c, t)
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT)
  const ctx = canvas.getContext('2d')

  await drawBackdrop(ctx, c, t, colors)
  ctx.textAlign = 'center'

  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.font = '36px "Public Sans"'
  ctx.fillText(quiz?.title ?? 'Quiz duel', CARD_WIDTH / 2, 190)

  ctx.fillStyle = colors.accent
  ctx.font = 'bold 76px "Playfair Display"'
  ctx.fillText(forfeit ? 'Forfeit' : winnerSlot ? 'Winner' : 'A draw', CARD_WIDTH / 2, 320)

  // Slot a is always the left column, so the same battle always draws the same way for both players.
  const ordered = [...(sides ?? [])].sort((x, y) => (x.slot === 'a' ? -1 : 1))
  for (let i = 0; i < Math.min(ordered.length, 2); i++) {
    const s = ordered[i]
    const cx = i === 0 ? 290 : 790
    const won = winnerSlot === s.slot
    await drawCharacter(ctx, s.avatarId, cx, 800, 420, won ? 'dance' : 'happy')
    ctx.fillStyle = '#ffffff'
    fittedFont(ctx, s.nickname, 380, 56)
    ctx.fillText(s.nickname, cx, 1110)
    ctx.fillStyle = won ? GOLD : 'rgba(255,255,255,0.85)'
    ctx.font = 'bold 86px "Public Sans Bold"'
    ctx.fillText(String(s.score), cx, 1220)
  }

  // A duel carries three facts, so the lower half would otherwise be empty: the question count sits low and a rule
  // separates the two sides from it.
  ctx.strokeStyle = colors.accent
  ctx.globalAlpha = 0.4
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(200, 1380)
  ctx.lineTo(CARD_WIDTH - 200, 1380)
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = '40px "Public Sans"'
  ctx.fillText(`${questionCount} questions`, CARD_WIDTH / 2, 1460)

  drawFooter(ctx, colors)
  return canvas.toBuffer('image/png')
}