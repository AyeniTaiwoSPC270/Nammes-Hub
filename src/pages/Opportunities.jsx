import { useEffect, useState } from 'react'
import Table from '../components/ui/Table'
import PageBanner from '../components/PageBanner'
import EmptyState from '../components/ui/EmptyState'
import { fetchOpportunities, getOpportunities } from '../data/opportunities'

export default function Opportunities() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOpportunities().then((data) => {
      setRows(data)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <p className="text-ink-muted">Loading…</p>
      </div>
    )
  }

  const items = getOpportunities(rows)

  const tableRows = items.map((o) => [
    <span key={`${o.id}-deadline`} className="font-semibold text-orange-600">{o.deadline}</span>,
    o.type,
    <div key={`${o.id}-title`}>
      <div className="font-semibold text-ink-900">{o.title}</div>
      <div className="text-ink-muted">{o.org}</div>
    </div>,
    <a
      key={o.id}
      href={o.link}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-sm font-semibold text-orange-600 hover:underline"
    >
      Apply <span className="material-symbols-outlined text-base">arrow_forward</span>
    </a>,
  ])

  return (
    <div>
      <PageBanner
        title="Opportunities"
        subtitle="Explore current engineering roles, internships, and research positions."
      />
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <h2 className="text-2xl font-bold text-ink-900 mb-2">Current listings</h2>
        <p className="max-w-2xl text-ink-muted mb-6">Sorted by soonest deadline first.</p>

        {items.length > 0 ? (
          <Table columns={['Deadline', 'Type', 'Title & Org', '']} rows={tableRows} />
        ) : (
          <EmptyState
            icon="work_off"
            title="No opportunities yet"
            description="Internships, research roles, and job postings will appear here once they're published."
          />
        )}
      </div>
    </div>
  )
}
