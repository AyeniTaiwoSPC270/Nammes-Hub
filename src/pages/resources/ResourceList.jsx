import { useParams, Navigate } from 'react-router-dom'
import Breadcrumbs from '../../components/Breadcrumbs'
import Table from '../../components/ui/Table'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonTable } from '../../components/ui/Skeleton'
import { LEVELS, SEMESTER_LABELS, useResourcesQuery, getResources } from '../../data/resources'

export default function ResourceList() {
  const { level, semester } = useParams()
  const { data, isLoading, isError, refetch } = useResourcesQuery()

  if (!LEVELS.includes(level) || !SEMESTER_LABELS[semester]) return <Navigate to="/resources" replace />

  const items = getResources(data ?? [], level, semester)

  const tableRows = items.map((r) => [
    r.category,
    r.title,
    r.updated,
    <a
      key={r.id}
      href={r.link}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-full border-2 border-transparent bg-transparent px-4.5 py-2 text-sm font-semibold text-ink transition-[background-color,transform] duration-150 ease-out hover:scale-[1.03] hover:bg-green-100"
    >
      Open
    </a>,
  ])

  return (
    <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
      <Breadcrumbs
        items={[
          { label: 'Resources', to: '/resources' },
          { label: `${level} Level`, to: `/resources/${level}` },
          { label: SEMESTER_LABELS[semester] },
        ]}
      />
      <h1 className="text-[32px]">
        {level} Level &middot; {SEMESTER_LABELS[semester]}
      </h1>
      <p className="mt-2 max-w-2xl text-ink-muted">Shared Drive links and other resources for this semester.</p>

      <div className="mt-6">
        {isError && !data ? (
          <ErrorState message="Couldn't load resources right now." onRetry={refetch} />
        ) : isLoading ? (
          <SkeletonTable columns={4} rows={4} />
        ) : items.length > 0 ? (
          <Table columns={['Category', 'Title', 'Updated', '']} rows={tableRows} />
        ) : (
          <EmptyState title="Nothing here yet" body="No resources published for this semester yet." />
        )}
      </div>
    </div>
  )
}
