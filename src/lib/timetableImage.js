import { COLOR, sortTimetableRows, formatTimeLabel, academicSession, hoursBetween } from './timetablePdf'
import { SEMESTER_LABELS } from '../data/timetables'

const SCALE = 2
const BASE_WIDTH = 1200
const MARGIN = 56
const CONTENT_WIDTH = BASE_WIDTH - MARGIN * 2
const COLUMN_WEIGHTS = [0.11, 0.15, 0.1, 0.27, 0.14, 0.13, 0.1]

const LINE_HEIGHT = 15
const CELL_PAD_X = 10
const CELL_PAD_Y = 10
const MIN_ROW_HEIGHT = 34
const HEADER_ROW_HEIGHT = 34
const TABLE_BODY_TOP = 260
const FOOTER_BLOCK_HEIGHT = 64
const WATERMARK_SPACING = 900

function rgba(color, alpha = 1) {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`
}

export function wrapText(text, maxWidth, measureWidth) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']
  const lines = []
  let line = words[0]
  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${line} ${words[i]}`
    if (measureWidth(candidate) <= maxWidth) {
      line = candidate
    } else {
      lines.push(line)
      line = words[i]
    }
  }
  lines.push(line)
  return lines
}

export function buildImageRows(rows, type) {
  return sortTimetableRows(rows, type).map((r) => [
    type === 'exam' ? r.date ?? '' : r.day ?? '',
    `${formatTimeLabel(r.start_time)} - ${formatTimeLabel(r.end_time)}`,
    r.code,
    r.title,
    r.venue,
    r.lecturer ?? '',
    r.notes ?? '',
  ])
}

export function columnWidthsFor(contentWidth = CONTENT_WIDTH) {
  return COLUMN_WEIGHTS.map((w) => w * contentWidth)
}

export function layoutTableRows(bodyRows, columnWidths, measureWidth) {
  return bodyRows.map((cells) => {
    const wrappedCells = cells.map((cell, i) => wrapText(cell, columnWidths[i] - CELL_PAD_X * 2, measureWidth))
    const maxLines = wrappedCells.reduce((m, lines) => Math.max(m, lines.length), 1)
    const height = Math.max(MIN_ROW_HEIGHT, maxLines * LINE_HEIGHT + CELL_PAD_Y * 2)
    return { cells, wrappedCells, height }
  })
}

function loadLogoImageElement() {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ img, ratio: img.naturalWidth / img.naturalHeight })
    img.onerror = () => resolve(null)
    img.src = '/logo.png'
  })
}

function drawWatermark(ctx, logo, width, totalHeight) {
  if (!logo) return
  const wmWidth = width * 0.42
  const wmHeight = wmWidth / logo.ratio
  ctx.save()
  ctx.globalAlpha = 0.06
  for (let top = 0; top < totalHeight; top += WATERMARK_SPACING) {
    const tileHeight = Math.min(WATERMARK_SPACING, totalHeight - top)
    ctx.drawImage(logo.img, (width - wmWidth) / 2, top + (tileHeight - wmHeight) / 2, wmWidth, wmHeight)
  }
  ctx.restore()
}

function triggerDownload(canvas, filename) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
      resolve()
    }, 'image/png')
  })
}

