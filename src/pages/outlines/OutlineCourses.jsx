import { useNavigate, useParams, Navigate } from 'react-router-dom'
import Breadcrumbs from '../../components/Breadcrumbs'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonTable } from '../../components/ui/Skeleton'
import { LEVELS, SEMESTER_LABELS, useOutlinesQuery, getCourses } from '../../data/outlines'

export default function OutlineCourses() {
  const { level, semester } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useOutlinesQuery()

  if (!LEVELS.includes(level) || !SEMESTER_LABELS[semester]) return <Navigate to="/outlines" replace />

  const courses = getCourses(data ?? [], level, semester)
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
        {isError && !data ? (
          <ErrorState message="Couldn't load courses right now." onRetry={refetch} />
        ) : isLoading ? (
          <SkeletonTable columns={4} rows={5} />
        ) : courses.length > 0 ? (
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
            description="Outlines for this level and semester haven't been added yet. Check back soon."
          />
        )}
      </div>
    </div>
  )
}
