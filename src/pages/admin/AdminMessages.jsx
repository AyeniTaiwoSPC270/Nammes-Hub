import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../lib/ToastContext'
import { useAuth } from '../../lib/AuthContext'
import { useOwnAdminRowQuery } from '../../data/admins'
import {
  useContactMessagesQuery,
  deleteContactMessage,
  setContactMessageHandled,
} from '../../data/contactMessages'
import Badge from '../../components/ui/Badge'
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
  const { user } = useAuth()
  const adminRowQuery = useOwnAdminRowQuery(user?.id)
  const isOwner = Boolean(adminRowQuery.data?.is_owner)
  const messages = messagesQuery.data ?? []

  const deleteMutation = useMutation({
    mutationFn: deleteContactMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact_messages'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'analytics'] })
      toast.success('Message deleted.')
    },
    onError: (error) => toast.error(error.message),
  })

  // Marking a message handled is what makes the dashboard's "messages unanswered" count mean something;
  // without a writer on this screen that number could only ever grow.
  const handledMutation = useMutation({
    mutationFn: ({ id, handled }) => setContactMessageHandled(id, handled, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact_messages'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'analytics'] })
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
            columns={['Received', 'Name', 'Email', 'Message', 'Status', 'Actions']}
            rows={messages.map((m) => [
              formatDateTime(m.created_at),
              m.name,
              <a key="email" className="font-semibold text-orange-600 hover:underline" href={`mailto:${encodeURIComponent(m.email)}`}>
                {m.email}
              </a>,
              <p key="message" className="max-w-[420px] whitespace-pre-wrap break-words">
                {m.message}
              </p>,
              <Badge key="status" tone={m.handled_at ? 'updated' : 'new'}>
                {m.handled_at ? 'Handled' : 'New'}
              </Badge>,
              <div key="actions" className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={handledMutation.isPending}
                  onClick={() => handledMutation.mutate({ id: m.id, handled: !m.handled_at })}
                >
                  {m.handled_at ? 'Reopen' : 'Mark handled'}
                </Button>
                {isOwner && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm('Delete this message? This can\u2019t be undone.')) deleteMutation.mutate(m.id)
                    }}
                  >
                    Delete
                  </Button>
                )}
              </div>,
            ])}
          />
        </div>
      )}
    </div>
  )
}
