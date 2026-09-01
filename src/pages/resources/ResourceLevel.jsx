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
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <Breadcrumbs items={[{ label: 'Resources', to: '/resources' }, { label: `${level} Level` }]} />
      <h1 className="text-3xl font-bold text-ink-900 mt-2">{level} Level</h1>
      <p className="mt-2 max-w-2xl text-ink-muted">Choose a semester to see its shared resources.</p>

      {isError && !data ? (
        <div className="mt-8">
          <ErrorState message="Couldn't load resources right now." onRetry={refetch} />
        </div>
      ) : isLoading ? (
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-lg border border-hairline bg-surface p-6 shadow-md">
              <SkeletonText lines={2} />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          {Object.entries(SEMESTER_LABELS).map(([sem, label]) => {
            const count = getResources(data ?? [], level, sem).length
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
      )}
    </div>
  )
}
