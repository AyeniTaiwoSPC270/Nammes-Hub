import { MONTHS, formatDay, formatDelta, percentDelta, percentLabel } from './analytics'

// The PDF is drawn, not dumped. The first version printed the numbers into tables, which answered
// "what are the figures" and none of "what does the dashboard say" — the shape of a trend and the
// proportions in a donut are the information, not decoration.
//
// Everything is vector: lines, rectangles and text. No screenshot, because html2canvas captures
// Recharts' SVG unreliably and would bake in the exporting admin's screen width and dark mode.

const COLOR = {
  forest: [11, 36, 23],
  orange: [174, 50, 0],
  orangeBright: [255, 90, 31],
  success: [28, 107, 58],
  warning: [168, 92, 0],
  danger: [186, 26, 26],
  ink: [28, 27, 27],
  muted: [66, 72, 67],
  hairline: [194, 200, 193],
  rule: [232, 229, 226],
  surface: [255, 255, 255],
  paleGreen: [226, 236, 231],
  paleNeutral: [246, 243, 242],
}

const PAGE = {
  portrait: { width: 210, height: 297, margin: 14 },
  landscape: { width: 297, height: 210, margin: 14 },
}

const FOOTER_NOTE =
  'Private to admins. Traffic counts views recorded since tracking was switched on; there is no history before that date.'

const AXIS_GUTTER = 9

