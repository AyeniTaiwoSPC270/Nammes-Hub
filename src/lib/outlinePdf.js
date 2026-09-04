import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { COLOR, loadLogoDataUrl, academicSession, registerPublicSans } from './timetablePdf'
import { SEMESTER_LABELS } from '../data/outlines'

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
    return 14
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

function renderSectionTitle(doc, ctx, y, title) {
  y = ensureSpace(doc, ctx, y, 10)
  doc.setFont('courier', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...COLOR.forest)
  doc.text(title.toUpperCase(), ctx.margin, y)
  return y + 5
}

function renderParagraph(doc, ctx, text, y) {
  const lines = doc.splitTextToSize(text, ctx.contentWidth)
  lines.forEach((line) => {
    y = ensureSpace(doc, ctx, y, 4.8)
    doc.setFont('PublicSans', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...COLOR.ink)
    doc.text(line, ctx.margin, y)
    y += 4.8
  })
  return y
}

function renderBulletList(doc, ctx, items, y) {
  items.forEach((item) => {
    const lines = doc.splitTextToSize(item, ctx.contentWidth - 5)
    lines.forEach((line, i) => {
      y = ensureSpace(doc, ctx, y, 4.8)
      doc.setFont('PublicSans', 'normal')
      doc.setFontSize(9.5)
      if (i === 0) {
        doc.setTextColor(...COLOR.orange)
        doc.text('•', ctx.margin, y)
      }
      doc.setTextColor(...COLOR.ink)
      doc.text(line, ctx.margin + 5, y)
      y += 4.8
    })
  })
  return y + 1.5
}

function renderCourseHeader(doc, ctx, course, level, semester) {
  const eyebrow = `${level} LEVEL · ${(SEMESTER_LABELS[semester] ?? '').toUpperCase()} · COURSE OUTLINE`
  let y = renderMastheadRow(doc, ctx, eyebrow)

  y += 8
  doc.setFont('PublicSans', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...COLOR.forest)
  const titleLines = doc.splitTextToSize(`${course.code} — ${course.title}`, ctx.contentWidth)
  titleLines.forEach((line, i) => {
    doc.text(line, ctx.margin, y + i * 7)
  })
  y += titleLines.length * 7

  y += 2
  doc.setFont('PublicSans', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COLOR.mutedInk)
  doc.text(`Lecturer: ${course.lecturer ?? '—'} · Updated ${course.updated ?? '—'}`, ctx.margin, y)

  y += 4
  doc.setDrawColor(...COLOR.hairline)
  doc.line(ctx.margin, y, ctx.pageWidth - ctx.margin, y)

  y += 6
  y = renderStatBoxes(doc, ctx, y, [
    { label: 'LEVEL', value: `${level}L · S${semester}` },
    { label: 'UNITS', value: `${course.units}` },
    { label: 'TOPICS', value: `${course.topics?.length ?? 0}` },
    { label: 'TEXTS', value: `${course.texts?.length ?? 0}` },
  ])

  return y
}

function renderCourseBody(doc, ctx, course, y) {
  if (course.description) {
    y = renderSectionTitle(doc, ctx, y, 'Description')
    y = renderParagraph(doc, ctx, course.description, y) + 4
  }

  if (course.topics?.length) {
    y = renderSectionTitle(doc, ctx, y, 'Topics covered')
    y = renderBulletList(doc, ctx, course.topics, y) + 2
  }

  if (course.texts?.length) {
    y = renderSectionTitle(doc, ctx, y, 'Recommended texts')
    y = renderBulletList(doc, ctx, course.texts, y) + 2
  }

  const links = [
    course.past_questions_link && ['Past exam questions', course.past_questions_link],
    course.lecturer_notes_link && ['Lecturer notes', course.lecturer_notes_link],
  ].filter(Boolean)
  if (links.length) {
    y = renderSectionTitle(doc, ctx, y, 'Downloads')
    links.forEach(([label, url]) => {
      y = ensureSpace(doc, ctx, y, 6)
      doc.setFont('PublicSans', 'bold')
      doc.setFontSize(9.5)
      doc.setTextColor(...COLOR.forestAccent)
      doc.textWithLink(label, ctx.margin, y, { url })
      y += 6
    })
  }

  return y
}

