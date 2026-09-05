import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { useAllPendingRequestsQuery, approveChangeRequest, rejectChangeRequest, computeFieldDiff } from '../../data/changeRequests'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonTable } from '../../components/ui/Skeleton'
import { useToast } from '../../lib/ToastContext'

const TABLE_BY_ENTITY = { news: 'news', events: 'events', award_season: 'award_seasons' }

async function fetchLiveRow(entityType, recordId) {
  if (!recordId) return null
  const table = TABLE_BY_ENTITY[entityType]
  const { data } = await supabase.from(table).select('*').eq('id', recordId).maybeSingle()
  return data
}

function ReviewCard({ request, onApprove, onReject, busy }) {
  const [reason, setReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const liveRowQuery = useQuery({
    queryKey: ['change_requests', 'live', request.entity_type, request.record_id],
    queryFn: () => fetchLiveRow(request.entity_type, request.record_id),
  })
  const payload = request.entity_type === 'award_season' ? { title: request.payload.title } : request.payload
  const diff = computeFieldDiff(liveRowQuery.data, payload)

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge tone="new">{request.entity_type}</Badge>
          <Badge tone="neutral">{request.action}</Badge>
        </div>
        <span className="text-xs text-ink-muted">{new Date(request.created_at).toLocaleString()}</span>
      </div>
      <div className="flex flex-col gap-1">
        {diff.length === 0 && <p className="text-sm text-ink-muted">No visible field changes.</p>}
        {diff.map((change) => (
          <div key={change.field} className="text-sm">
            <span className="font-semibold text-ink-900">{change.field}: </span>
            <span className="text-danger line-through">{String(change.before ?? '—')}</span>{' '}
            <span className="text-success">{String(change.after ?? '—')}</span>
          </div>
        ))}
      </div>
      {request.entity_type === 'award_season' && (
        <p className="text-xs text-ink-muted">{request.payload.categories?.length ?? 0} category(ies) proposed.</p>
      )}
      {rejecting ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejection"
            className="w-full rounded-md border border-hairline bg-surface p-2 text-sm outline-none focus:border-green-900"
          />
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setRejecting(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" loading={busy} onClick={() => onReject(request.id, reason)}>
              Confirm reject
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button variant="primary" size="sm" loading={busy} onClick={() => onApprove(request.id)}>
            Approve
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setRejecting(true)}>
            Reject
          </Button>
        </div>
      )}
    </div>
  )
}

export default function AdminReviews() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const pendingQuery = useAllPendingRequestsQuery()
  const requests = pendingQuery.data ?? []

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['change_requests'] })
    queryClient.invalidateQueries({ queryKey: ['news'] })
    queryClient.invalidateQueries({ queryKey: ['events'] })
    queryClient.invalidateQueries({ queryKey: ['award_seasons'] })
  }

  const approveMutation = useMutation({
    mutationFn: approveChangeRequest,
    onSuccess: () => {
      invalidate()
      toast.success('Approved and published.')
    },
    onError: (error) => toast.error(error.message),
  })
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => rejectChangeRequest(id, reason),
    onSuccess: () => {
      invalidate()
      toast.success('Rejected.')
    },
    onError: (error) => toast.error(error.message),
  })

  if (pendingQuery.isError && !pendingQuery.data) {
    return (
      <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load the review queue right now." onRetry={pendingQuery.refetch} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-ink-900">Review queue</h1>
      <p className="mt-1 text-ink-muted">Changes admins have submitted for News, Events, and Awards.</p>

      {pendingQuery.isLoading ? (
        <div className="mt-6">
          <SkeletonTable columns={2} rows={3} />
        </div>
      ) : requests.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon="fact_check" title="Nothing pending" description="Submitted changes will show up here." />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {requests.map((request) => (
            <ReviewCard
              key={request.id}
              request={request}
              busy={approveMutation.isPending || rejectMutation.isPending}
              onApprove={(id) => approveMutation.mutate(id)}
              onReject={(id, reason) => rejectMutation.mutate({ id, reason })}
            />
          ))}
        </div>
      )}
    </div>
  )
}
