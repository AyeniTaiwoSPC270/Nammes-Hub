import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../lib/ToastContext'
import { useCategoryQuery } from '../../data/awardSeasons'
import { useCategoryNominationsQuery, groupNominationsByText } from '../../data/awardNominations'
import { useNomineesQuery, createNominee, deleteNominee } from '../../data/awardNominees'
import Breadcrumbs from '../../components/Breadcrumbs'
import Button from '../../components/ui/Button'
import FormField from '../../components/ui/FormField'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import AwardNomineePhotoUploadField from '../../components/admin/AwardNomineePhotoUploadField'

export default function AdminAwardCurate() {
  const { seasonId, categoryId } = useParams()
  const queryClient = useQueryClient()
  const toast = useToast()
  const categoryQuery = useCategoryQuery(categoryId)
  const nominationsQuery = useCategoryNominationsQuery(categoryId)
  const nomineesQuery = useNomineesQuery([categoryId])

  const [addingKey, setAddingKey] = useState(null)
  const [draftName, setDraftName] = useState('')
  const [draftPhotoUrl, setDraftPhotoUrl] = useState('')

  const createMutation = useMutation({
    mutationFn: () => createNominee({ categoryId, name: draftName.trim(), photoUrl: draftPhotoUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['award_nominees'] })
      toast.success('Added to the shortlist.')
      setAddingKey(null)
      setDraftName('')
      setDraftPhotoUrl('')
    },
    onError: (error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteNominee(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['award_nominees'] })
      toast.success('Removed from the shortlist.')
    },
    onError: (error) => toast.error(error.message),
  })

  if (categoryQuery.isError || nominationsQuery.isError) {
    return (
      <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load this category." onRetry={() => { categoryQuery.refetch(); nominationsQuery.refetch() }} />
      </div>
    )
  }
  if (!categoryQuery.data || !nominationsQuery.data) return null

  const groups = groupNominationsByText(nominationsQuery.data)
  const nominees = nomineesQuery.data ?? []
  const shortlistedNames = new Set(nominees.map((n) => n.name.trim().toLowerCase()))

  return (
    <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
      <Breadcrumbs items={[
        { label: 'Admin', to: '/admin' },
        { label: 'Awards', to: '/admin/awards' },
        { label: 'Edit', to: `/admin/awards/${seasonId}/edit` },
        { label: 'Curate' },
      ]} />

      <h1 className="text-3xl font-bold text-ink-900">Curate: {categoryQuery.data.title}</h1>
      <p className="text-ink-muted">{nominationsQuery.data.length} raw nomination{nominationsQuery.data.length === 1 ? '' : 's'} submitted.</p>

      <h2 className="mt-8 text-lg font-bold text-ink-900">Shortlist ({nominees.length})</h2>
      {nominees.length === 0 ? (
        <div className="mt-3">
          <EmptyState icon="star" title="No nominees yet" description="Add nominees from the raw submissions below." />
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {nominees.map((n) => (
            <div key={n.id} className="flex items-center justify-between rounded-lg border border-hairline bg-surface p-4 shadow-sm">
              <div className="flex items-center gap-3">
                {n.photo_url && <img src={n.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />}
                <span className="font-semibold text-ink-900">{n.name}</span>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm(`Remove ${n.name} from the shortlist?`)) deleteMutation.mutate(n.id)
                }}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      <h2 className="mt-8 text-lg font-bold text-ink-900">Raw submissions</h2>
      {groups.length === 0 ? (
        <div className="mt-3">
          <EmptyState icon="inbox" title="No nominations yet" description="Nothing has been submitted for this category." />
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {groups.map((g) => {
            const key = g.displayName.toLowerCase()
            const alreadyShortlisted = shortlistedNames.has(key)
            const isAdding = addingKey === key
            return (
              <div key={key} className="rounded-lg border border-hairline bg-surface p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-ink">
                    {g.displayName} <span className="text-xs text-ink-muted">({g.count} mention{g.count === 1 ? '' : 's'})</span>
                  </span>
                  {alreadyShortlisted ? (
                    <span className="text-xs font-semibold text-success">On shortlist</span>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setAddingKey(key)
                        setDraftName(g.displayName)
                        setDraftPhotoUrl('')
                      }}
                    >
                      Add as nominee
                    </Button>
                  )}
                </div>
                {isAdding && (
                  <div className="mt-4 flex flex-col gap-3 border-t border-hairline pt-4">
                    <FormField label="Nominee name" value={draftName} onChange={(e) => setDraftName(e.target.value)} required />
                    <AwardNomineePhotoUploadField label="Photo" url={draftPhotoUrl} onChange={setDraftPhotoUrl} />
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        loading={createMutation.isPending}
                        disabled={!draftName.trim()}
                        onClick={() => createMutation.mutate()}
                      >
                        Confirm
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setAddingKey(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Link to={`/admin/awards/${seasonId}/edit`} className="mt-8 inline-block">
        <Button variant="secondary">Back to season</Button>
      </Link>
    </div>
  )
}
