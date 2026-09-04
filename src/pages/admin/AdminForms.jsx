import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { useAllFormsQuery, isFormOpen, fetchFormWithQuestions } from '../../data/forms'
import {
  useResponseCountsQuery,
  fetchFormResponses,
  collectFileUploadUrls,
  storagePathFromUrl,
} from '../../data/formResponses'
import Breadcrumbs from '../../components/Breadcrumbs'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonTable } from '../../components/ui/Skeleton'
import { useToast } from '../../lib/ToastContext'

function assertRowsChanged(rows) {
  if (!rows || rows.length === 0) {
    throw new Error('No changes were saved — your account may not have admin access to make this change.')
  }
}

export default function AdminForms() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const formsQuery = useAllFormsQuery()
  const countsQuery = useResponseCountsQuery()
  const forms = formsQuery.data ?? []
  const counts = countsQuery.data ?? {}

  const deleteMutation = useMutation({
    mutationFn: async (form) => {
      const fullForm = await fetchFormWithQuestions(form.id)
      const responses = await fetchFormResponses(form.id)
      const fileUrls = collectFileUploadUrls(fullForm.questions, responses)
      const paths = fileUrls.map((url) => storagePathFromUrl(url, 'form-uploads')).filter(Boolean)
      if (paths.length > 0) await supabase.storage.from('form-uploads').remove(paths)
      const { data, error } = await supabase.from('forms').delete().eq('id', form.id).select()
      if (error) throw error
      assertRowsChanged(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] })
      queryClient.invalidateQueries({ queryKey: ['form_responses'] })
      toast.success('Form deleted.')
    },
    onError: (error) => toast.error(error.message),
  })

  function handleDelete(form) {
    if (!confirm(`Delete "${form.title}"? This removes all its questions and responses.`)) return
    deleteMutation.mutate(form)
  }

  if (formsQuery.isError && !formsQuery.data) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load forms right now." onRetry={formsQuery.refetch} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Forms' }]} />

      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink-900">Forms</h1>
          <p className="text-ink-muted">Build forms and review responses.</p>
        </div>
        <Link to="/admin/forms/new">
          <Button variant="primary">New form</Button>
        </Link>
      </div>

      {formsQuery.isLoading ? (
        <div className="mt-6">
          <SkeletonTable columns={4} rows={5} />
        </div>
      ) : forms.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon="checklist"
            title="No forms yet"
            description="Create your first form to start collecting responses."
          />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {forms.map((form) => (
            <div
              key={form.id}
              className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface p-4 shadow-md sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink-900">{form.title}</span>
                  <Badge tone={isFormOpen(form) ? 'updated' : 'neutral'}>
                    {isFormOpen(form) ? 'Accepting' : 'Closed'}
                  </Badge>
                </div>
                <div className="text-xs text-ink-muted">
                  {counts[form.id] ?? 0} response{(counts[form.id] ?? 0) === 1 ? '' : 's'}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link to={`/admin/forms/${form.id}/edit`}>
                  <Button variant="secondary" size="sm">Edit</Button>
                </Link>
                <Link to={`/admin/forms/${form.id}/responses`}>
                  <Button variant="secondary" size="sm">Responses</Button>
                </Link>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(form)}
                  loading={deleteMutation.isPending}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
