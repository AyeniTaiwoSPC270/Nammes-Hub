import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/ToastContext'
import { supabase } from '../../lib/supabaseClient'
import {
  useSeasonQuery,
  createSeason,
  updateSeasonTitle,
  advanceSeasonPhase,
  nextPhase,
  phaseAdvanceLabel,
} from '../../data/awardSeasons'
import Breadcrumbs from '../../components/Breadcrumbs'
import Button from '../../components/ui/Button'
import FormField from '../../components/ui/FormField'
import Badge from '../../components/ui/Badge'
import ErrorState from '../../components/ui/ErrorState'
import CategoryEditorCard from '../../components/admin/awards/CategoryEditorCard'

function newCategory() {
  return { id: crypto.randomUUID(), title: '', description: '' }
}

function categoryToRow(c, seasonId, position) {
  return {
    season_id: seasonId,
    title: c.title.trim(),
    description: c.description?.trim() || null,
    sort_order: position,
  }
}

async function saveCategories(seasonId, categories) {
  const { data: existing, error: fetchError } = await supabase
    .from('award_categories')
    .select('id')
    .eq('season_id', seasonId)
  if (fetchError) throw fetchError
  const existingIds = new Set((existing ?? []).map((c) => c.id))

  const keepIds = new Set(categories.filter((c) => existingIds.has(c.id)).map((c) => c.id))
  const toDelete = [...existingIds].filter((cid) => !keepIds.has(cid))
  if (toDelete.length > 0) {
    const { error } = await supabase.from('award_categories').delete().in('id', toDelete)
    if (error) throw error
  }

  const indexed = categories.map((c, i) => ({ c, i }))
  const toUpdate = indexed
    .filter(({ c }) => existingIds.has(c.id))
    .map(({ c, i }) => ({ id: c.id, ...categoryToRow(c, seasonId, i) }))
  const toInsert = indexed
    .filter(({ c }) => !existingIds.has(c.id))
    .map(({ c, i }) => categoryToRow(c, seasonId, i))

  if (toUpdate.length > 0) {
    const { error } = await supabase.from('award_categories').upsert(toUpdate)
    if (error) throw error
  }
  if (toInsert.length > 0) {
    const { error } = await supabase.from('award_categories').insert(toInsert)
    if (error) throw error
  }
}

export default function AdminAwardSeason() {
  const { seasonId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { user } = useAuth()
  const seasonQuery = useSeasonQuery(seasonId)

  const [hydrated, setHydrated] = useState(!seasonId)
  const [title, setTitle] = useState('')
  const [categories, setCategories] = useState([newCategory()])
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (hydrated || !seasonQuery.data) return
    setTitle(seasonQuery.data.title)
    setCategories(
      seasonQuery.data.categories.length > 0
        ? seasonQuery.data.categories.map((c) => ({ id: c.id, title: c.title, description: c.description }))
        : [newCategory()],
    )
    setHydrated(true)
  }, [seasonQuery.data, hydrated])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error('A season title is required.')
      const validCategories = categories.filter((c) => c.title.trim())
      if (validCategories.length === 0) throw new Error('Add at least one category.')

      let id = seasonId
      if (id) {
        await updateSeasonTitle(id, title.trim())
      } else {
        const created = await createSeason({ title: title.trim(), createdBy: user.id })
        id = created.id
      }
      await saveCategories(id, validCategories)
      return id
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['award_seasons'] })
      toast.success('Season saved.')
      setFormError('')
      navigate(`/admin/awards/${id}/edit`, { replace: true })
    },
    onError: (error) => setFormError(error.message),
  })

  const advanceMutation = useMutation({
    mutationFn: async () => {
      const to = nextPhase(seasonQuery.data.phase)
      if (!to) return
      await advanceSeasonPhase(seasonId, to)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['award_seasons'] })
      toast.success('Phase advanced.')
    },
    onError: (error) => toast.error(error.message),
  })

  function updateCategory(index, next) {
    setCategories((prev) => prev.map((c, i) => (i === index ? next : c)))
  }
  function removeCategory(index) {
    setCategories((prev) => prev.filter((_, i) => i !== index))
  }
  function moveCategory(index, direction) {
    setCategories((prev) => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  if (seasonId && seasonQuery.isError && !seasonQuery.data) {
    return (
      <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load this season." onRetry={seasonQuery.refetch} />
      </div>
    )
  }
  if (seasonId && !hydrated) return null

  const phase = seasonQuery.data?.phase
  const locked = Boolean(seasonId) && phase !== 'nominating'
  const advanceLabel = phase ? phaseAdvanceLabel(phase) : null

  return (
    <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Awards', to: '/admin/awards' }, { label: seasonId ? 'Edit' : 'New' }]} />

      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold text-ink-900">{seasonId ? 'Edit season' : 'New season'}</h1>
        {phase && <Badge tone="new">{phase}</Badge>}
      </div>

      {seasonId && phase !== 'nominating' && phase !== 'revealed' && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-hairline bg-surface-low p-4">
          <p className="flex-1 text-sm text-ink-muted">
            {phase === 'curating' && 'Build the shortlist for each category from the Curate screen, then open voting.'}
            {phase === 'voting' && 'Voting is open. Close it when you’re ready to review the tallies.'}
            {phase === 'closed' && 'Voting is closed. Reveal results when you’re ready to announce winners.'}
          </p>
          <Link to={`/admin/awards/${seasonId}/results`}>
            <Button variant="secondary" size="sm">View tallies</Button>
          </Link>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-5 shadow-sm">
        <FormField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Materials Horizon Awards 2026" required />
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {locked ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-ink-muted">Categories are locked once nominations close.</p>
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-hairline bg-surface p-4 shadow-sm">
                <span className="font-semibold text-ink-900">{c.title}</span>
                {seasonId && phase !== 'nominating' && (
                  <Link to={`/admin/awards/${seasonId}/categories/${c.id}/curate`}>
                    <Button variant="secondary" size="sm">Curate</Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
        ) : (
          <>
            {categories.map((c, i) => (
              <CategoryEditorCard
                key={c.id}
                category={c}
                index={i}
                total={categories.length}
                onChange={(next) => updateCategory(i, next)}
                onRemove={() => removeCategory(i)}
                onMoveUp={() => moveCategory(i, -1)}
                onMoveDown={() => moveCategory(i, 1)}
              />
            ))}
            <Button variant="ghost" type="button" onClick={() => setCategories((prev) => [...prev, newCategory()])}>
              + Add category
            </Button>
          </>
        )}
      </div>

      {formError && <p className="mt-4 text-sm text-danger">{formError}</p>}

      <div className="mt-6 flex flex-wrap gap-3">
        {!locked && (
          <Button variant="primary" onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
            Save season
          </Button>
        )}
        {seasonId && advanceLabel && (
          <Button
            variant="accent"
            loading={advanceMutation.isPending}
            onClick={() => {
              if (confirm(`${advanceLabel}? This can't be undone.`)) advanceMutation.mutate()
            }}
          >
            {advanceLabel}
          </Button>
        )}
        <Link to="/admin/awards">
          <Button variant="secondary" type="button">Cancel</Button>
        </Link>
      </div>
    </div>
  )
}
