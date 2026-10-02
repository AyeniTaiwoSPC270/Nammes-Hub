// Flat, single-color vector glyphs — intentionally simple so they read as
// hand-built department iconography, not AI glossy 3D renders.

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function drawGridIcon(ctx, cx, cy, size, color) {
  const g = size * 0.42
  const gap = size * 0.14
  ctx.fillStyle = color
  ;[
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].forEach(([dx, dy]) => {
    const x = cx + (dx * (g + gap)) / 2 - g / 2
    const y = cy + (dy * (g + gap)) / 2 - g / 2
    roundRect(ctx, x, y, g, g, g * 0.22)
    ctx.fill()
  })
}

export function drawCalculatorIcon(ctx, cx, cy, size, color) {
  const w = size * 0.62
  const h = size * 0.86
  const x = cx - w / 2
  const y = cy - h / 2
  ctx.fillStyle = color
  roundRect(ctx, x, y, w, h, w * 0.14)
  ctx.fill()
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  roundRect(ctx, x + w * 0.14, y + h * 0.1, w * 0.72, h * 0.2, w * 0.06)
  ctx.fill()
  const cellW = w * 0.16
  const cellH = h * 0.11
  const gap = w * 0.07
  const startX = x + w * 0.16
  const startY = y + h * 0.42
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      roundRect(
        ctx,
        startX + col * (cellW + gap),
        startY + row * (cellH + gap),
        cellW,
        cellH,
        cellW * 0.25
      )
      ctx.fill()
    }
  }
  ctx.restore()
}

export function drawBookIcon(ctx, cx, cy, size, color) {
  const w = size * 0.9
  const h = size * 0.62
  const x = cx - w / 2
  const y = cy - h / 2
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = size * 0.045
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  ctx.beginPath()
  ctx.moveTo(cx, y + h * 0.16)
  ctx.quadraticCurveTo(x, y, x, y + h * 0.14)
  ctx.lineTo(x, y + h * 0.86)
  ctx.quadraticCurveTo(x, y + h, cx, y + h * 0.86)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(cx, y + h * 0.16)
  ctx.quadraticCurveTo(x + w, y, x + w, y + h * 0.14)
  ctx.lineTo(x + w, y + h * 0.86)
  ctx.quadraticCurveTo(x + w, y + h, cx, y + h * 0.86)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(cx, y + h * 0.16)
  ctx.lineTo(cx, y + h * 0.86)
  ctx.stroke()

  ctx.lineWidth = size * 0.03
  ;[0.32, 0.5].forEach((t) => {
    ctx.beginPath()
    ctx.moveTo(x + w * 0.14, y + h * t)
    ctx.lineTo(cx - w * 0.06, y + h * (t - 0.03))
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx + w * 0.06, y + h * (t - 0.03))
    ctx.lineTo(x + w * 0.86, y + h * t)
    ctx.stroke()
  })
  ctx.restore()
}

