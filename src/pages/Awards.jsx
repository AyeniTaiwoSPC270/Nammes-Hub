import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/ToastContext'
import { useOwnProfileQuery } from '../data/profiles'
import { useLatestSeasonQuery } from '../data/awardSeasons'
import { useMyNominationsQuery, upsertNomination } from '../data/awardNominations'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import NominationCategoryField from '../components/awards/NominationCategoryField'

export default function Awards() {
  const { user, loading: authLoading } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const profileQuery = useOwnProfileQuery(user?.id)
  const seasonQuery = useLatestSeasonQuery()
  const season = seasonQuery.data
  const nominationsQuery = useMyNominationsQuery(season?.id, user?.id)

  const [drafts, setDrafts] = useState({})

  useEffect(() => {
    if (!nominationsQuery.data) return
    const next = {}
    nominationsQuery.data.forEach((n) => {
      next[n.category_id] = n.nominee_name
    })
    setDrafts(next)
  }, [nominationsQuery.data])

  const nominationsByCategory = {}
  ;(nominationsQuery.data || []).forEach((n) => {
    nominationsByCategory[n.category_id] = n
  })

  const submitMutation = useMutation({
    mutationFn: async () => {
      const jobs = season.categories
        .filter((c) => (drafts[c.id] || '').trim())
        .map((c) => {
          const existing = nominationsByCategory[c.id]
          return upsertNomination({
            id: existing?.id,
            categoryId: c.id,
            userId: user.id,
            nomineeName: drafts[c.id].trim(),
          })
        })
      await Promise.all(jobs)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['award_nominations', 'mine', season.id, user.id] })
      toast.success('Nominations saved — thank you!')
    },
    onError: (error) => toast.error(error.message),
  })

  if (seasonQuery.isError) {
    return (
      <div className="mx-auto max-w-[700px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load the awards page." onRetry={seasonQuery.refetch} />
      </div>
    )
  }
  if (seasonQuery.isLoading || authLoading) return null

  if (!season) {
    return (
      <div className="mx-auto max-w-[700px] px-5 py-12 sm:px-6">
        <EmptyState icon="how_to_vote" title="No award season yet" description="Check back once an award season is announced." />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-[700px] px-5 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-ink-900">{season.title}</h1>
        <p className="mt-4 text-ink-muted">Sign in with your department account to take part.</p>
        <Link to="/login" state={{ from: { pathname: '/awards' } }}>
          <Button variant="primary" className="mt-4">Sign in</Button>
        </Link>
      </div>
    )
  }

  if (!profileQuery.isLoading && !profileQuery.data) {
    return (
      <div className="mx-auto max-w-[700px] px-5 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-ink-900">{season.title}</h1>
        <p className="mt-4 text-ink-muted">
          Your account doesn&rsquo;t have a matric number on file, so it can&rsquo;t take part in this award. Contact
          an exco member to get this fixed.
        </p>
      </div>
    )
  }

  if (season.phase === 'nominating') {
    return (
      <div className="mx-auto max-w-[700px] px-5 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-ink-900">{season.title}</h1>
        <p className="mt-2 text-ink-muted">Nominate someone for each category. You can change your nominee until nominations close.</p>

        <div className="mt-6 flex flex-col gap-4">
          {season.categories.map((c) => (
            <NominationCategoryField
              key={c.id}
              category={c}
              value={drafts[c.id]}
              onChange={(value) => setDrafts((prev) => ({ ...prev, [c.id]: value }))}
            />
          ))}
        </div>

        <Button variant="primary" className="mt-6" onClick={() => submitMutation.mutate()} loading={submitMutation.isPending}>
          Save nominations
        </Button>
      </div>
    )
  }

  if (season.phase === 'curating') {
    return (
      <div className="mx-auto max-w-[700px] px-5 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-ink-900">{season.title}</h1>
        <EmptyState icon="hourglass_top" title="Nominations closed" description="The shortlist is being finalized — voting opens soon." />
      </div>
    )
  }

  if (season.phase === 'closed') {
    return (
      <div className="mx-auto max-w-[700px] px-5 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-ink-900">{season.title}</h1>
        <EmptyState icon="how_to_vote" title="Voting closed" description="Results will be announced soon." />
      </div>
    )
  }

  return null // 'voting' and 'revealed' branches added in Task 11
}
