import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useToast } from '../../lib/ToastContext'
import { useAuth } from '../../lib/AuthContext'
import { useOwnAdminRowQuery } from '../../data/admins'
import {
  useContactMessagesQuery,
  deleteContactMessage,
  setContactMessageHandled,
} from '../../data/contactMessages'
import { useHubFeedbackQuery, setFeedbackHandled, feedbackCategoryLabel } from '../../data/feedback'
import { reportCategoryLabel } from '../../data/reports'
import Badge from '../../components/ui/Badge'
import Table from '../../components/ui/Table'
import Button from '../../components/ui/Button'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonTable } from '../../components/ui/Skeleton'

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : '—'
}

const isReport = (m) => m.kind === 'report'

// The filter lives in the URL rather than component state, so a link in the admin inbox
// ("/admin/messages?filter=reports") lands on the right view and the browser back button works.
const FILTERS = [
  ['all', 'All'],
  ['messages', 'Messages'],
  ['reports', 'Reports'],
  ['feedback', 'Feedback'],
]

function statusBadge(handled) {
  return <Badge key="status" tone={handled ? 'updated' : 'new'}>{handled ? 'Handled' : 'New'}</Badge>
}

function actionButtons(row, { isPending, onToggleHandled, onDelete, canDelete, deleteLabel }) {
  return (
    <div key="actions" className="flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        disabled={isPending}
        onClick={() => onToggleHandled({ id: row.id, handled: !row.handled })}
      >
        {row.handled ? 'Reopen' : 'Mark handled'}
      </Button>
      {canDelete && (
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            if (confirm(`${deleteLabel} This can\u2019t be undone.`)) onDelete(row.id)
          }}
        >
          Delete
        </Button>
      )}
    </div>
  )
}