export function drawCalendarIcon(ctx, cx, cy, size, color, badge) {
  const w = size * 0.78
  const h = size * 0.78
  const x = cx - w / 2
  const y = cy - h / 2 + size * 0.04
  ctx.fillStyle = color
  roundRect(ctx, x, y, w, h, w * 0.14)
  ctx.fill()

  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  roundRect(ctx, x + w * 0.08, y + h * 0.22, w * 0.84, h * 0.1, w * 0.03)
  ctx.fill()
  const dot = w * 0.09
  const gap = w * 0.06
  const startX = x + w * 0.12
  const startY = y + h * 0.42
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      if (row === 2 && col > 1) continue
      roundRect(
        ctx,
        startX + col * (dot + gap),
        startY + row * (dot + gap),
        dot,
        dot,
        dot * 0.3
      )
      ctx.fill()
    }
  }
  ctx.restore()

  ctx.fillStyle = color
  ;[x + w * 0.24, x + w * 0.76].forEach((tabX) => {
    roundRect(ctx, tabX - w * 0.03, y - h * 0.08, w * 0.06, h * 0.16, w * 0.02)
    ctx.fill()
  })

  if (badge === 'clock') {
    const r = size * 0.19
    const bx = x + w - r * 0.4
    const by = y + h - r * 0.4
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(bx, by, r + size * 0.03, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(bx, by, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = size * 0.025
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(bx, by)
    ctx.lineTo(bx, by - r * 0.55)
    ctx.moveTo(bx, by)
    ctx.lineTo(bx + r * 0.4, by + r * 0.15)
    ctx.stroke()
  } else if (badge === 'star') {
    const r = size * 0.2
    const bx = x + w - r * 0.3
    const by = y + h - r * 0.3
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(bx, by, r + size * 0.03, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = color
    ctx.beginPath()
    for (let i = 0; i < 5; i++) {
      const outerAngle = (Math.PI * 2 * i) / 5 - Math.PI / 2
      const innerAngle = outerAngle + Math.PI / 5
      const ox = bx + Math.cos(outerAngle) * r * 0.62
      const oy = by + Math.sin(outerAngle) * r * 0.62
      const ix = bx + Math.cos(innerAngle) * r * 0.26
      const iy = by + Math.sin(innerAngle) * r * 0.26
      if (i === 0) ctx.moveTo(ox, oy)
      else ctx.lineTo(ox, oy)
      ctx.lineTo(ix, iy)
    }
    ctx.closePath()
    ctx.fill()
  }
}

export function drawBriefcaseIcon(ctx, cx, cy, size, color) {
  const w = size * 0.82
  const h = size * 0.58
  const x = cx - w / 2
  const y = cy - h / 2 + size * 0.06
  ctx.strokeStyle = color
  ctx.lineWidth = size * 0.06
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - w * 0.16, y)
  ctx.lineTo(cx - w * 0.16, y - h * 0.22)
  ctx.quadraticCurveTo(cx - w * 0.16, y - h * 0.38, cx, y - h * 0.38)
  ctx.quadraticCurveTo(cx + w * 0.16, y - h * 0.38, cx + w * 0.16, y - h * 0.22)
  ctx.lineTo(cx + w * 0.16, y)
  ctx.stroke()

  ctx.fillStyle = color
  roundRect(ctx, x, y, w, h, w * 0.1)
  ctx.fill()

  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  roundRect(ctx, x, y + h * 0.42, w, h * 0.14, 0)
  ctx.fill()
  roundRect(ctx, cx - w * 0.06, y + h * 0.34, w * 0.12, h * 0.3, w * 0.03)
  ctx.fill()
  ctx.restore()
}

export function drawMegaphoneIcon(ctx, cx, cy, size, color) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.fillStyle = color
  const w = size * 0.7
  const h = size * 0.5

  ctx.beginPath()
  ctx.moveTo(-w * 0.5, -h * 0.18)
  ctx.lineTo(-w * 0.06, -h * 0.5)
  ctx.lineTo(-w * 0.06, h * 0.5)
  ctx.lineTo(-w * 0.5, h * 0.18)
  ctx.closePath()
  ctx.fill()

  roundRect(ctx, -w * 0.62, -h * 0.18, w * 0.14, h * 0.36, w * 0.04)
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(-w * 0.06, -h * 0.5)
  ctx.quadraticCurveTo(w * 0.34, -h * 0.5, w * 0.34, 0)
  ctx.quadraticCurveTo(w * 0.34, h * 0.5, -w * 0.06, h * 0.5)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = color
  ctx.lineWidth = size * 0.045
  ctx.lineCap = 'round'
  ;[0.62, 0.82].forEach((r) => {
    ctx.beginPath()
    ctx.arc(0, 0, w * r, -0.45, 0.45)
    ctx.stroke()
  })
  ctx.restore()
}

export const ICONS = {
  grid: drawGridIcon,
  calculator: drawCalculatorIcon,
  book: drawBookIcon,
  calendar: (ctx, cx, cy, size, color) => drawCalendarIcon(ctx, cx, cy, size, color, 'clock'),
  events: (ctx, cx, cy, size, color) => drawCalendarIcon(ctx, cx, cy, size, color, 'star'),
  briefcase: drawBriefcaseIcon,
  megaphone: drawMegaphoneIcon,
}
