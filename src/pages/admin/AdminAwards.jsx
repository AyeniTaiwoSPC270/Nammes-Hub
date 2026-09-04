import { Link } from 'react-router-dom'
import { useAllSeasonsQuery } from '../../data/awardSeasons'
import Breadcrumbs from '../../components/Breadcrumbs'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonTable } from '../../components/ui/Skeleton'

const PHASE_TONE = { nominating: 'new', curating: 'neutral', voting: 'updated', closed: 'neutral', revealed: 'updated' }

export default function AdminAwards() {
  const seasonsQuery = useAllSeasonsQuery()
  const seasons = seasonsQuery.data ?? []

  if (seasonsQuery.isError && !seasonsQuery.data) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load award seasons right now." onRetry={seasonsQuery.refetch} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Awards' }]} />

      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink-900">Awards</h1>
          <p className="text-ink-muted">Run a nominate → curate → vote → reveal award season.</p>
        </div>
        <Link to="/admin/awards/new">
          <Button variant="primary">New season</Button>
        </Link>
      </div>

      {seasonsQuery.isLoading ? (
        <div className="mt-6">
          <SkeletonTable columns={3} rows={3} />
        </div>
      ) : seasons.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon="how_to_vote"
            title="No award seasons yet"
            description="Create your first award season to start collecting nominations."
          />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {seasons.map((season) => (
            <div
              key={season.id}
              className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface p-4 shadow-md sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="font-semibold text-ink-900">{season.title}</span>
                <Badge tone={PHASE_TONE[season.phase]}>{season.phase}</Badge>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link to={`/admin/awards/${season.id}/edit`}>
                  <Button variant="secondary" size="sm">Manage</Button>
                </Link>
                {season.phase !== 'nominating' && season.phase !== 'curating' && (
                  <Link to={`/admin/awards/${season.id}/results`}>
                    <Button variant="secondary" size="sm">Results</Button>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
