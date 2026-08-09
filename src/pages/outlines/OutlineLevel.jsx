import { useEffect, useState } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import Breadcrumbs from '../../components/Breadcrumbs'
import { LEVELS, SEMESTER_LABELS, fetchOutlines, getCourses } from '../../data/outlines'

export default function OutlineLevel() {
  const { level } = useParams()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOutlines().then((data) => {
      setRows(data)
      setLoading(false)
    })
  }, [])

  if (!LEVELS.includes(level)) return <Navigate to="/outlines" replace />
  if (loading) {
    return (
      <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
        <p className="text-ink-muted">Loading…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
      <Breadcrumbs items={[{ label: 'Outlines', to: '/outlines' }, { label: `${level} Level` }]} />
      <h1 className="text-[32px]">{level} Level</h1>
      <p className="mt-2 max-w-2xl text-ink-muted">Choose a semester to see its course list.</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Object.entries(SEMESTER_LABELS).map(([sem, label]) => {
          const count = getCourses(rows, level, sem).length
          return (
            <button
              key={sem}
              type="button"
              onClick={() => navigate(`/outlines/${level}/${sem}`)}
              className="flex flex-col items-start gap-2 rounded-lg bg-orange-100 p-6 text-left transition-transform duration-150 ease-out hover:scale-[1.02]"
            >
              <span className="font-mono text-xs font-semibold uppercase tracking-[.04em] text-orange-600">
                Semester {sem}
              </span>
              <span className="font-display text-xl text-green-900">{label}</span>
              <span className="font-mono text-sm text-ink-muted">
                {count} course{count === 1 ? '' : 's'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
