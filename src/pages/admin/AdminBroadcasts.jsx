import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useBroadcastHistoryQuery, sendBroadcast } from '../../data/broadcasts'
import Button from '../../components/ui/Button'
import FormField from '../../components/ui/FormField'
import Table from '../../components/ui/Table'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonTable } from '../../components/ui/Skeleton'
import { useToast } from '../../lib/ToastContext'

export default function AdminBroadcasts() {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const toast = useToast()
  const queryClient = useQueryClient()
  const historyQuery = useBroadcastHistoryQuery()

  const sendMutation = useMutation({
    mutationFn: sendBroadcast,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts', 'history'] })
      setSubject('')
      setBody('')
      toast.success(
        result.sentCount === result.recipientCount
          ? `Sent to ${result.sentCount} recipient(s).`
          : `Sent to ${result.sentCount} of ${result.recipientCount} recipient(s) — check logs for failures.`,
      )
    },
    onError: (error) => toast.error(error.message),
  })

  function handleSubmit(event) {
    event.preventDefault()
    sendMutation.mutate({ subject, body })
  }

  if (historyQuery.isError && !historyQuery.data) {
    return (
      <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load broadcast history right now." onRetry={historyQuery.refetch} />
      </div>
    )
  }

  const history = historyQuery.data ?? []

  return (
    <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-ink-900">Broadcasts</h1>
      <p className="mt-1 text-ink-muted">Send an email to every opted-in user on NAMMES Hub.</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-5 shadow-sm">
        <FormField label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
        <FormField label="Body" type="textarea" value={body} onChange={(e) => setBody(e.target.value)} required />
        <Button type="submit" variant="primary" loading={sendMutation.isPending}>
          Send broadcast
        </Button>
      </form>

      <h2 className="mt-10 text-xl font-bold text-ink-900">History</h2>
      {historyQuery.isLoading ? (
        <div className="mt-4">
          <SkeletonTable columns={3} rows={3} />
        </div>
      ) : history.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon="campaign" title="No broadcasts yet" description="Sent broadcasts will show up here." />
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-hairline bg-surface shadow-md">
          <Table
            columns={['Subject', 'Recipients', 'Sent']}
            rows={history.map((b) => [b.subject, b.recipient_count, new Date(b.created_at).toLocaleString()])}
          />
        </div>
      )}
    </div>
  )
}
