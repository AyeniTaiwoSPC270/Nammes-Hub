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
  ])
}

export function downloadTimetablePdf({ level, semester, type, rows }) {
  const doc = new jsPDF()
  const typeLabel = type === 'exam' ? 'Exam Timetable' : 'Class Timetable'
  const semesterLabel = SEMESTER_LABELS[semester] ?? `Semester ${semester}`

  doc.setFontSize(16)
  doc.text('NAMMES Hub', 14, 16)
  doc.setFontSize(12)
  doc.text(`${level} Level · ${semesterLabel} · ${typeLabel}`, 14, 24)

  autoTable(doc, {
    startY: 30,
    head: [[type === 'exam' ? 'Date' : 'Day', 'Time', 'Code', 'Course', 'Venue', 'Lecturer']],
    body: buildTimetablePdfRows(rows, type),
    headStyles: { fillColor: [20, 83, 45] },
    styles: { fontSize: 9 },
  })

  doc.save(`nammes-hub-${level}-level-${type}-timetable.pdf`)
}
