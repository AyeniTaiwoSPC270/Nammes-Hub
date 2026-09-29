import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../lib/ToastContext'
import { useContactMessagesQuery, deleteContactMessage } from '../../data/contactMessages'
import Table from '../../components/ui/Table'
import Button from '../../components/ui/Button'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonTable } from '../../components/ui/Skeleton'

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : '—'
}

export default function AdminMessages() {
  const messagesQuery = useContactMessagesQuery()
  const queryClient = useQueryClient()
  const toast = useToast()
  const messages = messagesQuery.data ?? []

  const deleteMutation = useMutation({
    mutationFn: deleteContactMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact_messages'] })
      toast.success('Message deleted.')
    },
    onError: (error) => toast.error(error.message),
  })

  if (messagesQuery.isError && !messagesQuery.data) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load messages right now." onRetry={messagesQuery.refetch} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-ink-900">Messages</h1>
      <p className="mt-1 text-ink-muted">Messages sent through the contact form, newest first.</p>

      {messagesQuery.isLoading ? (
        <div className="mt-6">
          <SkeletonTable columns={5} rows={4} />
        </div>
      ) : messages.length === 0 ? (
        <p className="mt-6 text-ink-muted">No messages yet.</p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-hairline bg-surface shadow-md">
          <Table
            columns={['Received', 'Name', 'Email', 'Message', 'Actions']}
            rows={messages.map((m) => [
              formatDateTime(m.created_at),
              m.name,
              <a key="email" className="font-semibold text-orange-600 hover:underline" href={`mailto:${encodeURIComponent(m.email)}`}>
                {m.email}
              </a>,
              <p key="message" className="max-w-[420px] whitespace-pre-wrap break-words">
                {m.message}
              </p>,
              <Button
                key="actions"
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm('Delete this message? This can\u2019t be undone.')) deleteMutation.mutate(m.id)
                }}
              >
                Delete
              </Button>,
            ])}
          />
        </div>
      )}
    </div>
  )
}
