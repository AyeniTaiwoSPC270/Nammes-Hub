import { createCanvas, loadImage, Path2D } from '@napi-rs/canvas'
import { characterSvg } from './characterSvg.js'
import { sanitizeCard } from './quizCard.js'
import { sanitizeTheme, contrastRatio, THEME_LOOKS, PATTERN_GLYPHS, PATTERN_GEOMETRY } from './quizTheme.js'
import { ensureFonts } from './fonts.js'

// The result cards: one shared 1080x1920 story layout per variant, drawn with @napi-rs/canvas exactly the way
// api/_lib/awardCardRender.js draws the award cards. Like that file, this is server-only: it reads node:path and
// pulls in Character.jsx through characterSvg.js, so nothing in src/ may import it.

// 1080x1920 is the story format: it is what Instagram and WhatsApp status both crop to without losing the middle.
export const CARD_WIDTH = 1080
export const CARD_HEIGHT = 1920

const GOLD = '#e9b64f'
const GOLD_LIGHT = '#f7dfa0'
const SILVER = '#c7ccd1'
const BRONZE = '#b07a3c'

export const FOOTER_TOP = CARD_HEIGHT - 110
const ROW_TOP = 850
const ROW_HEIGHT = 78
// Room left below the last row for the "and N more" line and its descenders, so a full board never sits on the footer
// rule. Measured, not guessed: with a smaller margin the summary line's descenders touched the rule.
const ROWS_FLOOR_MARGIN = 110
// Team standings take space the rows then do not get, so the row count has to be worked out from where the rows
// actually start rather than fixed once at the top. A 150-player team game overran the footer until this did.
const TEAMS_HEADING = 52
const TEAM_ROW = 72
const TEAMS_GAP = 12
const MAX_TEAMS = 6

const PODIUM_BASE = 700
const PODIUM_WIDTH = 260
const PODIUM_GAP = 24
// A nickname is drawn centred on its own block, so its budget has to stay under the centre-to-centre distance
// (PODIUM_WIDTH + PODIUM_GAP) or two names overlap. It used to be 190 against a 180 spacing.
const PODIUM_NAME_WIDTH = 240

// Where the three podium blocks sit, left to right, derived from the card width rather than written out by hand.
// The hand-written version put them at 120/300/480: the group then spanned 120..680 on a 1080 card, so it sat
// 140px left of centre, and the 180px spacing was narrower than the 190px a nickname could occupy, which is why
// "Bisi_PrimeMide_DeltaMusa_Root" ran together. The renderer and its test both call this, so the geometry cannot
// drift from the layout the way a constant duplicated in a test can.
export function podiumLayout() {
  const step = PODIUM_WIDTH + PODIUM_GAP
  const left = (CARD_WIDTH - (3 * PODIUM_WIDTH + 2 * PODIUM_GAP)) / 2
  return [
    { place: 2, x: left, height: 150 },
    { place: 1, x: left + step, height: 190 },
    { place: 3, x: left + 2 * step, height: 130 },
  ].map(({ place, x, height }) => ({ place, x, width: PODIUM_WIDTH, height, centre: x + PODIUM_WIDTH / 2, top: PODIUM_BASE - height }))
}

// The widest a podium nickname may be drawn before it can reach into the next block.
export const PODIUM_TEXT_WIDTH = PODIUM_NAME_WIDTH

