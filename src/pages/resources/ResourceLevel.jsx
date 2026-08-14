import { useNavigate, useParams, Navigate } from 'react-router-dom'
import Breadcrumbs from '../../components/Breadcrumbs'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonText } from '../../components/ui/Skeleton'
import { LEVELS, SEMESTER_LABELS, useResourcesQuery, getResources } from '../../data/resources'

export default function ResourceLevel() {
  const { level } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useResourcesQuery()

  if (!LEVELS.includes(level)) return <Navigate to="/resources" replace />

  return (
    <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
      <Breadcrumbs items={[{ label: 'Resources', to: '/resources' }, { label: `${level} Level` }]} />
      <h1 className="text-[32px]">{level} Level</h1>
      <p className="mt-2 max-w-2xl text-ink-muted">Choose a semester to see its shared resources.</p>

      {isError ? (
        <div className="mt-8">
          <ErrorState message="Couldn't load resources right now." onRetry={refetch} />
        </div>
      ) : isLoading ? (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-lg bg-orange-100 p-6">
              <SkeletonText lines={3} />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Object.entries(SEMESTER_LABELS).map(([sem, label]) => {
            const count = getResources(data ?? [], level, sem).length
            return (
              <button
                key={sem}
                type="button"
                onClick={() => navigate(`/resources/${level}/${sem}`)}
                className="flex flex-col items-start gap-2 rounded-lg bg-orange-100 p-6 text-left transition-transform duration-150 ease-out hover:scale-[1.02]"
              >
                <span className="font-mono text-xs font-semibold uppercase tracking-[.04em] text-orange-600">
                  Semester {sem}
                </span>
                <span className="font-display text-xl text-green-900">{label}</span>
                <span className="font-mono text-sm text-ink-muted">
                  {count} resource{count === 1 ? '' : 's'}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
