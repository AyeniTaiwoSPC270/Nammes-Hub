import { useParams, Navigate } from 'react-router-dom'
import Breadcrumbs from '../../components/Breadcrumbs'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonTable } from '../../components/ui/Skeleton'
import { LEVELS, SEMESTER_LABELS, useResourcesQuery, getResources } from '../../data/resources'

export default function ResourceList() {
  const { level, semester } = useParams()
  const { data, isLoading, isError, refetch } = useResourcesQuery()

  if (!LEVELS.includes(level) || !SEMESTER_LABELS[semester]) return <Navigate to="/resources" replace />

  const items = getResources(data ?? [], level, semester)

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <Breadcrumbs
        items={[
          { label: 'Resources', to: '/resources' },
          { label: `${level} Level`, to: `/resources/${level}` },
          { label: SEMESTER_LABELS[semester] },
        ]}
      />
      <h1 className="text-3xl font-bold text-ink-900 mt-2">
        {level} Level &middot; {SEMESTER_LABELS[semester]}
      </h1>
      <p className="mt-2 max-w-2xl text-ink-muted">Shared Drive links and other resources for this semester.</p>

      <div className="mt-6">
        {isError && !data ? (
          <ErrorState message="Couldn't load resources right now." onRetry={refetch} />
        ) : isLoading ? (
          <SkeletonTable columns={4} rows={4} />
        ) : items.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-md">
            <div className="flex items-center justify-between border-b border-hairline bg-surface-low p-4">
              <h3 className="text-lg font-bold text-ink-900">
                {level} Level &middot; {SEMESTER_LABELS[semester]} Resources
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-hairline bg-surface-low">
                    <th className="border-r border-hairline p-4 text-xs font-bold uppercase tracking-[.05em] text-ink">
                      Category
                    </th>
                    <th className="border-r border-hairline p-4 text-xs font-bold uppercase tracking-[.05em] text-ink">
                      Title
                    </th>
                    <th className="border-r border-hairline p-4 text-xs font-bold uppercase tracking-[.05em] text-ink">
                      Updated
                    </th>
                    <th className="p-4 text-xs font-bold uppercase tracking-[.05em] text-ink">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r, i) => (
                    <tr
                      key={r.id}
                      className={[
                        'transition-colors hover:bg-surface-low',
                        i < items.length - 1 ? 'border-b border-hairline' : '',
                      ].join(' ')}
                    >
                      <td className="border-r border-hairline p-4 font-semibold text-ink-900">{r.category}</td>
                      <td className="border-r border-hairline p-4 text-ink-muted">{r.title}</td>
                      <td className="border-r border-hairline p-4 text-ink">{r.updated}</td>
                      <td className="p-4">
                        <a
                          href={r.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-bold text-orange-600 hover:underline"
                        >
                          Open <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState
            icon="folder_off"
            title="No resources published yet"
            description="Drive links and study materials for this level and semester haven't been added yet."
          />
        )}
      </div>
    </div>
  )
}