// How many rows fit above the footer from this starting point. The renderer and its test both call this, so the cap
// cannot drift from the layout the way a constant duplicated in a test can.
export function rowsThatFit(from) {
  return Math.max(0, Math.floor((FOOTER_TOP - ROWS_FLOOR_MARGIN - from) / ROW_HEIGHT))
}

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
// Sets ctx.font to the largest size at which the text fits maxWidth. Callers draw immediately afterwards; the
// contract is the ctx.font it leaves behind, so nothing is returned.
function fitFont(ctx, text, maxWidth, startSize, family = 'Public Sans Bold') {
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
//
// Three sources for the background, in order: the card tab's own colour, then the banner the screens are using, then the
// scheme's. A shareable image that shows a different gradient to the room is the defect that middle step removes.
//
// A colour of the admin's own replaces both ends of the gradient, which flattens the fill. The contrast check
// then runs against *that* colour rather than the scheme's, so an accent that would be muddy on it still falls back to
// white instead of printing an unreadable score.
export function palette(card, theme) {
  const t = sanitizeTheme(theme)
  const look = THEME_LOOKS[t.look]
  const accent = card.accent ?? t.accent ?? look.accent
  const flat = card.backgroundColor ?? null
  const deepA = flat ?? t.deepA ?? look.deep[0]
  const deepB = flat ?? t.deepB ?? look.deep[1]
  // Several looks are close in tone to their own background (mono grey on near-black, forest green on dark green),
  // and the live screens never notice because they put white text *on* an accent. The card does the opposite, so it
  // has to check: an accent too close to the background falls back to white rather than rendering a muddy score.
  const onBackground = contrastRatio(accent, deepB) >= 3 ? accent : '#ffffff'
  return { accent, onBackground, deepA, deepB }
}

// Passed in rather than held in module state: a serverless instance is reused across requests, so a module-level
// loader set inside the request handler is a cross-request race. Only the endpoint reaches the network; tests pass
// their own and never do.
const NO_BACKGROUND = async () => null

// The card is 1080x1920 and the screens are a browser window, so a pattern's measurements are scaled rather than copied:
// the shared table holds the proportions in the browser's reference pixels, and this is the factor that turns them into
// card pixels. Derived from the width so a pattern added later needs no second constant here.
const CARD_UNIT = CARD_WIDTH / 1080

function scatter(count, cell, unit) {
  return Array.from({ length: count }, (_, i) => ({
    left: ((i * cell + 8) % 92) / 100,
    top: ((i * cell * 1.4 + 5) % 90) / 100,
    size: 28 + ((i * 17) % 44),
    rotate: ((i * 41) % 50) - 25,
  })).map((p) => ({ ...p, x: p.left * CARD_WIDTH, y: p.top * CARD_HEIGHT, size: p.size * unit }))
}

// Exported so a test can paint the backdrop on its own canvas. Rendering a whole card to check that a pattern draws
// something means rendering a React character tree thirty times over, which is minutes of suite time for a question that
// is only about the bottom layer.
export async function drawBackdrop(ctx, card, theme, colors = palette(card, theme), loadBackground = NO_BACKGROUND) {
  const t = sanitizeTheme(theme)
  const flat = card.backgroundColor ?? null
  if (flat) {
    ctx.fillStyle = flat
  } else {
    const bg = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT)
    bg.addColorStop(0, colors.deepA)
    bg.addColorStop(1, colors.deepB)
    ctx.fillStyle = bg
  }
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  // A background picture replaces the pattern rather than sitting under it: two busy layers read as noise.
  const buffer = card.background ? await loadBackground(card.background) : null
  if (buffer) {
    try {
      const image = await loadImage(buffer)
      ctx.save()
      ctx.globalAlpha = 0.45 * (1 - t.backdropDim / 100)
      // BackdropFit scales the picture to meet the card's edges: "cover" fills and crops, "contain" shows the whole
      // picture and leaves the background in the gaps, "stretch" fills and distorts. The default, "cover", matches the
      // browser (CSS object-cover) and keeps the admin's crop choice from changing between device and card.
      const w = image.width
      const h = image.height
      const fit = t.backdropFit ?? 'cover'
      let sx = w, sy = h, dx = 0, dy = 0
      if (fit === 'stretch') {
        sx = CARD_WIDTH
        sy = CARD_HEIGHT
      } else if (fit === 'contain') {
        const scale = Math.min(CARD_WIDTH / w, CARD_HEIGHT / h)
        sx = w * scale
        sy = h * scale
        dx = (CARD_WIDTH - sx) / 2
        dy = (CARD_HEIGHT - sy) / 2
      } else {
        const scale = Math.max(CARD_WIDTH / w, CARD_HEIGHT / h)
        sx = w * scale
        sy = h * scale
        dx = (CARD_WIDTH - sx) / 2
        dy = (CARD_HEIGHT - sy) / 2
      }
      ctx.drawImage(image, dx, dy, sx, sy)
      ctx.restore()
      return
    } catch {
      // A picture that will not decode falls through to the pattern: a card must still render.
    }
  }

  drawPattern(ctx, card, t, colors)
}