export async function downloadTimetableImage({ level, semester, type, rows }) {
  await Promise.all([
    document.fonts.load('700 40px "Public Sans"'),
    document.fonts.load('600 14px "Public Sans"'),
    document.fonts.load('400 14px "Public Sans"'),
  ])

  const bodyRows = buildImageRows(rows, type)
  const typeLabel = type === 'exam' ? 'Exam Timetable' : 'Class Timetable'
  const semesterLabel = SEMESTER_LABELS[semester] ?? `Semester ${semester}`
  const columnWidths = columnWidthsFor()
  const headerLabels =
    type === 'exam'
      ? ['Date', 'Time', 'Code', 'Course Title', 'Venue', 'Invigilator', 'Notes']
      : ['Day', 'Time', 'Code', 'Course Title', 'Venue', 'Lecturer', 'Notes']

  const measureCanvas = document.createElement('canvas')
  const measureCtx = measureCanvas.getContext('2d')
  measureCtx.font = '400 12.5px "Public Sans"'
  const measureWidth = (text) => measureCtx.measureText(text).width
  const laidOutRows = layoutTableRows(bodyRows, columnWidths, measureWidth)

  const tableHeight = HEADER_ROW_HEIGHT + laidOutRows.reduce((sum, r) => sum + r.height, 0)
  const totalHeight = TABLE_BODY_TOP + tableHeight - HEADER_ROW_HEIGHT + FOOTER_BLOCK_HEIGHT

  const canvas = document.createElement('canvas')
  canvas.width = BASE_WIDTH * SCALE
  canvas.height = totalHeight * SCALE
  const ctx = canvas.getContext('2d')
  ctx.scale(SCALE, SCALE)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, BASE_WIDTH, totalHeight)

  const logo = await loadLogoImageElement()
  drawWatermark(ctx, logo, BASE_WIDTH, totalHeight)

  ctx.fillStyle = rgba(COLOR.forest)
  ctx.fillRect(0, 0, BASE_WIDTH, 4)

  ctx.textBaseline = 'alphabetic'

  ctx.font = '700 11px "Courier New", monospace'
  ctx.fillStyle = rgba(COLOR.forestAccent)
  const eyebrow = `${semesterLabel.toUpperCase()} · ${typeLabel.toUpperCase()}`
  ctx.fillText(eyebrow, MARGIN, 30)
  const eyebrowWidth = ctx.measureText(eyebrow).width
  ctx.font = '400 11px "Courier New", monospace'
  ctx.fillStyle = rgba(COLOR.mutedInk)
  ctx.fillText(`Session ${academicSession()}`, MARGIN + eyebrowWidth + 16, 30)

  if (logo) {
    const logoHeight = 22
    const logoWidth = logoHeight * logo.ratio
    ctx.font = '700 15px "Public Sans"'
    const nameWidth = ctx.measureText('NAMMES Hub').width
    const nameX = BASE_WIDTH - MARGIN - logoWidth - 8
    ctx.drawImage(logo.img, BASE_WIDTH - MARGIN - logoWidth, 30 - logoHeight + 4, logoWidth, logoHeight)
    ctx.fillStyle = rgba(COLOR.forest)
    ctx.fillText('NAMMES Hub', nameX - nameWidth, 30)
  }

  ctx.font = '700 34px "Public Sans"'
  ctx.fillStyle = rgba(COLOR.forest)
  ctx.fillText(`${level} Level Timetable`, MARGIN, 64)

  ctx.font = '400 13px "Public Sans"'
  ctx.fillStyle = rgba(COLOR.mutedInk)
  ctx.fillText('NAMMES Hub — Department Timetable', MARGIN, 92)
  ctx.font = '400 11px "Courier New", monospace'
  const generated = `Generated on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
  ctx.fillText(generated, BASE_WIDTH - MARGIN - ctx.measureText(generated).width, 92)

  ctx.strokeStyle = rgba(COLOR.hairline)
  ctx.beginPath()
  ctx.moveTo(MARGIN, 106)
  ctx.lineTo(BASE_WIDTH - MARGIN, 106)
  ctx.stroke()

  const gap = 12
  const boxW = (CONTENT_WIDTH - gap * 3) / 4
  const totalHours = bodyRows.reduce((sum, _, i) => sum + hoursBetween(rows[i]?.start_time, rows[i]?.end_time), 0)
  const courseCount = new Set(rows.map((r) => r.code)).size
  const stats = [
    { label: 'LEVEL', value: `Year ${Number(level) / 100} (${level}L)` },
    { label: 'COURSES', value: `${courseCount} ${courseCount === 1 ? 'Module' : 'Modules'}` },
    { label: type === 'exam' ? 'TOTAL EXAM HOURS' : 'CONTACT HOURS/WK', value: `${totalHours.toFixed(1)} Hrs` },
    { label: 'SCHEDULED', value: `${rows.length} ${type === 'exam' ? 'Exams' : 'Classes'}` },
  ]
  stats.forEach((stat, i) => {
    const x = MARGIN + i * (boxW + gap)
    ctx.fillStyle = rgba(COLOR.stone)
    ctx.strokeStyle = rgba(COLOR.hairline)
    ctx.fillRect(x, 132, boxW, 56)
    ctx.strokeRect(x, 132, boxW, 56)
    ctx.font = '400 10px "Courier New", monospace'
    ctx.fillStyle = rgba(COLOR.mutedInk)
    ctx.fillText(stat.label, x + 12, 152)
    ctx.font = '700 16px "Public Sans"'
    ctx.fillStyle = rgba(COLOR.forest)
    ctx.fillText(stat.value, x + 12, 174)
  })

  ctx.font = '700 11px "Courier New", monospace'
  ctx.fillStyle = rgba(COLOR.forest)
  ctx.fillText('WEEKLY SCHEDULE', MARGIN, 212)
  ctx.font = '400 11px "Courier New", monospace'
  ctx.fillStyle = rgba(COLOR.mutedInk)
  const sortedByLabel = 'Sorted by day & time'
  ctx.fillText(sortedByLabel, BASE_WIDTH - MARGIN - ctx.measureText(sortedByLabel).width, 212)

  let colX = [MARGIN]
  columnWidths.forEach((w, i) => colX.push(colX[i] + w))

  ctx.fillStyle = rgba(COLOR.forestLight)
  ctx.fillRect(MARGIN, 226, CONTENT_WIDTH, HEADER_ROW_HEIGHT)
  ctx.font = '700 10px "Courier New", monospace'
  ctx.fillStyle = rgba(COLOR.forest)
  headerLabels.forEach((label, i) => {
    ctx.fillText(label, colX[i] + CELL_PAD_X, 226 + HEADER_ROW_HEIGHT / 2 + 3)
  })

  let rowY = TABLE_BODY_TOP
  laidOutRows.forEach((row, rowIndex) => {
    ctx.fillStyle = rgba(rowIndex % 2 === 0 ? [255, 255, 255] : COLOR.stone)
    ctx.fillRect(MARGIN, rowY, CONTENT_WIDTH, row.height)

    row.wrappedCells.forEach((lines, colIndex) => {
      const x = colX[colIndex] + CELL_PAD_X
      const columnStyle =
        colIndex === 0
          ? { font: '700 12px "Public Sans"', color: COLOR.forest }
          : colIndex === 1
            ? { font: '400 11px "Courier New", monospace', color: COLOR.mutedInk }
            : colIndex === 2
              ? { font: '700 11px "Courier New", monospace', color: COLOR.forestAccent }
              : { font: '400 12px "Public Sans"', color: COLOR.ink }

      if (colIndex === 6 && !row.cells[6]) {
        ctx.font = '700 11px "Courier New", monospace'
        ctx.fillStyle = rgba(COLOR.hairline)
        const dash = '—'
        const colWidth = columnWidths[6]
        ctx.fillText(dash, colX[6] + (colWidth - ctx.measureText(dash).width) / 2, rowY + row.height / 2 + 4)
        return
      }

      ctx.font = columnStyle.font
      ctx.fillStyle = rgba(columnStyle.color)
      const textY = rowY + CELL_PAD_Y + LINE_HEIGHT - 4
      lines.forEach((line, lineIndex) => {
        ctx.fillText(line, x, textY + lineIndex * LINE_HEIGHT)
      })
    })

    ctx.strokeStyle = rgba(COLOR.hairline)
    ctx.beginPath()
    ctx.moveTo(MARGIN, rowY + row.height)
    ctx.lineTo(BASE_WIDTH - MARGIN, rowY + row.height)
    ctx.stroke()

    rowY += row.height
  })

  const footerLineY = rowY + 20
  ctx.strokeStyle = rgba(COLOR.hairline)
  ctx.beginPath()
  ctx.moveTo(MARGIN, footerLineY)
  ctx.lineTo(BASE_WIDTH - MARGIN, footerLineY)
  ctx.stroke()

  const footerTextY = footerLineY + 20
  ctx.font = '400 12px "Public Sans"'
  ctx.fillStyle = rgba(COLOR.mutedInk)
  ctx.fillText('University of Lagos · Faculty of Engineering', MARGIN, footerTextY)
  ctx.font = '400 11px "Courier New", monospace'
  ctx.fillStyle = rgba(COLOR.forest)
  const ref = `NAMMES/TT/${level}L/S${semester}/${type.toUpperCase()}`
  ctx.fillText(ref, BASE_WIDTH - MARGIN - ctx.measureText(ref).width, footerTextY)

  await triggerDownload(canvas, `nammes-hub-${level}-level-${type}-timetable.png`)
}