function renderCoverPage(doc, ctx, { level, semester, courses }) {
  const eyebrow = `${(SEMESTER_LABELS[semester] ?? '').toUpperCase()} · COURSE OUTLINES`
  let y = renderMastheadRow(doc, ctx, eyebrow)

  y += 8
  doc.setFont('PublicSans', 'bold')
  doc.setFontSize(24)
  doc.setTextColor(...COLOR.forest)
  doc.text(`${level} Level Course Outlines`, ctx.margin, y)

  y += 5
  doc.setFont('PublicSans', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COLOR.mutedInk)
  doc.text('NAMMES Hub — Department Course Outlines', ctx.margin, y)
  doc.setFont('courier', 'normal')
  doc.setFontSize(8)
  doc.text(
    `Generated on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    ctx.pageWidth - ctx.margin,
    y,
    { align: 'right' }
  )

  y += 4
  doc.setDrawColor(...COLOR.hairline)
  doc.line(ctx.margin, y, ctx.pageWidth - ctx.margin, y)

  y += 6
  const totalUnits = courses.reduce((sum, c) => sum + Number(c.units || 0), 0)
  y = renderStatBoxes(doc, ctx, y, [
    { label: 'LEVEL', value: `Year ${Number(level) / 100} (${level}L)` },
    { label: 'COURSES', value: `${courses.length} ${courses.length === 1 ? 'Module' : 'Modules'}` },
    { label: 'TOTAL UNITS', value: `${totalUnits} Units` },
  ])

  doc.setFont('courier', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...COLOR.forest)
  doc.text('COURSES IN THIS DOCUMENT', ctx.margin, y)
  y += 3

  autoTable(doc, {
    startY: y,
    margin: { left: ctx.margin, right: ctx.margin, bottom: 16 },
    head: [['Code', 'Course Title', 'Units']],
    body: courses.map((c) => [c.code, c.title, String(c.units)]),
    styles: { font: 'PublicSans', fontSize: 8.5, textColor: COLOR.ink, lineColor: COLOR.hairline, lineWidth: 0.2, cellPadding: 3 },
    headStyles: { fillColor: COLOR.forestLight, textColor: COLOR.forest, font: 'courier', fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: COLOR.stone },
    columnStyles: {
      0: { font: 'courier', fontStyle: 'bold', textColor: COLOR.forestAccent },
    },
  })
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

export async function downloadCourseOutlinePdf(course) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const ctx = await makeContext(doc)

  drawChrome(doc, ctx)
  const y = renderCourseHeader(doc, ctx, course, course.level, course.semester)
  renderCourseBody(doc, ctx, course, y)

  stampFooterRefs(doc, ctx, `NAMMES/OL/${course.level}L/S${course.semester}/${course.code.replace(/\s+/g, '')}`)

  doc.save(`nammes-hub-${course.code.replace(/\s+/g, '-').toLowerCase()}-outline.pdf`)
}

export async function downloadCourseOutlinesPdf({ level, semester, courses }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const ctx = await makeContext(doc)

  drawChrome(doc, ctx)
  renderCoverPage(doc, ctx, { level, semester, courses })

  courses.forEach((course) => {
    doc.addPage()
    drawChrome(doc, ctx)
    const y = renderCourseHeader(doc, ctx, course, level, semester)
    renderCourseBody(doc, ctx, course, y)
  })

  stampFooterRefs(doc, ctx, `NAMMES/OL/${level}L/S${semester}/ALL`)

  doc.save(`nammes-hub-${level}-level-semester-${semester}-outlines.pdf`)
}