// Fixed formatters for the same reason formatDay has one: `toLocaleString` renders differently on an
// en-US and an en-GB machine, and a report that changes between two printings of the same numbers
// reads as a different report.
export function formatNumber(value) {
  const n = Math.round(Number(value) || 0)
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function formatStamp(date) {
  const d = new Date(date)
  if (!Number.isFinite(d.getTime())) return ''
  const day = d.getDate()
  const month = MONTHS[d.getMonth()]
  const year = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${day} ${month} ${year}, ${hh}:${mm}`
}

// Pure: the content of the document, separated from the drawing so it can be asserted without a
// canvas. `attention` and `activity` are shaped for a printed list rather than a link.
export function analyticsPdfModel(data, generatedAt = new Date()) {
  const kpis = data.kpis
  const period =
    data.range.from && data.range.to
      ? `${formatDay(data.range.from)} – ${formatDay(data.range.to)}`
      : data.range.days === 0
        ? 'All time'
        : `Last ${data.range.days} days`

  const tiles = [
    {
      label: 'Visitors (sessions)',
      value: formatNumber(kpis.visitors.current),
      delta: formatDelta(percentDelta(kpis.visitors.current, kpis.visitors.previous)),
    },
    {
      label: 'Page views',
      value: formatNumber(kpis.views.current),
      delta: formatDelta(percentDelta(kpis.views.current, kpis.views.previous)),
    },
    {
      label: 'New members',
      value: formatNumber(kpis.signups.current),
      delta: formatDelta(percentDelta(kpis.signups.current, kpis.signups.previous)),
    },
    {
      label: 'Quiz plays',
      value: formatNumber(kpis.quizPlays.current),
      delta: formatDelta(percentDelta(kpis.quizPlays.current, kpis.quizPlays.previous)),
      note: `${formatNumber(kpis.quizPlays.players)} players`,
    },
    {
      label: 'CBT attempts',
      value: formatNumber(kpis.cbtAttempts.current),
      delta: formatDelta(percentDelta(kpis.cbtAttempts.current, kpis.cbtAttempts.previous)),
      note: `avg ${kpis.cbtAttempts.averageScore}%`,
    },
    {
      label: 'Form responses',
      value: formatNumber(kpis.formResponses.current),
      delta: formatDelta(percentDelta(kpis.formResponses.current, kpis.formResponses.previous)),
    },
    {
      label: 'Email opt-in',
      value: percentLabel(kpis.optInRate.current),
      note: `${formatNumber(kpis.optInRate.optedIn)} of ${formatNumber(kpis.optInRate.total)}`,
    },
  ]

  return {
    title: 'NAMMES Hub — Analytics',
    period,
    generatedAt: formatStamp(generatedAt),
    tiles,
    traffic: data.traffic,
    signups: data.signups,
    engagement: data.engagement,
    topContent: data.topContent.slice(0, 6),
    awards: data.awards.slice(0, 6),
    email: data.email,
    attention: [
      ['Submissions waiting', data.attention.pendingSubmissions],
      ['Edits awaiting approval', data.attention.pendingReviews],
      ['Messages unanswered', data.attention.unhandledMessages],
      ['Calendar dates TBA', data.attention.calendarTba],
      ['Emails failed to send', data.attention.failedEmails],
      ['Server errors in 24h', data.attention.errors24h],
    ],
    activity: data.activity.slice(0, 8),
    footer: FOOTER_NOTE,
  }
}

export function analyticsPdfFilename(rangeKeyValue, layout = 'portrait', generatedAt = new Date()) {
  const stamp = new Date(generatedAt).toISOString().slice(0, 10)
  const suffix = layout === 'landscape' ? 'summary' : 'report'
  return `nammes-analytics-${rangeKeyValue}-${suffix}-${stamp}.pdf`
}

// ---------- drawing helpers ----------

function setFill(doc, color) {
  doc.setFillColor(color[0], color[1], color[2])
}

function setStroke(doc, color) {
  doc.setDrawColor(color[0], color[1], color[2])
}

// Resolved once per document. registerPublicSans runs on the browser path; if it ever fails, jsPDF
// falls back to Helvetica glyph by glyph and logs a line for every string. One check instead.
let activeFont = 'PublicSans'

function resolveFont(doc) {
  try {
    return doc.getFontList?.()?.PublicSans ? 'PublicSans' : 'helvetica'
  } catch {
    return 'helvetica'
  }
}

function text(doc, value, x, y, { size = 8, color = COLOR.ink, bold = false, align = 'left' } = {}) {
  doc.setFont(activeFont, bold ? 'bold' : 'normal')
  doc.setFontSize(size)
  doc.setTextColor(color[0], color[1], color[2])
  doc.text(String(value), x, y, { align })
}

function fitLabel(value, widthMm, size) {
  // ~0.52mm per character at these sizes in Public Sans; erring short is better than a label running
  // under a bar.
  const max = Math.max(4, Math.floor(widthMm / (size * 0.19)))
  const label = String(value ?? '')
  return label.length > max ? `${label.slice(0, max - 1)}…` : label
}

// The legend lives on the note line, not under the plot: under the plot it sits on the two-line date
// labels, which is exactly how the first render came out.
function panel(doc, { x, y, w, h, title, note, legend }) {
  setFill(doc, COLOR.surface)
  setStroke(doc, COLOR.hairline)
  doc.setLineWidth(0.2)
  doc.roundedRect(x, y, w, h, 2, 2, 'FD')

  text(doc, title, x + 4, y + 9, { size: 9, color: COLOR.forest, bold: true })

  if (legend) {
    let cursor = x + 4
    for (const item of legend) {
      setFill(doc, item.color)
      doc.circle(cursor + 1, y + 12.7, 1, 'F')
      text(doc, item.label, cursor + 3.4, y + 13.8, { size: 5.5, color: COLOR.muted })
      cursor += 3.4 + item.label.length * 1.25 + 4
    }
  } else if (note) {
    text(doc, note, x + 4, y + 13.5, { size: 6.5, color: COLOR.muted })
  }

  const top = y + (note || legend ? 18 : 15)
  return { x: x + 4, y: top, w: w - 8, h: y + h - 6 - top }
}

function plotBox(box) {
  return { x: box.x + AXIS_GUTTER, y: box.y, w: Math.max(10, box.w - AXIS_GUTTER), h: box.h }
}

function gridLines(doc, plot, max, steps = 3) {
  setStroke(doc, COLOR.rule)
  doc.setLineWidth(0.15)
  for (let i = 0; i <= steps; i += 1) {
    const y = plot.y + plot.h - (plot.h * i) / steps
    doc.line(plot.x, y, plot.x + plot.w, y)
    text(doc, formatNumber((max * i) / steps), plot.x - 1.5, y + 1, {
      size: 5.5,
      color: COLOR.muted,
      align: 'right',
    })
  }
}

function drawXLabels(doc, plot, rows) {
  const every = Math.max(1, Math.ceil(rows.length / 6))
  rows.forEach((row, i) => {
    if (i % every !== 0 && i !== rows.length - 1) return
    const x = plot.x + (plot.w * (i + 0.5)) / rows.length
    const [day, month] = formatDay(row.day).split(' ')
    doc.text(day, x, plot.y + plot.h + 3, { align: 'center' })
    doc.text(month, x, plot.y + plot.h + 5.4, { align: 'center' })
  })
}

function areaChart(doc, box, rows, series) {
  const plot = plotBox(box)
  const max = Math.max(1, ...rows.flatMap((r) => series.map((s) => r[s.key] ?? 0)))
  gridLines(doc, plot, max)
  if (!rows.length) return

  const step = plot.w / rows.length
  const bottom = plot.y + plot.h
  const point = (row, i, key) => [plot.x + step * (i + 0.5), bottom - ((row[key] ?? 0) / max) * plot.h]

  for (const s of series) {
    if (s.fill) {
      const points = rows.map((row, i) => point(row, i, s.key))
      const deltas = points.slice(1).map((p, i) => [p[0] - points[i][0], p[1] - points[i][1]])
      // Down to the baseline, back along it, and closed: a polygon, not a row of strips. The strips
      // read as a barcode because each one left a gap.
      deltas.push([0, bottom - points[points.length - 1][1]])
      deltas.push([points[0][0] - points[points.length - 1][0], 0])
      setFill(doc, s.fill)
      doc.lines(deltas, points[0][0], points[0][1], [1, 1], 'F', true)
    }
    setStroke(doc, s.color)
    doc.setLineWidth(0.45)
    for (let i = 1; i < rows.length; i += 1) {
      const [x1, y1] = point(rows[i - 1], i - 1, s.key)
      const [x2, y2] = point(rows[i], i, s.key)
      doc.line(x1, y1, x2, y2)
    }
  }

  drawXLabels(doc, plot, rows)
}

function barChart(doc, box, rows, key, color) {
  const plot = plotBox(box)
  const max = Math.max(1, ...rows.map((r) => r[key] ?? 0))
  gridLines(doc, plot, max)
  if (!rows.length) return

  const step = plot.w / rows.length
  const bottom = plot.y + plot.h
  setFill(doc, color)
  rows.forEach((row, i) => {
    const height = ((row[key] ?? 0) / max) * plot.h
    if (height <= 0) return
    doc.rect(plot.x + step * i + step * 0.2, bottom - height, step * 0.6, height, 'F')
  })
  drawXLabels(doc, plot, rows)
}

const ENGAGEMENT_SERIES = [
  { key: 'quiz', color: COLOR.forest },
  { key: 'practice', color: COLOR.orange },
  { key: 'cbt', color: COLOR.success },
  { key: 'forms', color: COLOR.warning },
  { key: 'battles', color: COLOR.muted },
]

function stackedChart(doc, box, rows) {
  const plot = plotBox(box)
  const max = Math.max(1, ...rows.map((r) => ENGAGEMENT_SERIES.reduce((sum, s) => sum + (r[s.key] ?? 0), 0)))
  gridLines(doc, plot, max)
  if (!rows.length) return

  const step = plot.w / rows.length
  const bottom = plot.y + plot.h
  rows.forEach((row, i) => {
    let cursor = bottom
    for (const s of ENGAGEMENT_SERIES) {
      const height = ((row[s.key] ?? 0) / max) * plot.h
      if (height <= 0) continue
      setFill(doc, s.color)
      doc.rect(plot.x + step * i + step * 0.2, cursor - height, step * 0.6, height, 'F')
      cursor -= height
    }
  })
  drawXLabels(doc, plot, rows)
}

const VALUE_GUTTER = 11

// Horizontal bars: the label is the information here, so it is drawn rather than replaced by a tick.
function horizontalBars(doc, box, rows, { labelKey, valueKey, color }) {
  if (!rows.length) {
    text(doc, 'Nothing recorded in this period.', box.x, box.y + 8, { size: 7, color: COLOR.muted })
    return
  }
  const max = Math.max(1, ...rows.map((r) => r[valueKey] ?? 0))
  const rowHeight = Math.min(12, box.h / rows.length)
  const labelWidth = Math.min(box.w * 0.45, 62)
  const barX = box.x + labelWidth + 2
  const barWidth = Math.max(8, box.w - labelWidth - VALUE_GUTTER)

  rows.forEach((row, i) => {
    const y = box.y + i * rowHeight
    text(doc, fitLabel(row[labelKey], labelWidth, 7), box.x, y + rowHeight * 0.66, { size: 7, color: COLOR.ink })
    setFill(doc, COLOR.rule)
    doc.rect(barX, y + rowHeight * 0.24, barWidth, rowHeight * 0.5, 'F')
    setFill(doc, color)
    doc.rect(barX, y + rowHeight * 0.24, (barWidth * (row[valueKey] ?? 0)) / max, rowHeight * 0.5, 'F')
    // Outside the bar, in its own gutter: drawn at the bar's end it landed on top of the fill.
    text(doc, formatNumber(row[valueKey]), box.x + box.w, y + rowHeight * 0.66, {
      size: 7,
      color: COLOR.muted,
      align: 'right',
    })
  })
}

// A wedge fan rather than jsPDF's arc(): 'F' closes the arc path with a chord, which fills a segment
// instead of a slice. Sixty small triangles per slice is a fraction of a kilobyte and looks round.
function wedge(doc, cx, cy, radius, fromDeg, toDeg, color) {
  setFill(doc, color)
  // Stroked in its own colour as well as filled. Adjacent triangles share an edge, and an unstroked
  // fill leaves an antialiasing seam on every one of them -- which turns a two-slice donut into a
  // sunburst at print resolution.
  setStroke(doc, color)
  doc.setLineWidth(0.12)
  const steps = Math.max(2, Math.ceil(Math.abs(toDeg - fromDeg) / 4))
  const at = (deg) => [cx + radius * Math.cos((deg * Math.PI) / 180), cy + radius * Math.sin((deg * Math.PI) / 180)]
  for (let i = 0; i < steps; i += 1) {
    const [x1, y1] = at(fromDeg + ((toDeg - fromDeg) * i) / steps)
    const [x2, y2] = at(fromDeg + ((toDeg - fromDeg) * (i + 1)) / steps)
    doc.triangle(cx, cy, x1, y1, x2, y2, 'FD')
  }
}

function donut(doc, box, parts, centreValue, centreLabel) {
  const total = parts.reduce((sum, p) => sum + p.value, 0)
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  // Radius from the shorter side, and the centre text sized from the radius: at the landscape height
  // the first version drew a 25mm ring with 13pt text spilling over it.
  const radius = Math.max(8, Math.min(box.w, box.h) * 0.4)

  if (total <= 0) {
    text(doc, 'No members yet.', cx, cy, { size: 7, color: COLOR.muted, align: 'center' })
    return
  }

  setStroke(doc, COLOR.surface)
  doc.setLineWidth(0.6)
  let cursor = -90
  for (const part of parts) {
    const sweep = (part.value / total) * 360
    if (sweep <= 0) continue
    wedge(doc, cx, cy, radius, cursor, cursor + sweep, part.color)
    cursor += sweep
  }

  // The hole is the panel surface, so the ring reads as a donut without a clipping path.
  setFill(doc, COLOR.surface)
  doc.circle(cx, cy, radius * 0.6, 'F')

  text(doc, centreValue, cx, cy + radius * 0.09, {
    size: Math.max(5.5, Math.min(13, radius * 0.62)),
    color: COLOR.forest,
    bold: true,
    align: 'center',
  })
  text(doc, centreLabel, cx, cy + radius * 0.34, {
    size: Math.max(4, Math.min(5.5, radius * 0.22)),
    color: COLOR.muted,
    align: 'center',
  })
}

function listRows(doc, box, rows, emptyText) {
  if (!rows.length) {
    text(doc, emptyText, box.x, box.y + 8, { size: 7, color: COLOR.muted })
    return
  }
  const rowHeight = Math.min(12, box.h / Math.max(rows.length, 1))
  rows.forEach((row, i) => {
    const y = box.y + i * rowHeight
    text(doc, fitLabel(row.label, box.w * 0.72, 7), box.x, y + rowHeight * 0.66, { size: 7, color: COLOR.ink })
    if (row.value !== undefined) {
      text(doc, String(row.value), box.x + box.w, y + rowHeight * 0.66, {
        size: 7,
        color: row.value > 0 ? COLOR.warning : COLOR.muted,
        bold: row.value > 0,
        align: 'right',
      })
    } else if (row.meta) {
      text(doc, row.meta, box.x + box.w, y + rowHeight * 0.66, {
        size: 6,
        color: COLOR.muted,
        align: 'right',
      })
    }
    setStroke(doc, COLOR.rule)
    doc.setLineWidth(0.1)
    doc.line(box.x, y + rowHeight, box.x + box.w, y + rowHeight)
  })
}

function kpiTiles(doc, model, { x, y, width, columns, height = 21, gap = 3 }) {
  const tileWidth = (width - gap * (columns - 1)) / columns
  model.tiles.forEach((tile, i) => {
    const tx = x + (i % columns) * (tileWidth + gap)
    const ty = y + Math.floor(i / columns) * (height + gap)

    setFill(doc, COLOR.paleNeutral)
    doc.roundedRect(tx, ty, tileWidth, height, 1.5, 1.5, 'F')

    text(doc, fitLabel(tile.label.toUpperCase(), tileWidth - 6, 5.5), tx + 3, ty + 5, {
      size: 5.5,
      color: COLOR.orange,
      bold: true,
    })
    text(doc, tile.value, tx + 3, ty + 13.5, { size: 14, color: COLOR.forest, bold: true })

    const meta = tile.note ?? tile.delta
    if (meta) {
      text(doc, meta, tx + 3, ty + 18.3, {
        size: 5.5,
        color: tile.note ? COLOR.muted : tile.delta?.startsWith('-') ? COLOR.danger : COLOR.success,
      })
    }
  })
  return y + Math.ceil(model.tiles.length / columns) * (height + gap)
}

function header(doc, model, logo, page) {
  const { margin } = page
  const logoHeight = 11

  if (logo?.dataUrl) {
    doc.addImage(logo.dataUrl, 'PNG', page.width - margin - logoHeight * logo.ratio, margin, logoHeight * logo.ratio, logoHeight)
  }

  text(doc, model.title, margin, margin + 7, { size: 17, color: COLOR.forest, bold: true })
  text(doc, model.period, margin, margin + 13, { size: 9, color: COLOR.muted })
  text(doc, `Generated ${model.generatedAt}`, margin, margin + 17.5, { size: 6.5, color: COLOR.muted })

  setFill(doc, COLOR.forest)
  doc.rect(0, 0, page.width, 2.5, 'F')
  setStroke(doc, COLOR.rule)
  doc.setLineWidth(0.2)
  doc.line(margin, margin + 21, page.width - margin, margin + 21)
  return margin + 26
}

// Page 2 opens with the title and period again: a printed page that leaves the sheet loses its context.
function runningHeader(doc, model, page) {
  const { margin, width } = page
  text(doc, model.title, margin, margin + 6, { size: 12, color: COLOR.forest, bold: true })
  text(doc, `${model.period} · generated ${model.generatedAt}`, width - margin, margin + 6, {
    size: 6.5,
    color: COLOR.muted,
    align: 'right',
  })
  setStroke(doc, COLOR.rule)
  doc.setLineWidth(0.2)
  doc.line(margin, margin + 10, width - margin, margin + 10)
  return margin + 18
}

function watermark(doc, logo, page) {
  if (!logo?.dataUrl) return
  const width = page.width * 0.5
  const height = width / logo.ratio
  doc.saveGraphicsState()
  doc.setGState(new doc.GState({ opacity: 0.04 }))
  doc.addImage(logo.dataUrl, 'PNG', (page.width - width) / 2, (page.height - height) / 2, width, height)
  doc.restoreGraphicsState()
}

function footer(doc, model, page, pageNumber, pageCount) {
  const { margin, height, width } = page
  setStroke(doc, COLOR.rule)
  doc.setLineWidth(0.2)
  doc.line(margin, height - 13, width - margin, height - 13)
  text(doc, model.footer, margin, height - 9, { size: 5.5, color: COLOR.muted })
  text(doc, `${pageNumber} / ${pageCount}`, width - margin, height - 9, {
    size: 5.5,
    color: COLOR.muted,
    align: 'right',
  })
}

const TRAFFIC_LEGEND = [
  { label: 'Views', color: COLOR.forest },
  { label: 'Visitors', color: COLOR.orange },
]

const ENGAGEMENT_LEGEND = ENGAGEMENT_SERIES.map((s) => ({ label: s.key, color: s.color }))

// ---------- the two layouts ----------

function drawLandscape(doc, model, logo) {
  const page = PAGE.landscape
  const { margin, width, height } = page
  const contentWidth = width - margin * 2
  watermark(doc, logo, page)

  let y = header(doc, model, logo, page)
  y = kpiTiles(doc, model, { x: margin, y, width: contentWidth, columns: 7, height: 19 }) + 2

  const trafficWidth = contentWidth * 0.63
  const rowOneHeight = 54
  areaChart(
    doc,
    panel(doc, {
      x: margin,
      y,
      w: trafficWidth,
      h: rowOneHeight,
      title: 'Traffic',
      legend: TRAFFIC_LEGEND,
    }),
    model.traffic,
    [
      { key: 'views', fill: COLOR.paleGreen, color: COLOR.forest },
      { key: 'visitors', color: COLOR.orange },
    ]
  )

  donut(
    doc,
    panel(doc, {
      x: margin + trafficWidth + 4,
      y,
      w: contentWidth - trafficWidth - 4,
      h: rowOneHeight,
      title: 'Email reach',
      note: 'Who can receive a broadcast',
    }),
    [
      { value: model.email.optedIn, color: COLOR.forest },
      { value: model.email.optedOut, color: COLOR.hairline },
    ],
    percentLabel(model.email.optedIn / Math.max(1, model.email.optedIn + model.email.optedOut)),
    'opted in'
  )

  y += rowOneHeight + 4
  const rowTwoHeight = height - 17 - y
  const third = (contentWidth - 8) / 3

  barChart(
    doc,
    panel(doc, { x: margin, y, w: third, h: rowTwoHeight, title: 'New members', note: 'Signups per day' }),
    model.signups,
    'count',
    COLOR.forest
  )
  stackedChart(
    doc,
    panel(doc, {
      x: margin + third + 4,
      y,
      w: third,
      h: rowTwoHeight,
      title: 'Engagement',
      legend: ENGAGEMENT_LEGEND,
    }),
    model.engagement
  )
  horizontalBars(
    doc,
    panel(doc, { x: margin + (third + 4) * 2, y, w: third, h: rowTwoHeight, title: 'Top content', note: 'Most viewed' }),
    model.topContent,
    { labelKey: 'label', valueKey: 'views', color: COLOR.orangeBright }
  )

  footer(doc, model, page, 1, 1)
}

function drawPortrait(doc, model, logo) {
  const page = PAGE.portrait
  const { margin, width, height } = page
  const contentWidth = width - margin * 2
  const half = (contentWidth - 4) / 2
  watermark(doc, logo, page)

  let y = header(doc, model, logo, page)
  y = kpiTiles(doc, model, { x: margin, y, width: contentWidth, columns: 4 }) + 2

  // Page 1: the numbers and the trends.
  const trafficHeight = 54
  areaChart(
    doc,
    panel(doc, { x: margin, y, w: contentWidth, h: trafficHeight, title: 'Traffic', legend: TRAFFIC_LEGEND }),
    model.traffic,
    [
      { key: 'views', fill: COLOR.paleGreen, color: COLOR.forest },
      { key: 'visitors', color: COLOR.orange },
    ]
  )

  y += trafficHeight + 4
  const chartHeight = 48
  barChart(
    doc,
    panel(doc, { x: margin, y, w: half, h: chartHeight, title: 'New members', note: 'Signups per day' }),
    model.signups,
    'count',
    COLOR.forest
  )
  stackedChart(
    doc,
    panel(doc, { x: margin + half + 4, y, w: half, h: chartHeight, title: 'Engagement', legend: ENGAGEMENT_LEGEND }),
    model.engagement
  )

  y += chartHeight + 4
  const bottomHeight = height - 17 - y
  donut(
    doc,
    panel(doc, { x: margin, y, w: half, h: bottomHeight, title: 'Email reach', note: 'Who can receive a broadcast' }),
    [
      { value: model.email.optedIn, color: COLOR.forest },
      { value: model.email.optedOut, color: COLOR.hairline },
    ],
    percentLabel(model.email.optedIn / Math.max(1, model.email.optedIn + model.email.optedOut)),
    'opted in'
  )
  horizontalBars(
    doc,
    panel(doc, {
      x: margin + half + 4,
      y,
      w: half,
      h: bottomHeight,
      title: 'Award participation',
      note: 'Votes this period',
    }),
    model.awards,
    { labelKey: 'category', valueKey: 'votes', color: COLOR.orangeBright }
  )

  footer(doc, model, page, 1, 2)
  doc.addPage()
  watermark(doc, logo, page)

  // Page 2: the content and the queues.
  y = runningHeader(doc, model, page)
  const contentHeight = 76
  horizontalBars(
    doc,
    panel(doc, { x: margin, y, w: contentWidth, h: contentHeight, title: 'Top content', note: 'Most viewed pages this period' }),
    model.topContent,
    { labelKey: 'label', valueKey: 'views', color: COLOR.orangeBright }
  )

  y += contentHeight + 4
  const queueHeight = 56
  listRows(
    doc,
    panel(doc, { x: margin, y, w: half, h: queueHeight, title: 'Needs attention', note: 'Right now, not this period' }),
    model.attention.map(([label, value]) => ({ label, value })),
    'Nothing waiting.'
  )
  listRows(
    doc,
    panel(doc, { x: margin + half + 4, y, w: half, h: queueHeight, title: 'Broadcasts sent', note: 'Most recent' }),
    model.email.broadcasts.map((b) => ({ label: b.subject, meta: `${formatNumber(b.recipients)} sent` })),
    'No broadcasts yet.'
  )

  y += queueHeight + 4
  const activityHeight = height - 17 - y
  listRows(
    doc,
    panel(doc, { x: margin, y, w: contentWidth, h: activityHeight, title: 'Recent activity', note: 'The last few things that happened' }),
    model.activity.map((row) => ({ label: row.label, meta: formatDay(row.at.slice(0, 10)) })),
    'Nothing has happened in this period.'
  )

  footer(doc, model, page, 2, 2)
}

// Exported so a Node test can draw both layouts for real: the risk in this module is not arithmetic
// but geometry, and a wrong coordinate only shows up as a broken document.
export function drawAnalyticsReport(doc, model, layout = 'portrait', logo = null) {
  activeFont = resolveFont(doc)
  if (layout === 'landscape') drawLandscape(doc, model, logo)
  else drawPortrait(doc, model, logo)
}

export async function downloadAnalyticsPdf(data, rangeKeyValue, layout = 'portrait') {
  // Imported here rather than at the top of the module: timetablePdf reaches the Supabase client, and
  // this file's model is unit-tested without a database or a DOM. Its loadPdfDeps is reused because it
  // also loads the embedded Public Sans files that registerPublicSans then draws with.
  const { loadPdfDeps, registerPublicSans, loadLogoDataUrl } = await import('./timetablePdf')
  const { jsPDF } = await loadPdfDeps()

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: layout === 'landscape' ? 'landscape' : 'portrait' })
  registerPublicSans(doc)

  const model = analyticsPdfModel(data)
  const logo = await loadLogoDataUrl()

  drawAnalyticsReport(doc, model, layout, logo)
  doc.save(analyticsPdfFilename(rangeKeyValue, layout))
}
