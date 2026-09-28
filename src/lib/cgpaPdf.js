import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { COLOR, loadLogoDataUrl, academicSession, registerPublicSans } from './timetablePdf'

function drawChrome(doc, ctx) {
  doc.setFillColor(...COLOR.forest)
  doc.rect(0, 0, ctx.pageWidth, 3, 'F')
  const footerY = ctx.pageHeight - 12
  doc.setDrawColor(...COLOR.hairline)
  doc.line(ctx.margin, footerY - 5, ctx.pageWidth - ctx.margin, footerY - 5)
  doc.setFont('PublicSans', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...COLOR.mutedInk)
  doc.text('University of Lagos · Faculty of Engineering', ctx.margin, footerY)
}

function ensureSpace(doc, ctx, y, needed) {
  if (y + needed > ctx.pageHeight - 24) {
    doc.addPage()
    drawChrome(doc, ctx)
    return 20
  }
  return y
}

function renderMastheadRow(doc, ctx, eyebrow) {
  const y = 14
  doc.setFont('courier', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...COLOR.forestAccent)
  doc.text(eyebrow, ctx.margin, y)
  doc.setFont('courier', 'normal')
  doc.setTextColor(...COLOR.mutedInk)
  doc.text(`Session ${academicSession()}`, ctx.margin + doc.getTextWidth(eyebrow) + 6, y)

  const { logo } = ctx
  const logoHeight = 6
  const logoWidth = logo ? logoHeight * logo.ratio : 0
  if (logo) doc.addImage(logo.dataUrl, 'PNG', ctx.pageWidth - ctx.margin - logoWidth, y - 5, logoWidth, logoHeight)
  doc.setFont('PublicSans', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...COLOR.forest)
  doc.text('NAMMES Hub', ctx.pageWidth - ctx.margin - logoWidth - 2, y, { align: 'right' })

  return y
}

function renderStatBoxes(doc, ctx, y, stats) {
  const gap = 4
  const boxW = (ctx.contentWidth - gap * (stats.length - 1)) / stats.length
  stats.forEach((stat, i) => {
    const x = ctx.margin + i * (boxW + gap)
    doc.setFillColor(...COLOR.stone)
    doc.setDrawColor(...COLOR.hairline)
    doc.roundedRect(x, y, boxW, 14, 1, 1, 'FD')
    doc.setFont('courier', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...COLOR.mutedInk)
    doc.text(stat.label, x + 2.5, y + 5)
    doc.setFont('PublicSans', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(...COLOR.forest)
    doc.text(stat.value, x + 2.5, y + 11)
  })
  return y + 14 + 8
}

function stampFooterRefs(doc, ctx, ref) {
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i += 1) {
    doc.setPage(i)
    doc.setFont('courier', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLOR.forest)
    doc.text(`${ref} · Page ${i} of ${totalPages}`, ctx.pageWidth - ctx.margin, ctx.pageHeight - 12, { align: 'right' })
  }
}

async function makeContext(doc) {
  registerPublicSans(doc)
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 16
  const logo = await loadLogoDataUrl()
  return { pageWidth, pageHeight, margin, contentWidth: pageWidth - margin * 2, logo }
}

function courseTable(doc, ctx, courses, y) {
  autoTable(doc, {
    startY: y,
    margin: { left: ctx.margin, right: ctx.margin, bottom: 16 },
    head: [['Code', 'Title', 'Units', 'Grade', 'Counts toward CGPA']],
    body: courses.map((c) => [
      c.code,
      c.title || '',
      String(c.units),
      c.grade,
      c.counts_toward_cgpa === false ? 'No' : 'Yes',
    ]),
    styles: { font: 'PublicSans', fontSize: 8.5, textColor: COLOR.ink, lineColor: COLOR.hairline, lineWidth: 0.2, cellPadding: 3 },
    headStyles: { fillColor: COLOR.forestLight, textColor: COLOR.forest, font: 'courier', fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: COLOR.stone },
    columnStyles: {
      0: { font: 'courier', fontStyle: 'bold', textColor: COLOR.forestAccent },
    },
  })
  return doc.lastAutoTable.finalY
}

export async function downloadCgpaReportPdf({ profile, semesters, stats }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const ctx = await makeContext(doc)

  drawChrome(doc, ctx)
  let y = renderMastheadRow(doc, ctx, 'ACADEMIC RECORD · CGPA REPORT')

  y += 8
  doc.setFont('PublicSans', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...COLOR.forest)
  doc.text(profile?.full_name || 'Student Academic Record', ctx.margin, y)

  y += 5
  doc.setFont('PublicSans', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COLOR.mutedInk)
  doc.text(`Matric no: ${profile?.student_id || '—'}`, ctx.margin, y)
  doc.setFont('courier', 'normal')
  doc.setFontSize(8)
  doc.text(
    `Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    ctx.pageWidth - ctx.margin,
    y,
    { align: 'right' }
  )

  y += 4
  doc.setDrawColor(...COLOR.hairline)
  doc.line(ctx.margin, y, ctx.pageWidth - ctx.margin, y)

  y += 6
  y = renderStatBoxes(doc, ctx, y, [
    { label: 'CGPA', value: stats.overallCGPA.toFixed(2) },
    { label: 'CLASSIFICATION', value: stats.classification },
    { label: 'UNITS COMPLETED', value: `${stats.overallUnits}` },
    { label: 'SEMESTERS', value: `${stats.rows.length}` },
  ])

  doc.setFont('courier', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...COLOR.forest)
  doc.text('SEMESTER PROGRESSION', ctx.margin, y)
  y += 3

  autoTable(doc, {
    startY: y,
    margin: { left: ctx.margin, right: ctx.margin, bottom: 16 },
    head: [['Semester', 'GPA', 'Cumulative units', 'CGPA so far']],
    body: stats.rows.map((r) => [r.label, r.gpa.toFixed(2), String(r.cumulativeUnits), r.cgpaSoFar.toFixed(2)]),
    styles: { font: 'PublicSans', fontSize: 8.5, textColor: COLOR.ink, lineColor: COLOR.hairline, lineWidth: 0.2, cellPadding: 3 },
    headStyles: { fillColor: COLOR.forestLight, textColor: COLOR.forest, font: 'courier', fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: COLOR.stone },
  })

  y = doc.lastAutoTable.finalY + 10

  stats.rows.forEach((row) => {
    const semester = semesters.find((s) => s.id === row.semesterId)
    if (!semester || semester.courses.length === 0) return

    y = ensureSpace(doc, ctx, y, 20)
    doc.setFont('courier', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...COLOR.forest)
    doc.text(`${row.label} — GPA ${row.gpa.toFixed(2)}`, ctx.margin, y)
    y += 3

    y = courseTable(doc, ctx, semester.courses, y) + 8
  })

  stampFooterRefs(doc, ctx, `NAMMES/CGPA/${profile?.student_id || 'REPORT'}`)

  const fileTag = (profile?.student_id || 'student').toLowerCase()
  doc.save(`nammes-hub-cgpa-report-${fileTag}.pdf`)
}
