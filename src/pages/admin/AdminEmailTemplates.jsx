import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEmailTemplatesQuery, updateEmailTemplate } from '../../data/emailTemplates'
import {
  BROADCAST_TEMPLATES,
  BROADCAST_TEMPLATE_TOKENS,
  DEFAULT_BROADCAST_TEMPLATE_HTML,
  buildBroadcastEmailHtml,
} from '../../../api/_lib/emailTemplateHtml.js'
import Button from '../../components/ui/Button'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonCard } from '../../components/ui/Skeleton'
import { useToast } from '../../lib/ToastContext'

const SAMPLE = {
  subject: 'Sample broadcast subject',
  body: 'This is sample body text so you can preview the template while you edit it.\n\nA second paragraph, with a link: https://www.nammeshub.com.ng',
  imageUrl: 'https://placehold.co/520x260/0b2417/ffffff?text=Sample+Image',
}

export default function AdminEmailTemplates() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const templatesQuery = useEmailTemplatesQuery()
  const [activeId, setActiveId] = useState('default')
  const [draft, setDraft] = useState('')
  const [dirty, setDirty] = useState(false)

  const activeRow = templatesQuery.data?.find((t) => t.template_id === activeId)

  useEffect(() => {
    if (templatesQuery.data) {
      setDraft(activeRow?.html ?? '')
      setDirty(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, templatesQuery.data])

  const saveMutation = useMutation({
    mutationFn: () => updateEmailTemplate(activeId, draft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email_templates'] })
      setDirty(false)
      toast.success('Template saved.')
    },
    onError: (error) => toast.error(error.message),
  })

  function handleSelect(id) {
    if (id === activeId) return
    if (dirty && !window.confirm('Discard unsaved changes to this template?')) return
    setActiveId(id)
  }

  function handleChange(event) {
    setDraft(event.target.value)
    setDirty(true)
  }

  function handleResetToDefault() {
    if (!window.confirm('Reset this template to the factory default? Unsaved until you click Save.')) return
    setDraft(DEFAULT_BROADCAST_TEMPLATE_HTML[activeId] ?? '')
    setDirty(true)
  }

  const previewHtml = useMemo(
    () => buildBroadcastEmailHtml({ ...SAMPLE, templateId: activeId, customHtml: draft || undefined }),
    [draft, activeId],
  )

  if (templatesQuery.isError && !templatesQuery.data) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load email templates right now." onRetry={templatesQuery.refetch} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-ink-900">Email Templates</h1>
      <p className="mt-1 max-w-2xl text-ink-muted">
        Edit the raw HTML behind each broadcast template. Use the tokens below to inject the subject, body, image, and
        date — everything else is yours to change.
      </p>

      {templatesQuery.isLoading ? (
        <div className="mt-6">
          <SkeletonCard />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[160px_1fr_1fr]">
          <div className="flex flex-row gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {BROADCAST_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleSelect(t.id)}
                className={`shrink-0 rounded-md border px-3 py-2 text-left text-sm font-semibold transition-colors duration-150 ${
                  activeId === t.id
                    ? 'border-green-900 bg-green-900 text-white'
                    : 'border-hairline bg-surface-low text-ink hover:bg-hairline/20'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button type="button" variant="primary" size="sm" loading={saveMutation.isPending} disabled={!dirty} onClick={() => saveMutation.mutate()}>
                  Save
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={handleResetToDefault}>
                  Reset to default
                </Button>
              </div>
              {activeRow?.updated_at && (
                <span className="text-xs text-ink-muted">Updated {new Date(activeRow.updated_at).toLocaleString()}</span>
              )}
            </div>
            <textarea
              value={draft}
              onChange={handleChange}
              spellCheck={false}
              className="h-[560px] w-full resize-y rounded-md border border-hairline bg-surface p-3 font-mono text-xs leading-relaxed text-ink focus:border-brand focus:outline-none"
            />
            <div className="rounded-md border border-hairline bg-surface-low p-3">
              <p className="text-xs font-semibold uppercase tracking-[.05em] text-orange-600">Placeholder tokens</p>
              <ul className="mt-2 flex flex-col gap-1">
                {BROADCAST_TEMPLATE_TOKENS.map((t) => (
                  <li key={t.token} className="text-xs text-ink-muted">
                    <code className="rounded bg-surface px-1 py-0.5 font-mono text-ink-900">{t.token}</code> — {t.description}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-hairline bg-surface-low shadow-sm lg:sticky lg:top-6">
            <div className="border-b border-hairline bg-surface px-4 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-[.05em] text-ink-muted">Preview (sample content)</p>
            </div>
            <iframe title="Email template preview" srcDoc={previewHtml} className="h-[620px] w-full bg-white" />
          </div>
        </div>
      )}
    </div>
  )
}
