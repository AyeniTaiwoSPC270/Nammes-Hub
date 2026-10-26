import { formatDay, percentLabel, totalFor } from './analytics'

// The sections are a plain data structure so the PDF's content is testable without a canvas or a
// document. `downloadAnalyticsPdf` only lays them out.
export function analyticsPdfSections(data, generatedAt = new Date()) {
  const period =
    data.range.from && data.range.to
      ? `${formatDay(data.range.from)} – ${formatDay(data.range.to)}`
      : `Last ${data.range.days} days`

  const kpis = data.kpis
  const views = totalFor(data.traffic, ['views'])
  const visitors = totalFor(data.traffic, ['visitors'])

  return [
    {
      title: `Period: ${period}`,
      rows: [
        ['Generated', generatedAt.toLocaleString()],
        ['Views (from daily series)', views.toLocaleString()],
        ['Visitors (from daily series)', visitors.toLocaleString()],
      ],
    },
    {
      title: 'Headline',
      rows: [
        ['Visitors (sessions)', kpis.visitors.current.toLocaleString()],
        ['New members', kpis.signups.current.toLocaleString()],
        ['Quiz plays', kpis.quizPlays.current.toLocaleString()],
        ['Quiz players', kpis.quizPlays.players.toLocaleString()],
        ['CBT attempts', kpis.cbtAttempts.current.toLocaleString()],
        ['CBT average score', `${kpis.cbtAttempts.averageScore}%`],
        ['Form responses', kpis.formResponses.current.toLocaleString()],
        ['Email opt-in', `${percentLabel(kpis.optInRate.current)} (${kpis.optInRate.optedIn} of ${kpis.optInRate.total})`],
      ],
    },
    {
      title: 'Most viewed',
      rows: data.topContent.length
        ? data.topContent.map((row) => [row.label, row.views.toLocaleString()])
        : [['No page views recorded', '0']],
    },
    {
      title: 'Awards',
      rows: data.awards.length
        ? data.awards.map((row) => [row.category, row.votes.toLocaleString()])
        : [['No votes in this period', '0']],
    },
    {
      title: 'Waiting on someone',
      rows: [
        ['Submissions waiting', String(data.attention.pendingSubmissions)],
        ['Edits awaiting approval', String(data.attention.pendingReviews)],
        ['Messages unanswered', String(data.attention.unhandledMessages)],
        ['Calendar dates TBA', String(data.attention.calendarTba)],
        ['Emails failed to send', String(data.attention.failedEmails)],
        ['Server errors in 24h', String(data.attention.errors24h)],
      ],
    },
  ]
}

export function analyticsPdfFilename(rangeKeyValue, generatedAt = new Date()) {
  return `nammes-analytics-${rangeKeyValue}-${generatedAt.toISOString().slice(0, 10)}.pdf`
}

export async function downloadAnalyticsPdf(data, rangeKeyValue) {
  // Imported here rather than at the top of the module: timetablePdf reaches the Supabase client, and
  // this file's section builder is unit-tested without a database or a DOM. Its loadPdfDeps is reused
  // rather than reimplemented because it is also what registers the embedded Public Sans files that
  // registerPublicSans then draws with.
  const { loadPdfDeps, registerPublicSans } = await import('./timetablePdf')
  const { jsPDF, autoTable } = await loadPdfDeps()
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  registerPublicSans(doc)

  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 16
  let y = 18

  doc.setFillColor(11, 36, 23)
  doc.rect(0, 0, pageWidth, 3, 'F')

  doc.setFont('PublicSans', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(25, 24, 19)
  doc.text('NAMMES Hub — Analytics', margin, y)
  y += 7

  doc.setFont('PublicSans', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(107, 101, 88)
  doc.text('Private to admins. Traffic counts views recorded since tracking was switched on.', margin, y)
  y += 8

  for (const section of analyticsPdfSections(data)) {
    autoTable(doc, {
      startY: y,
      head: [[section.title, '']],
      body: section.rows,
      margin: { left: margin, right: margin },
      styles: { font: 'PublicSans', fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [246, 243, 242], textColor: [11, 36, 23], fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 45, halign: 'right' } },
      theme: 'grid',
    })
    y = doc.lastAutoTable.finalY + 6
    if (y > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage()
      y = 18
    }
  }

  doc.save(analyticsPdfFilename(rangeKeyValue))
}
