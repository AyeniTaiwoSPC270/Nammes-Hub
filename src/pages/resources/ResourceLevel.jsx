import { useEffect, useState } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import Breadcrumbs from '../../components/Breadcrumbs'
import { LEVELS, SEMESTER_LABELS, fetchResources, getResources } from '../../data/resources'

export default function ResourceLevel() {
  const { level } = useParams()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchResources().then((data) => {
      setRows(data)
      setLoading(false)
    })
  }, [])

  if (!LEVELS.includes(level)) return <Navigate to="/resources" replace />
  if (loading) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <p className="text-ink-muted">Loading…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <Breadcrumbs items={[{ label: 'Resources', to: '/resources' }, { label: `${level} Level` }]} />
      <h1 className="text-3xl font-bold text-ink-900 mt-2">{level} Level</h1>
      <p className="mt-2 max-w-2xl text-ink-muted">Choose a semester to see its shared resources.</p>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        {Object.entries(SEMESTER_LABELS).map(([sem, label]) => {
          const count = getResources(rows, level, sem).length
          return (
            <button
              key={sem}
              type="button"
              onClick={() => navigate(`/resources/${level}/${sem}`)}
              className="group flex items-center justify-between gap-4 rounded-lg border border-hairline border-l-4 border-l-transparent bg-surface p-6 text-left shadow-md transition-colors hover:border-l-orange-500 hover:bg-surface-low"
            >
              <div>
                <h3 className="text-xl font-bold text-ink-900 mb-1">{label}</h3>
                <p className="text-sm text-ink-muted">
                  {count} resource{count === 1 ? '' : 's'}
                </p>
              </div>
              <span className="material-symbols-outlined text-3xl text-green-900">chevron_right</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
