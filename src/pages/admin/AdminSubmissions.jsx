import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { useOutlinesQuery } from '../../data/outlines'
import { useAllSubmissionsQuery } from '../../data/outlineSubmissions'
import Breadcrumbs from '../../components/Breadcrumbs'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonTable } from '../../components/ui/Skeleton'
import { useToast } from '../../lib/ToastContext'

function assertRowsChanged(rows) {
  if (!rows || rows.length === 0) {
    throw new Error('No changes were saved — your account may not have admin access to make this change.')
  }
}

export default function AdminSubmissions() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [tab, setTab] = useState('pending')

  const outlinesQuery = useOutlinesQuery()
  const outlineById = new Map((outlinesQuery.data ?? []).map((o) => [o.id, o]))

  const submissionsQuery = useAllSubmissionsQuery()
  const rows = submissionsQuery.data ?? []
  const pendingRows = rows.filter((r) => r.status === 'pending')
  const historyRows = rows.filter((r) => r.status !== 'pending')
  const visibleRows = tab === 'pending' ? pendingRows : historyRows

  const approveMutation = useMutation({
    mutationFn: async (row) => {
      const { data, error } = await supabase
        .from('outline_submissions')
        .update({ status: 'approved' })
        .eq('id', row.id)
        .select()
      if (error) throw error
      assertRowsChanged(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outline_submissions'] })
      toast.success('Submission approved.')
    },
    onError: (error) => toast.error(error.message),
  })

  const rejectMutation = useMutation({
    mutationFn: async (row) => {
      const { data, error } = await supabase
        .from('outline_submissions')
        .update({ status: 'rejected' })
        .eq('id', row.id)
        .select()
      if (error) throw error
      assertRowsChanged(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outline_submissions'] })
      toast.success('Submission rejected.')
    },
    onError: (error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (row) => {
      if (row.file_url) {
        const path = row.file_url.split('/outline-attachments/')[1]
        if (path) await supabase.storage.from('outline-attachments').remove([decodeURIComponent(path)])
      }
      const { data, error } = await supabase.from('outline_submissions').delete().eq('id', row.id).select()
      if (error) throw error
      assertRowsChanged(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outline_submissions'] })
      toast.success('Submission deleted.')
    },
    onError: (error) => toast.error(error.message),
  })

  if (submissionsQuery.isError && !submissionsQuery.data) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load submissions right now." onRetry={submissionsQuery.refetch} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Submissions' }]} />

      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-ink-900">Submissions</h1>
        <p className="text-ink-muted">Review student-contributed past questions, notes, and other materials.</p>
      </div>

      <div className="mt-6 flex gap-2 border-b border-hairline">
        <button
          type="button"
          onClick={() => setTab('pending')}
          className={[
            'px-4 py-2 text-sm font-semibold border-b-2 -mb-px',
            tab === 'pending' ? 'border-green-900 text-green-900' : 'border-transparent text-ink-muted',
          ].join(' ')}
        >
          Pending{pendingRows.length > 0 ? ` (${pendingRows.length})` : ''}
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={[
            'px-4 py-2 text-sm font-semibold border-b-2 -mb-px',
            tab === 'history' ? 'border-green-900 text-green-900' : 'border-transparent text-ink-muted',
          ].join(' ')}
        >
          Approved / rejected
        </button>
      </div>

      {submissionsQuery.isLoading ? (
        <div className="mt-6">
          <SkeletonTable columns={5} rows={5} />
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon="fact_check"
            title={tab === 'pending' ? 'No pending submissions' : 'No history yet'}
            description={
              tab === 'pending'
                ? 'New student contributions will show up here.'
                : 'Approved and rejected submissions will show up here.'
            }
          />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {visibleRows.map((row) => (
            <div
              key={row.id}
              className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface p-4 shadow-md sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="text-xs font-semibold uppercase tracking-[.05em] text-orange-600">
                  {outlineById.get(row.outline_id)?.code ?? row.outline_id} &middot; {row.type}
                  {row.session ? ` · ${row.session}` : ''}
                </div>
                <a
                  href={row.file_url || row.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-ink-900 hover:underline"
                >
                  {row.title}
                </a>
                <div className="text-xs text-ink-muted">Submitted by {row.submitted_by_email}</div>
              </div>
              <div className="flex shrink-0 gap-2">
                {tab === 'pending' ? (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => approveMutation.mutate(row)}
                      loading={approveMutation.isPending}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => rejectMutation.mutate(row)}
                      loading={rejectMutation.isPending}
                    >
                      Reject
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteMutation.mutate(row)}
                    loading={deleteMutation.isPending}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
