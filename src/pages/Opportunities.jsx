import { useEffect, useState } from 'react'
import Table from '../components/ui/Table'
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
      <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
        <p className="text-ink-muted">Loading…</p>
      </div>
    )
  }

  const items = getOpportunities(rows)

  const tableRows = items.map((o) => [
    o.deadline,
    o.type,
    <div key={`${o.id}-title`}>
      <div className="font-semibold text-ink">{o.title}</div>
      <div className="text-ink-muted">{o.org}</div>
    </div>,
    <a
      key={o.id}
      href={o.link}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-full border-2 border-transparent bg-transparent px-4.5 py-2 text-sm font-semibold text-ink transition-[background-color,transform] duration-150 ease-out hover:scale-[1.03] hover:bg-green-100"
    >
      Apply
    </a>,
  ])

  return (
    <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
      <div className="font-mono text-xs font-bold uppercase tracking-[.04em] text-green-700">
        Opportunities
      </div>
      <h1 className="mt-1.5 text-[32px]">Scholarships & internships</h1>
      <p className="mt-2 max-w-2xl text-ink-muted">
        Manually curated opportunities, soonest deadline first.
      </p>

      <div className="mt-6">
        {items.length > 0 ? (
          <Table columns={['Deadline', 'Type', 'Title & Org', '']} rows={tableRows} />
        ) : (
          <p className="text-ink-muted">No opportunities posted yet.</p>
        )}
      </div>
    </div>
  )
}