export default function AdminMessages() {
  const messagesQuery = useContactMessagesQuery()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { user } = useAuth()
  const adminRowQuery = useOwnAdminRowQuery(user?.id)
  const isOwner = Boolean(adminRowQuery.data?.is_owner)
  const [searchParams, setSearchParams] = useSearchParams()

  const requested = searchParams.get('filter')
  const filter = FILTERS.some(([key]) => key === requested) ? requested : 'all'
  const showingFeedback = filter === 'feedback'

  // Feedback lives in its own table, so its query is only enabled on its own tab: an admin who
  // never opens it should never pay for it.
  const feedbackQuery = useHubFeedbackQuery(showingFeedback)

  const all = messagesQuery.data ?? []
  const reports = all.filter(isReport)
  const conversations = all.filter((m) => !isReport(m))
  const messageRows = filter === 'reports' ? reports : filter === 'messages' ? conversations : all

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['contact_messages'] })
    queryClient.invalidateQueries({ queryKey: ['hub_feedback'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'analytics'] })
    queryClient.invalidateQueries({ queryKey: ['admin_inbox'] })
  }

  const deleteMutation = useMutation({
    mutationFn: deleteContactMessage,
    onSuccess: () => {
      invalidate()
      toast.success('Message deleted.')
    },
    onError: (error) => toast.error(error.message),
  })

  // Marking a message handled is what makes the dashboard's "messages unanswered" count mean
  // something; without a writer on this screen that number could only ever grow.
  const handledMutation = useMutation({
    mutationFn: ({ id, handled }) => setContactMessageHandled(id, handled, user?.id),
    onSuccess: invalidate,
    onError: (error) => toast.error(error.message),
  })

  const feedbackMutation = useMutation({
    mutationFn: ({ id, handled }) => setFeedbackHandled(id, handled, user?.id),
    onSuccess: invalidate,
    onError: (error) => toast.error(error.message),
  })

  if (showingFeedback && feedbackQuery.isError && !feedbackQuery.data) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load feedback right now." onRetry={feedbackQuery.refetch} />
      </div>
    )
  }

  if (!showingFeedback && messagesQuery.isError && !messagesQuery.data) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load messages right now." onRetry={messagesQuery.refetch} />
      </div>
    )
  }

  // Four column sets rather than one shared table: a report has no name and no email to reply to,
  // and a rating has neither plus no note, so empty "Name"/"Email" cells would bury the thing an
  // admin actually needs -- which page it was on, or what the rating was.
  let columns
  let tableRows
  let isLoading

  if (showingFeedback) {
    columns = ['Received', 'Rating', 'Reason', 'Comment', 'Page', 'Status', 'Actions']
    isLoading = feedbackQuery.isLoading
    tableRows = (feedbackQuery.data ?? []).map((f) => [
      formatDateTime(f.created_at),
      <span key="rating" className="font-semibold text-ink-900">
        {'★'.repeat(f.rating)}
        <span className="text-ink-muted">{'★'.repeat(5 - f.rating)}</span>
        <span className="ml-1.5 text-ink-muted">{f.rating}/5</span>
      </span>,
      <Badge key="reason" tone="neutral">{feedbackCategoryLabel(f.category)}</Badge>,
      <p key="comment" className="max-w-[420px] whitespace-pre-wrap break-words">{f.message || '—'}</p>,
      <span key="page" className="text-sm text-ink-muted">{f.page_path || '—'}</span>,
      statusBadge(f.handled),
      actionButtons(f, {
        isPending: feedbackMutation.isPending,
        onToggleHandled: feedbackMutation.mutate,
        onDelete: () => {},
        canDelete: false,
        deleteLabel: '',
      }),
    ])
  } else {
    columns =
      filter === 'reports'
        ? ['Received', 'Page', 'Category', 'Note', 'Status', 'Actions']
        : filter === 'messages'
          ? ['Received', 'Name', 'Email', 'Message', 'Status', 'Actions']
          : ['Received', 'Who or page', 'Message', 'Status', 'Actions']
    isLoading = messagesQuery.isLoading
    tableRows = messageRows.map((m) => {
      const shared = {
        isPending: handledMutation.isPending,
        onToggleHandled: handledMutation.mutate,
        onDelete: deleteMutation.mutate,
        canDelete: isOwner,
        deleteLabel: 'Delete this message?',
      }
      if (isReport(m)) {
        if (filter === 'reports') {
          return [
            formatDateTime(m.created_at),
            <a key="page" href={m.page_url} className="font-semibold text-orange-600 hover:underline">
              {m.page_title || m.page_url}
            </a>,
            <Badge key="cat" tone="neutral">{reportCategoryLabel(m.category)}</Badge>,
            <p key="note" className="max-w-[420px] whitespace-pre-wrap break-words">{m.message || '—'}</p>,
            statusBadge(Boolean(m.handled_at)),
            actionButtons({ ...m, handled: Boolean(m.handled_at) }, { ...shared, deleteLabel: 'Delete this report?' }),
          ]
        }
        return [
          formatDateTime(m.created_at),
          filter === 'all' ? (
            <a key="page" href={m.page_url} className="font-semibold text-orange-600 hover:underline">
              {m.page_title || m.page_url}
            </a>
          ) : (
            <Badge key="cat" tone="neutral">{reportCategoryLabel(m.category)}</Badge>
          ),
          <p key="note" className="max-w-[420px] whitespace-pre-wrap break-words">{m.message || '—'}</p>,
          statusBadge(Boolean(m.handled_at)),
          actionButtons({ ...m, handled: Boolean(m.handled_at) }, shared),
        ]
      }
      if (filter === 'messages') {
        return [
          formatDateTime(m.created_at),
          m.name,
          <a key="email" className="font-semibold text-orange-600 hover:underline" href={`mailto:${encodeURIComponent(m.email)}`}>
            {m.email}
          </a>,
          <p key="message" className="max-w-[420px] whitespace-pre-wrap break-words">{m.message}</p>,
          statusBadge(Boolean(m.handled_at)),
          actionButtons({ ...m, handled: Boolean(m.handled_at) }, shared),
        ]
      }
      return [
        formatDateTime(m.created_at),
        <div key="who" className="max-w-[240px]">
          <p className="font-semibold text-ink-900">{m.name}</p>
          <a className="text-sm font-semibold text-orange-600 hover:underline" href={`mailto:${encodeURIComponent(m.email)}`}>
            {m.email}
          </a>
        </div>,
        <p key="message" className="max-w-[420px] whitespace-pre-wrap break-words">{m.message}</p>,
        statusBadge(Boolean(m.handled_at)),
        actionButtons({ ...m, handled: Boolean(m.handled_at) }, shared),
      ]
    })
  }

  const counts = {
    all: all.length,
    messages: conversations.length,
    reports: reports.length,
    feedback: feedbackQuery.data?.length ?? 0,
  }

  const emptyCopy = {
    all: 'No messages yet.',
    messages: 'No messages yet.',
    reports: 'No problem reports yet.',
    feedback: 'No ratings yet.',
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-ink-900">Messages</h1>
      <p className="mt-1 text-ink-muted">Messages, problem reports and ratings, newest first.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map(([key, label]) => {
          const active = filter === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSearchParams({ filter: key })}
              className={[
                'rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors',
                active
                  ? 'border-brand bg-brand text-white'
                  : 'border-hairline bg-surface text-ink-muted hover:text-ink-900',
              ].join(' ')}
            >
              {label} ({counts[key]})
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <div className="mt-6">
          <SkeletonTable columns={columns.length} rows={4} />
        </div>
      ) : tableRows.length === 0 ? (
        <p className="mt-6 text-ink-muted">{emptyCopy[filter]}</p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-hairline bg-surface shadow-md">
          <Table columns={columns} rows={tableRows} />
        </div>
      )}
    </div>
  )
}
