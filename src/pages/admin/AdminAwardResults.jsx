import { useParams } from 'react-router-dom'
import { useSeasonQuery } from '../../data/awardSeasons'
import { useNomineesQuery } from '../../data/awardNominees'
import { useSeasonVotesQuery } from '../../data/awardVotes'
import Breadcrumbs from '../../components/Breadcrumbs'
import ErrorState from '../../components/ui/ErrorState'
import ResultsSummary from '../../components/awards/ResultsSummary'

export default function AdminAwardResults() {
  const { seasonId } = useParams()
  const seasonQuery = useSeasonQuery(seasonId)
  const categories = seasonQuery.data?.categories ?? []
  const categoryIds = categories.map((c) => c.id)
  const nomineesQuery = useNomineesQuery(categoryIds)
  const votesQuery = useSeasonVotesQuery(seasonId)

  if (seasonQuery.isError) {
    return (
      <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load this season." onRetry={seasonQuery.refetch} />
      </div>
    )
  }
  if (!seasonQuery.data || !nomineesQuery.data || !votesQuery.data) return null

  const nomineesByCategory = {}
  categoryIds.forEach((id) => {
    nomineesByCategory[id] = nomineesQuery.data.filter((n) => n.category_id === id)
  })

  return (
    <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
      <Breadcrumbs items={[
        { label: 'Admin', to: '/admin' },
        { label: 'Awards', to: '/admin/awards' },
        { label: 'Edit', to: `/admin/awards/${seasonId}/edit` },
        { label: 'Results' },
      ]} />
      <h1 className="text-3xl font-bold text-ink-900">Results: {seasonQuery.data.title}</h1>
      <p className="text-ink-muted">{votesQuery.data.length} vote{votesQuery.data.length === 1 ? '' : 's'} cast so far.</p>
      <div className="mt-6">
        <ResultsSummary categories={categories} nomineesByCategory={nomineesByCategory} votes={votesQuery.data} />
      </div>
    </div>
  )
}