// The card's own pattern wins, then whatever the game is using, then maths. Drawn faint, the way QuizBackdrop draws it
// behind the live screens, and through a canvas filter so blur and dim — which were dead server-side until now — apply
// here too rather than only on the screens.
function drawPattern(ctx, card, t, colors) {
  const chosen = card.pattern ?? t.pattern ?? 'math'
  const unit = CARD_UNIT * (t.backdropScale / 100)

  // Drawn on their own layer and composited once, rather than filtering every mark as it is made. Setting ctx.filter and
  // then issuing a few thousand draw calls pushes each one through the filter pipeline: measured at over two minutes for
  // one card. Blurring the finished layer is a single filtered drawImage and costs about 13ms.
  const layer = createCanvas(CARD_WIDTH, CARD_HEIGHT)
  const pen = layer.getContext('2d')
  pen.globalAlpha = Math.max(0.04, t.backdropOpacity / 100)
  pen.strokeStyle = colors.accent
  pen.fillStyle = colors.accent
  pen.lineWidth = Math.max(1, 1.5 * unit)

  if (PATTERN_GLYPHS[chosen]) {
    // Glyph patterns tile by row rather than scatter: on a fixed grid every one of them reads as wallpaper, which is what
    // a backdrop is for, and the maths backdrop has always been drawn this way.
    const glyphs = PATTERN_GLYPHS[chosen]
    pen.font = `bold ${Math.round(64 * unit)}px "DejaVu Sans"`
    const pitch = 130 * unit
    for (let row = 0; row * pitch < CARD_HEIGHT + pitch; row++) {
      for (let col = 0; col * pitch < CARD_WIDTH + pitch; col++) {
        pen.fillText(glyphs[(row * 7 + col * 3) % glyphs.length], col * pitch + (row % 2 ? pitch / 2 : 0) - 20 * unit, row * pitch + 40 * unit)
      }
    }
    composite(ctx, layer, t)
    return
  }

  const shape = PATTERN_GEOMETRY[chosen]
  if (!shape) return

  if (chosen === 'dots') {
    const pitch = shape.cell * unit
    for (let y = 0; y * pitch < CARD_HEIGHT + pitch; y++) {
      for (let x = 0; x * pitch < CARD_WIDTH + pitch; x++) {
        pen.beginPath()
        pen.arc(x * pitch, y * pitch, shape.dot * unit, 0, Math.PI * 2)
        pen.fill()
      }
    }
  } else if (chosen === 'grid' || chosen === 'stripes') {
    const width = (chosen === 'grid' ? shape.stroke : shape.width) * unit
    const step = (chosen === 'grid' ? shape.cell : shape.width + shape.gap) * unit
    pen.save()
    if (chosen === 'stripes') {
      // Rotating about the centre is cheaper than working out which diagonal stripes cross each edge.
      pen.translate(CARD_WIDTH / 2, CARD_HEIGHT / 2)
      pen.rotate((shape.angle * Math.PI) / 180)
      const reach = Math.hypot(CARD_WIDTH, CARD_HEIGHT)
      for (let x = -reach; x < reach; x += step) pen.fillRect(x, -reach, width, reach * 2)
    } else {
      const pitch = shape.cell * unit
      for (let x = 0; x < CARD_WIDTH + pitch; x += pitch) pen.fillRect(x, 0, width, CARD_HEIGHT)
      for (let y = 0; y < CARD_HEIGHT + pitch; y += pitch) pen.fillRect(0, y, CARD_WIDTH, width)
    }
    pen.restore()
  } else if (chosen === 'waves') {
    // The same path the screens draw, repeated up the card instead of sitting in a band along the bottom edge.
    const band = shape.band * unit * 8
    const wave = new Path2D(shape.path)
    for (let y = CARD_HEIGHT - band; y > -band; y -= band) {
      pen.save()
      pen.translate(0, y)
      pen.scale(CARD_WIDTH / 720, 1)
      pen.fill(wave)
      pen.restore()
    }
  } else if (chosen === 'hexagons') {
    for (const [i, p] of scatter(shape.count, shape.cell, unit).entries()) {
      const r = shape.radius * unit
      const cx = p.x + (i % 2 ? shape.stagger * shape.cell * unit : 0)
      pen.beginPath()
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k
        const px = cx + r * Math.cos(a)
        const py = p.y + r * Math.sin(a)
        if (k === 0) pen.moveTo(px, py)
        else pen.lineTo(px, py)
      }
      pen.closePath()
      pen.stroke()
    }
  } else if (chosen === 'rings') {
    for (const p of scatter(shape.count, shape.cell, unit)) {
      for (let r = 0; r < shape.rings; r++) {
        pen.beginPath()
        pen.arc(p.x, p.y, (shape.radius + r * shape.step) * unit, 0, Math.PI * 2)
        pen.stroke()
      }
    }
  } else if (chosen === 'party') {
    drawParty(pen, shape, unit)
  }

  composite(ctx, layer, t)
}

