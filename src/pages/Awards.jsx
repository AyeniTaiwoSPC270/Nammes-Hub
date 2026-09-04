import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/ToastContext'
import { useOwnProfileQuery } from '../data/profiles'
import { useLatestSeasonQuery } from '../data/awardSeasons'
import { useMyNominationsQuery, upsertNomination } from '../data/awardNominations'
import { useNomineesQuery } from '../data/awardNominees'
import { useMyVotesQuery, useSeasonVotesQuery, submitBallot } from '../data/awardVotes'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import NominationCategoryField from '../components/awards/NominationCategoryField'
import NomineeOption from '../components/awards/NomineeOption'
import ResultsSummary from '../components/awards/ResultsSummary'

export default function Awards() {
  const { user, loading: authLoading } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const profileQuery = useOwnProfileQuery(user?.id)
  const seasonQuery = useLatestSeasonQuery()
  const season = seasonQuery.data
  const nominationsQuery = useMyNominationsQuery(season?.id, user?.id)

  const [drafts, setDrafts] = useState({})
  const [selections, setSelections] = useState({})
  const categoryIds = season?.categories.map((c) => c.id) ?? []
  const nomineesQuery = useNomineesQuery(categoryIds)
  const myVotesQuery = useMyVotesQuery(season?.id, user?.id)
  const seasonVotesQuery = useSeasonVotesQuery(season?.phase === 'revealed' ? season.id : undefined)

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

  const voteMutation = useMutation({
    mutationFn: async () => {
      const choices = Object.entries(selections).map(([category_id, nominee_id]) => ({ category_id, nominee_id }))
      await submitBallot(choices)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['award_votes', 'mine', season.id, user.id] })
      toast.success('Your vote has been recorded — thank you!')
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

  if (season.phase === 'revealed') {
    if (!nomineesQuery.data || !seasonVotesQuery.data) return null
    const nomineesByCategory = {}
    categoryIds.forEach((id) => {
      nomineesByCategory[id] = nomineesQuery.data.filter((n) => n.category_id === id)
    })
    const ballotCount = new Set(seasonVotesQuery.data.map((v) => v.voter_id)).size

    return (
      <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 text-orange-600">
            <span className="material-symbols-outlined text-3xl">trophy</span>
          </span>
          <span className="inline-flex items-center rounded-full bg-green-900 px-3 py-1 text-xs font-semibold uppercase tracking-[.05em] text-white">
            Results revealed
          </span>
          <h1 className="text-3xl font-bold text-ink-900">{season.title} — Results</h1>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 rounded-lg bg-surface-low p-4 shadow-sm sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-surface text-green-900 shadow-sm">
              <span className="material-symbols-outlined text-xl">how_to_vote</span>
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-[.05em] text-ink-muted">Ballots cast</span>
              <span className="text-lg font-bold text-ink-900">{ballotCount}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-surface text-green-900 shadow-sm">
              <span className="material-symbols-outlined text-xl">workspace_premium</span>
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-[.05em] text-ink-muted">Categories</span>
              <span className="text-lg font-bold text-ink-900">{season.categories.length}</span>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <ResultsSummary categories={season.categories} nomineesByCategory={nomineesByCategory} votes={seasonVotesQuery.data} />
        </div>
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
    const answeredCount = season.categories.filter((c) => (drafts[c.id] || '').trim()).length
    const totalCategories = season.categories.length
    const pct = totalCategories ? Math.round((answeredCount / totalCategories) * 100) : 0

    return (
      <div className="mx-auto max-w-[700px] px-5 py-12 sm:px-6">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[.05em] text-orange-600">
          <span>NAMMES Hub</span>
          <span className="text-hairline">/</span>
          <span className="text-ink-muted">Annual Awards</span>
        </div>
        <h1 className="mt-2 text-3xl font-bold text-ink-900">{season.title}</h1>
        <p className="mt-2 text-ink-muted">Nominate someone for each category. You can change your nominee until nominations close.</p>

        <div className="mt-5 rounded-lg bg-surface-low p-4 shadow-sm">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 font-semibold text-green-900">
              <span className="material-symbols-outlined text-lg">task_alt</span>
              Submission progress
            </span>
            <span className="font-semibold text-ink-900">
              {answeredCount} of {totalCategories} categories nominated
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-hairline/60">
            <div className="h-full rounded-full bg-green-900 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          {season.categories.map((c, i) => (
            <NominationCategoryField
              key={c.id}
              category={c}
              index={i}
              value={drafts[c.id]}
              onChange={(value) => setDrafts((prev) => ({ ...prev, [c.id]: value }))}
            />
          ))}
        </div>

        <Button variant="primary" className="mt-6 w-full sm:w-auto" onClick={() => submitMutation.mutate()} loading={submitMutation.isPending}>
          <span className="material-symbols-outlined text-lg">save</span>
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

  if (season.phase === 'voting') {
    if (!nomineesQuery.data || !myVotesQuery.data) return null

    if (myVotesQuery.data.length > 0) {
      return (
        <div className="mx-auto max-w-[700px] px-5 py-12 sm:px-6">
          <h1 className="text-3xl font-bold text-ink-900">{season.title}</h1>
          <EmptyState icon="check_circle" title="You've already voted" description="Thanks for taking part — results will be announced soon." />
        </div>
      )
    }

    const votableCategories = season.categories.filter(
      (c) => nomineesQuery.data.filter((n) => n.category_id === c.id).length > 0,
    )
    const answeredCount = votableCategories.filter((c) => selections[c.id]).length
    const allAnswered = answeredCount === votableCategories.length
    const pct = votableCategories.length ? Math.round((answeredCount / votableCategories.length) * 100) : 0

    return (
      <div className="mx-auto max-w-[900px] px-5 py-12 pb-28 sm:px-6">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-[.05em] text-orange-600">
          <span className="material-symbols-outlined text-base">how_to_vote</span>
          Annual departmental poll
        </span>
        <h1 className="mt-2 text-3xl font-bold text-ink-900">{season.title}</h1>
        <p className="mt-2 text-ink-muted">Pick one nominee per category, then submit your whole ballot.</p>

        <div className="mt-5 flex flex-col gap-3 rounded-lg bg-surface-low p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-900 text-white">
              <span className="material-symbols-outlined text-xl">verified_user</span>
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-[.05em] text-green-900">Official student ballot</span>
              <span className="text-sm text-ink-muted">
                Matric no: <strong className="text-ink-900">{profileQuery.data?.student_id ?? '—'}</strong> verified &middot; 1 vote per
                student
              </span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-surface px-3 py-1 text-xs font-semibold text-ink-900 shadow-sm sm:self-center">
            <span className="h-2 w-2 animate-pulse rounded-full bg-orange-500" />
            Polling live
          </span>
        </div>

        <div className="mt-4 rounded-lg bg-surface-low p-4 shadow-sm">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 font-semibold text-green-900">
              <span className="material-symbols-outlined text-lg">fact_check</span>
              Categories completed: <span className="text-ink-900">{answeredCount} of {votableCategories.length}</span>
            </span>
            <span className="text-xs font-semibold text-orange-600">{pct}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-hairline/60">
            <div className="h-full rounded-full bg-green-900 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {votableCategories.map((c) => (
              <span key={c.id} className="flex items-center gap-1.5 text-xs text-ink-muted">
                <span className={['h-2 w-2 rounded-full', selections[c.id] ? 'bg-green-900' : 'bg-hairline'].join(' ')} />
                {c.title}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-6">
          {votableCategories.map((c, i) => (
            <div key={c.id}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-900 text-xs font-bold text-white">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h2 className="text-lg font-bold text-ink-900">{c.title}</h2>
                </div>
                <span
                  className={[
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                    selections[c.id] ? 'bg-green-900/10 text-green-900' : 'text-ink-muted',
                  ].join(' ')}
                >
                  <span className="material-symbols-outlined text-base">{selections[c.id] ? 'check' : 'radio_button_unchecked'}</span>
                  {selections[c.id] ? 'Pick recorded' : 'Select a nominee'}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {nomineesQuery.data
                  .filter((n) => n.category_id === c.id)
                  .map((n) => (
                    <NomineeOption
                      key={n.id}
                      nominee={n}
                      selected={selections[c.id] === n.id}
                      onSelect={() => setSelections((prev) => ({ ...prev, [c.id]: n.id }))}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface/95 px-5 py-3 backdrop-blur-sm sm:px-6">
          <div className="mx-auto flex max-w-[900px] flex-col items-center justify-between gap-3 sm:flex-row">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-low text-green-900">
                <span className="material-symbols-outlined text-xl">{allAnswered ? 'verified' : 'pending_actions'}</span>
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-ink-900">{allAnswered ? 'Ballot ready to submit' : 'Incomplete ballot'}</span>
                <span className="text-xs text-ink-muted">
                  {allAnswered
                    ? 'All categories completed.'
                    : `Answer all categories to submit — ${votableCategories.length - answeredCount} remaining`}
                </span>
              </div>
            </div>
            <Button
              variant="primary"
              className="w-full sm:w-auto"
              disabled={!allAnswered}
              loading={voteMutation.isPending}
              onClick={() => voteMutation.mutate()}
            >
              <span className="material-symbols-outlined text-lg">how_to_reg</span>
              Submit ballot
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
