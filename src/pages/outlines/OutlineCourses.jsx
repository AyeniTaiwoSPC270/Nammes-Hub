import { useEffect, useState } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import Breadcrumbs from '../../components/Breadcrumbs'
import EmptyState from '../../components/ui/EmptyState'
import { LEVELS, SEMESTER_LABELS, fetchOutlines, getCourses } from '../../data/outlines'

export default function OutlineCourses() {
  const { level, semester } = useParams()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOutlines().then((data) => {
      setRows(data)
      setLoading(false)
    })
  }, [])

  if (!LEVELS.includes(level) || !SEMESTER_LABELS[semester]) return <Navigate to="/outlines" replace />
  if (loading) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <p className="text-ink-muted">Loading…</p>
      </div>
    )
  }

  const courses = getCourses(rows, level, semester)
  const slug = (code) => code.replace(/\s+/g, '').toLowerCase()

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <Breadcrumbs
        items={[
          { label: 'Outlines', to: '/outlines' },
          { label: `${level} Level`, to: `/outlines/${level}` },
          { label: SEMESTER_LABELS[semester] },
        ]}
      />
      <h1 className="text-3xl font-bold text-ink-900 mt-2">
        {level} Level &middot; {SEMESTER_LABELS[semester]}
      </h1>
      <p className="mt-2 max-w-2xl text-ink-muted">Select a course to view its detailed outline.</p>

      <div className="mt-6">
        {courses.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-md">
            <div className="flex items-center justify-between border-b border-hairline bg-surface-low p-4">
              <h3 className="text-lg font-bold text-ink-900">
                {level} Level &middot; {SEMESTER_LABELS[semester]} Courses
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-hairline bg-surface-low">
                    <th className="border-r border-hairline p-4 text-xs font-bold uppercase tracking-[.05em] text-ink">
                      Course Code
                    </th>
                    <th className="border-r border-hairline p-4 text-xs font-bold uppercase tracking-[.05em] text-ink">
                      Course Title
                    </th>
                    <th className="border-r border-hairline p-4 text-xs font-bold uppercase tracking-[.05em] text-ink">
                      Units
                    </th>
                    <th className="p-4 text-xs font-bold uppercase tracking-[.05em] text-ink">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((c, i) => (
                    <tr
                      key={c.code}
                      className={[
                        'transition-colors hover:bg-surface-low',
                        i < courses.length - 1 ? 'border-b border-hairline' : '',
                      ].join(' ')}
                    >
                      <td className="border-r border-hairline p-4 font-semibold text-ink-900">{c.code}</td>
                      <td className="border-r border-hairline p-4 text-ink-muted">{c.title}</td>
                      <td className="border-r border-hairline p-4 text-ink">{c.units}</td>
                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() => navigate(`/outlines/${level}/${semester}/${slug(c.code)}`)}
                          className="inline-flex items-center gap-1 text-sm font-bold text-orange-600 hover:underline"
                        >
                          View outline <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState
            icon="menu_book"
            title="No courses published yet"
            description="Outlines for this level and semester haven't been added yet — check back soon."
          />
        )}
      </div>
    </div>
  )
}
