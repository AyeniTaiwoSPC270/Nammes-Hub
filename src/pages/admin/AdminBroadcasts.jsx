import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useBroadcastHistoryQuery, sendBroadcast } from '../../data/broadcasts'
import { useEmailTemplatesQuery } from '../../data/emailTemplates'
import Button from '../../components/ui/Button'
import FormField from '../../components/ui/FormField'
import Table from '../../components/ui/Table'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonTable } from '../../components/ui/Skeleton'
import { useToast } from '../../lib/ToastContext'
import { buildBroadcastEmailHtml, BROADCAST_TEMPLATES } from '../../../api/_lib/emailTemplateHtml.js'
import BroadcastImageUploadField from '../../components/admin/BroadcastImageUploadField'

export default function AdminBroadcasts() {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [templateId, setTemplateId] = useState('default')
  const toast = useToast()
  const queryClient = useQueryClient()
  const historyQuery = useBroadcastHistoryQuery()
  const templatesQuery = useEmailTemplatesQuery()

  const sendMutation = useMutation({
    mutationFn: sendBroadcast,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts', 'history'] })
      setSubject('')
      setBody('')
      setImageUrl('')
      setTemplateId('default')
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
    sendMutation.mutate({ subject, body, imageUrl: imageUrl || undefined, templateId })
  }

  const customHtml = templatesQuery.data?.find((t) => t.template_id === templateId)?.html

  const previewHtml = useMemo(
    () =>
      buildBroadcastEmailHtml({
        subject: subject.trim() || 'Your subject line',
        body: body.trim() || 'Start typing to see the email body here…',
        imageUrl: imageUrl || undefined,
        templateId,
        customHtml,
      }),
    [subject, body, imageUrl, templateId, customHtml],
  )

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

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr] lg:items-start">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-5 shadow-sm">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[.05em] text-orange-600">Template</span>
              <Link to="/admin/email-templates" className="text-xs font-semibold text-brand no-underline hover:text-orange-500">
                Edit templates
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {BROADCAST_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplateId(t.id)}
                  title={t.description}
                  className={`rounded-md border px-3 py-2 text-left text-xs font-semibold transition-colors duration-150 ${
                    templateId === t.id
                      ? 'border-green-900 bg-green-900 text-white'
                      : 'border-hairline bg-surface-low text-ink hover:bg-hairline/20'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <FormField label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
          <BroadcastImageUploadField label="Image (optional)" url={imageUrl} onChange={setImageUrl} />
          <FormField
            label="Body"
            type="textarea"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            helper="Add a link with [link text](https://example.com), or paste a bare URL — it becomes clickable automatically."
            required
          />
          <Button type="submit" variant="primary" loading={sendMutation.isPending}>
            Send broadcast
          </Button>
        </form>

        <div className="overflow-hidden rounded-lg border border-hairline bg-surface-low shadow-sm lg:sticky lg:top-6">
          <div className="border-b border-hairline bg-surface px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-[.05em] text-ink-muted">Live preview</p>
            <p className="mt-0.5 truncate text-sm text-ink-900">
              {subject.trim() || <span className="italic text-ink-muted">No subject yet</span>}
            </p>
          </div>
          <iframe title="Broadcast email preview" srcDoc={previewHtml} className="h-[560px] w-full bg-white" />
        </div>
      </div>

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
            columns={['Subject', 'Template', 'Recipients', 'Sent']}
            rows={history.map((b) => [
              b.subject,
              BROADCAST_TEMPLATES.find((t) => t.id === b.template_id)?.label || 'Default',
              b.recipient_count,
              new Date(b.created_at).toLocaleString(),
            ])}
          />
        </div>
      )}
    </div>
  )
}