// The blur is the whole reason the pattern gets a layer of its own; see the note in drawPattern.
function composite(ctx, layer, t) {
  if (t.backdropBlur <= 0) {
    ctx.drawImage(layer, 0, 0)
    return
  }
  ctx.save()
  ctx.filter = `blur(${t.backdropBlur * CARD_UNIT}px)`
  ctx.drawImage(layer, 0, 0)
  ctx.restore()
}

// Balloons, hats, streamers and loose confetti, in the same four-way cycle as the browser, built from the same numbers so
// the card and the screens are recognisably the same backdrop. Drawn rather than typed for the reason on
// PATTERN_GEOMETRY.party: there is no emoji font on the server.
function drawParty(ctx, shape, unit) {
  for (const [i, p] of scatter(shape.count, shape.cell, unit).entries()) {
    ctx.lineWidth = Math.max(1, shape.stroke * unit)
    if (i % 4 === 0) {
      const r = (shape.balloon + (p.size % 14)) * unit
      ctx.beginPath()
      ctx.ellipse(p.x, p.y, r, r * 1.2, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(p.x, p.y + r * 1.2)
      ctx.bezierCurveTo(p.x + r * 0.5, p.y + r * 1.2 + shape.streamer * unit, p.x - r * 0.5, p.y + r * 1.2 + shape.streamer * unit, p.x, p.y + r * 1.2 + shape.streamer * 2 * unit)
      ctx.stroke()
    } else if (i % 4 === 1) {
      const h = shape.hat * unit
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate((p.rotate * Math.PI) / 180)
      ctx.beginPath()
      ctx.moveTo(-h, h)
      ctx.lineTo(0, -h)
      ctx.lineTo(h, h)
      ctx.closePath()
      ctx.stroke()
      ctx.restore()
    } else if (i % 4 === 2) {
      const w = (shape.streamer * 1.6 + p.size) * unit
      ctx.beginPath()
      ctx.moveTo(p.x - w / 2, p.y)
      ctx.bezierCurveTo(p.x - w / 4, p.y - w / 2, p.x + w / 4, p.y + w / 2, p.x, p.y + w / 2)
      ctx.bezierCurveTo(p.x - w / 4, p.y + w / 2, p.x + w / 4, p.y + w / 2, p.x - w / 2, p.y + w * 2)
      ctx.stroke()
    } else {
      const c = shape.confetti * unit
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate((p.rotate * Math.PI) / 180)
      ctx.fillRect(-c / 2, -c / 2, c, c * 1.6)
      ctx.restore()
    }
  }
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

export async function renderPersonalCard({ card, theme, quiz, me, loadBackground = NO_BACKGROUND }) {
  ensureFonts()
  const c = sanitizeCard(card)
  const t = sanitizeTheme(theme)
  const colors = palette(c, t)
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT)
  const ctx = canvas.getContext('2d')

  await drawBackdrop(ctx, c, t, colors, loadBackground)
  ctx.textAlign = 'center'

  if (c.showTitle && quiz?.title) {
    ctx.fillStyle = 'rgba(255,255,255,0.72)'
    fitFont(ctx, quiz.title, CARD_WIDTH - 160, 40, 'Public Sans')
    ctx.fillText(quiz.title, CARD_WIDTH / 2, 150)
  }

  if (c.showCharacter) {
    // Podium players get the dancing character, everyone else the plain happy face.
    await drawCharacter(ctx, me.avatarId, CARD_WIDTH / 2, 620, 460, me.rank && me.rank <= 3 ? 'dance' : 'happy')
  }

  ctx.fillStyle = '#ffffff'
  fitFont(ctx, me.nickname, CARD_WIDTH - 120, 96, 'Playfair Display')
  ctx.fillText(me.nickname, CARD_WIDTH / 2, 960)

  // A practice run has no leaderboard, so there is no band to draw rather than an empty one.
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
  // Both numbers or neither: "3 of null correct" is worse than no line.
  if (c.showAccuracy && Number.isInteger(me.correctCount) && Number.isInteger(me.totalQuestions)) {
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

export async function renderBoardCard({ card, theme, quiz, ranked, teams, loadBackground = NO_BACKGROUND }) {
  ensureFonts()
  const c = sanitizeCard(card)
  const t = sanitizeTheme(theme)
  const colors = palette(c, t)
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT)
  const ctx = canvas.getContext('2d')
  const rows = ranked ?? []

  await drawBackdrop(ctx, c, t, colors, loadBackground)
  ctx.textAlign = 'center'

  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.font = '36px "Public Sans"'
  ctx.fillText(quiz?.title ?? 'Quiz results', CARD_WIDTH / 2, 140)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 72px "Playfair Display"'
  ctx.fillText('Final results', CARD_WIDTH / 2, 230)

  // Podium three, tallest in the middle, matching the projector's FinishedScreen ordering.
  for (const { place, x, width, height, centre, top } of podiumLayout()) {
    const p = rows[place - 1]
    ctx.fillStyle = place === 1 ? colors.accent : 'rgba(255,255,255,0.14)'
    roundRect(ctx, x, top, width, height, 16)
    ctx.fill()
    ctx.fillStyle = place === 1 ? '#ffffff' : 'rgba(255,255,255,0.8)'
    ctx.font = 'bold 72px "Public Sans Bold"'
    ctx.textAlign = 'center'
    ctx.fillText(String(place), centre, PODIUM_BASE - 24)
    if (!p) continue
    await drawCharacter(ctx, p.avatarId, centre, top - 100, 160, place === 1 ? 'dance' : 'happy')
    ctx.fillStyle = '#ffffff'
    fitFont(ctx, p.nickname, PODIUM_TEXT_WIDTH, 34)
    ctx.fillText(p.nickname, centre, 740)
    ctx.font = 'bold 30px "Public Sans Bold"'
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillText(String(p.score), centre, 782)
  }

  const shownTeams = (teams ?? []).slice(0, MAX_TEAMS)
  let y = ROW_TOP
  if (shownTeams.length) {
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.font = 'bold 34px "Public Sans Bold"'
    ctx.fillText('Teams', CARD_WIDTH / 2, y + 10)
    y += TEAMS_HEADING
    for (const team of shownTeams) {
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
      fitFont(ctx, team.name ?? '', 700, 34)
      ctx.fillText(team.name ?? '', 140, y)
      ctx.textAlign = 'right'
      ctx.fillStyle = colors.onBackground
      ctx.fillText(String(team.score ?? ''), CARD_WIDTH - 110, y)
      ctx.textAlign = 'center'
      y += TEAM_ROW
    }
    y += TEAMS_GAP
  }

  // Everyone below the podium as rows, capped to whatever is left above the footer now the teams have had theirs.
  const rest = rows.slice(3)
  const shown = rest.slice(0, rowsThatFit(y))
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
    fitFont(ctx, p.nickname, 520, 34)
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

export async function renderDuelCard({ card, theme, quiz, sides, winnerSlot, forfeit, questionCount, loadBackground = NO_BACKGROUND }) {
  ensureFonts()
  const c = sanitizeCard(card)
  const t = sanitizeTheme(theme)
  const colors = palette(c, t)
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT)
  const ctx = canvas.getContext('2d')

  await drawBackdrop(ctx, c, t, colors, loadBackground)
  ctx.textAlign = 'center'

  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.font = '36px "Public Sans"'
  ctx.fillText(quiz?.title ?? 'Quiz duel', CARD_WIDTH / 2, 190)

  ctx.fillStyle = colors.accent
  ctx.font = 'bold 76px "Playfair Display"'
  ctx.fillText(forfeit ? 'Forfeit' : winnerSlot ? 'Winner' : 'A draw', CARD_WIDTH / 2, 320)

  // Slot a is always the left column, so the same battle always draws the same way for both players.
  const ordered = [...(sides ?? [])].sort((x, y) => (x.slot === 'a' ? -1 : 1) - (y.slot === 'a' ? -1 : 1))
  for (let i = 0; i < Math.min(ordered.length, 2); i++) {
    const s = ordered[i]
    const cx = i === 0 ? 290 : 790
    const won = winnerSlot === s.slot
    await drawCharacter(ctx, s.avatarId, cx, 800, 420, won ? 'dance' : 'happy')
    ctx.fillStyle = '#ffffff'
    fitFont(ctx, s.nickname, 380, 56)
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