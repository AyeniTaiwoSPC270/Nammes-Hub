import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { DAYS, SEMESTER_LABELS } from '../data/timetables'

export function formatTimeLabel(time) {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

export function sortTimetableRows(rows, type) {
  const sorted = [...rows]
  if (type === 'exam') {
    return sorted.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.start_time.localeCompare(b.start_time))
  }
  return sorted.sort((a, b) => {
    const dayDiff = DAYS.indexOf(a.day) - DAYS.indexOf(b.day)
    return dayDiff !== 0 ? dayDiff : a.start_time.localeCompare(b.start_time)
  })
}

export function buildTimetablePdfRows(rows, type) {
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

const COLOR = {
  forest: [11, 36, 23],
  forestAccent: [18, 122, 62],
  forestLight: [226, 247, 234],
  orange: [255, 90, 31],
  ink: [25, 24, 19],
  mutedInk: [107, 101, 88],
  hairline: [228, 224, 214],
  stone: [250, 249, 247],
}

function hoursBetween(start, end) {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em - (sh * 60 + sm)) / 60
}

function academicSession(date = new Date()) {
  const year = date.getFullYear()
  return date.getMonth() >= 8 ? `${year}/${year + 1}` : `${year - 1}/${year}`
}

function loadLogoDataUrl() {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      resolve({ dataUrl: canvas.toDataURL('image/png'), ratio: img.naturalWidth / img.naturalHeight })
    }
    img.onerror = () => resolve(null)
    img.src = '/logo.png'
  })
}

export async function downloadTimetablePdf({ level, semester, type, rows }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 16
  const contentWidth = pageWidth - margin * 2
  const sortedRows = sortTimetableRows(rows, type)
  const typeLabel = type === 'exam' ? 'Exam Timetable' : 'Class Timetable'
  const semesterLabel = SEMESTER_LABELS[semester] ?? `Semester ${semester}`
  let y = 14

  doc.setFillColor(...COLOR.forest)
  doc.rect(0, 0, pageWidth, 3, 'F')

  const eyebrow = `${semesterLabel.toUpperCase()} · ${typeLabel.toUpperCase()}`
  doc.setFont('courier', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...COLOR.forestAccent)
  doc.text(eyebrow, margin, y)
  doc.setFont('courier', 'normal')
  doc.setTextColor(...COLOR.mutedInk)
  doc.text(`Session ${academicSession()}`, margin + doc.getTextWidth(eyebrow) + 6, y)

  const logo = await loadLogoDataUrl()
  const logoHeight = 6
  const logoWidth = logo ? logoHeight * logo.ratio : 0
  if (logo) doc.addImage(logo.dataUrl, 'PNG', pageWidth - margin - logoWidth, y - 5, logoWidth, logoHeight)
  doc.setFont('times', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...COLOR.forest)
  doc.text('NAMMES Hub', pageWidth - margin - logoWidth - 2, y, { align: 'right' })

  y += 8
  doc.setFont('times', 'bold')
  doc.setFontSize(24)
  doc.setTextColor(...COLOR.forest)
  doc.text(`${level} Level Timetable`, margin, y)

  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COLOR.mutedInk)
  doc.text('NAMMES Hub — Department Timetable', margin, y)
  doc.setFont('courier', 'normal')
  doc.setFontSize(8)
  doc.text(`Generated on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, pageWidth - margin, y, { align: 'right' })

  y += 4
  doc.setDrawColor(...COLOR.hairline)
  doc.line(margin, y, pageWidth - margin, y)

  y += 6
  const gap = 4
  const boxW = (contentWidth - gap * 3) / 4
  const totalHours = sortedRows.reduce((sum, r) => sum + hoursBetween(r.start_time, r.end_time), 0)
  const courseCount = new Set(sortedRows.map((r) => r.code)).size
  const stats = [
    { label: 'LEVEL', value: `Year ${Number(level) / 100} (${level}L)` },
    { label: 'COURSES', value: `${courseCount} ${courseCount === 1 ? 'Module' : 'Modules'}` },
    { label: type === 'exam' ? 'TOTAL EXAM HOURS' : 'CONTACT HOURS/WK', value: `${totalHours.toFixed(1)} Hrs` },
    { label: 'SCHEDULED', value: `${sortedRows.length} ${type === 'exam' ? 'Exams' : 'Classes'}` },
  ]
  stats.forEach((stat, i) => {
    const x = margin + i * (boxW + gap)
    doc.setFillColor(...COLOR.stone)
    doc.setDrawColor(...COLOR.hairline)
    doc.roundedRect(x, y, boxW, 14, 1, 1, 'FD')
    doc.setFont('courier', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...COLOR.mutedInk)
    doc.text(stat.label, x + 2.5, y + 5)
    doc.setFont('times', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(...COLOR.forest)
    doc.text(stat.value, x + 2.5, y + 11)
  })

  y += 14 + 8
  doc.setFont('courier', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...COLOR.forest)
  doc.text('WEEKLY SCHEDULE', margin, y)
  doc.setFont('courier', 'normal')
  doc.setTextColor(...COLOR.mutedInk)
  doc.text('Sorted by day & time', pageWidth - margin, y, { align: 'right' })
  y += 3

  const ref = `NAMMES/TT/${level}L/S${semester}/${type.toUpperCase()}`

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, bottom: 16 },
    head: [[type === 'exam' ? 'Date' : 'Day', 'Time', 'Code', 'Course Title', 'Venue', type === 'exam' ? 'Invigilator' : 'Lecturer', 'Notes']],
    body: buildTimetablePdfRows(rows, type),
    styles: { font: 'helvetica', fontSize: 8.5, textColor: COLOR.ink, lineColor: COLOR.hairline, lineWidth: 0.2, cellPadding: 3 },
    headStyles: { fillColor: COLOR.forestLight, textColor: COLOR.forest, font: 'courier', fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: COLOR.stone },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: COLOR.forest },
      1: { font: 'courier', fontSize: 7.5, textColor: COLOR.mutedInk },
      2: { font: 'courier', fontStyle: 'bold', textColor: COLOR.forestAccent },
    },
    didParseCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 6) return
      if (data.cell.raw) {
        data.cell.styles.font = 'courier'
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fontSize = 7
        data.cell.styles.textColor = COLOR.orange
      } else {
        data.cell.text = ['—']
        data.cell.styles.textColor = COLOR.hairline
        data.cell.styles.halign = 'center'
      }
    },
    didDrawPage: () => {
      const footerY = pageHeight - 12
      doc.setDrawColor(...COLOR.hairline)
      doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...COLOR.mutedInk)
      doc.text('University of Lagos · Faculty of Engineering', margin, footerY)
    },
  })

  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i += 1) {
    doc.setPage(i)
    doc.setFont('courier', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLOR.forest)
    doc.text(`${ref} · Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 12, { align: 'right' })
  }

  doc.save(`nammes-hub-${level}-level-${type}-timetable.pdf`)
}
