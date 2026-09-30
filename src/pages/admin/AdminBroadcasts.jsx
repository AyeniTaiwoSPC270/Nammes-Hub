import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useBroadcastHistoryQuery } from '../../data/broadcasts'
import { useEmailTemplatesQuery } from '../../data/emailTemplates'
import {
  deleteBroadcastDraft,
  deleteEmailStyle,
  saveBroadcastDraft,
  saveEmailStyle,
  sendDesignedBroadcast,
  useBroadcastDraftsQuery,
  useEmailStylesQuery,
} from '../../data/emailStudio'
import Button from '../../components/ui/Button'
import Table from '../../components/ui/Table'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonTable } from '../../components/ui/Skeleton'
import { useToast } from '../../lib/ToastContext'
import { useAuth } from '../../lib/AuthContext'
import { BROADCAST_TEMPLATES, DEFAULT_BROADCAST_TEMPLATE_HTML } from '../../../api/_lib/emailTemplateHtml.js'
import { legacyToBlocks, newBlock, normalizeBlocks, normalizeDesign, presetDesign } from '../../../api/_lib/emailDesign.js'
import { buildEmailPreviewHtml } from '../../lib/emailPreviewHtml'
import { finalizeEmailImages } from '../../lib/emailImage'
import { useEmailPreviewImages } from '../../lib/useEmailPreviewImages'
import BlockEditor from '../../components/admin/email/BlockEditor'
import EmailPreview from '../../components/admin/email/EmailPreview'
import EmailStudioModal from '../../components/admin/email/EmailStudioModal'

const startingBlocks = () => [newBlock('text')]

export default function AdminBroadcasts() {
  const [subject, setSubject] = useState('')
  const [blocks, setBlocks] = useState(startingBlocks)
  const [templateId, setTemplateId] = useState('default')
  const [override, setOverride] = useState(null)
  const [draftId, setDraftId] = useState(null)
  const [studioOpen, setStudioOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [savingStyle, setSavingStyle] = useState(false)
  const [styleName, setStyleName] = useState('')
  const toast = useToast()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const historyQuery = useBroadcastHistoryQuery()
  const templatesQuery = useEmailTemplatesQuery()
  const stylesQuery = useEmailStylesQuery()
  const draftsQuery = useBroadcastDraftsQuery()

  const row = templatesQuery.data?.find((t) => t.template_id === templateId)
  // A template an admin hand-edited as raw HTML keeps using that HTML until a design replaces it.
  const handEdited = Boolean(row?.html) && row.html !== DEFAULT_BROADCAST_TEMPLATE_HTML[templateId]
  const templateDesign = row?.design ? normalizeDesign(row.design) : handEdited ? null : presetDesign(templateId)
  const effectiveDesign = override ?? templateDesign

  const applyPreviews = useEmailPreviewImages(blocks, effectiveDesign)
  const previewHtml = useMemo(
    () => applyPreviews(buildEmailPreviewHtml({ subject, blocks, design: effectiveDesign, customHtml: row?.html, templateId })),
    [subject, blocks, effectiveDesign, row?.html, templateId, applyPreviews],
  )

  const hasContent = subject.trim().length > 0 && normalizeBlocks(blocks).length > 0

  function resetForm() {
    setSubject('')
    setBlocks(startingBlocks())
    setTemplateId('default')
    setOverride(null)
    setDraftId(null)
    setConfirming(false)
  }

  // Bakes any cropped/adjusted pictures into real image files first: inboxes ignore CSS cropping.
  async function prepare() {
    const done = await finalizeEmailImages({ blocks, design: effectiveDesign })
    setBlocks(done.blocks)
    if (override) setOverride(done.design)
    return done
  }

  const sendMutation = useMutation({
    mutationFn: async ({ testOnly }) => {
      const done = await prepare()
      return sendDesignedBroadcast({
        subject,
        blocks: done.blocks,
        design: done.design ?? undefined,
        templateId,
        testOnly,
      })
    },
    onSuccess: (result, { testOnly }) => {
      if (testOnly) {
        toast.success(`Test email queued for ${user?.email ?? 'you'}. It should arrive within a minute or two.`)
        return
      }
      queryClient.invalidateQueries({ queryKey: ['broadcasts', 'history'] })
      if (draftId) deleteBroadcastDraft(draftId).then(() => queryClient.invalidateQueries({ queryKey: ['broadcast_drafts'] }))
      resetForm()
      toast.success(`Queued for ${result.sentCount} recipient(s). Delivery starts within a minute or two.`)
    },
    onError: (error) => {
      setConfirming(false)
      toast.error(error.message)
    },
  })

  const draftMutation = useMutation({
    mutationFn: async () => {
      const done = await prepare()
      return saveBroadcastDraft({ id: draftId, subject, templateId, blocks: done.blocks, design: override ? done.design : null })
    },
    onSuccess: (saved) => {
      setDraftId(saved.id)
      queryClient.invalidateQueries({ queryKey: ['broadcast_drafts'] })
      toast.success('Draft saved.')
    },
    onError: (error) => toast.error(error.message),
  })

  const styleMutation = useMutation({
    mutationFn: async () => {
      const done = await prepare()
      return saveEmailStyle({ name: styleName, design: done.design ?? presetDesign(templateId) })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email_styles'] })
      setSavingStyle(false)
      setStyleName('')
      toast.success('Style saved. Find it under “Saved styles”.')
    },
    onError: (error) => toast.error(error.message),
  })

  const deleteStyleMutation = useMutation({
    mutationFn: deleteEmailStyle,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email_styles'] }),
    onError: (error) => toast.error(error.message),
  })

  const deleteDraftMutation = useMutation({
    mutationFn: deleteBroadcastDraft,
    onSuccess: (_r, id) => {
      if (id === draftId) setDraftId(null)
      queryClient.invalidateQueries({ queryKey: ['broadcast_drafts'] })
    },
    onError: (error) => toast.error(error.message),
  })

  function loadDraft(draft) {
    setSubject(draft.subject)
    setBlocks(normalizeBlocks(draft.blocks).length ? normalizeBlocks(draft.blocks) : startingBlocks())
    setTemplateId(draft.template_id)
    setOverride(draft.design ? normalizeDesign(draft.design) : null)
    setDraftId(draft.id)
    setConfirming(false)
  }

  function openFromHistory(broadcast) {
    setSubject(broadcast.subject)
    const restored = broadcast.blocks ? normalizeBlocks(broadcast.blocks) : legacyToBlocks({ body: broadcast.body, imageUrl: broadcast.image_url })
    setBlocks(restored.length ? restored : startingBlocks())
    setTemplateId(broadcast.template_id || 'default')
    setOverride(broadcast.design ? normalizeDesign(broadcast.design) : null)
    setDraftId(null)
    setConfirming(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (historyQuery.isError && !historyQuery.data) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load broadcast history right now." onRetry={historyQuery.refetch} />
      </div>
    )
  }

  const history = historyQuery.data ?? []
  const drafts = draftsQuery.data ?? []
  const styles = stylesQuery.data ?? []
  const busy = sendMutation.isPending || draftMutation.isPending

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-ink-900">Broadcasts</h1>
      <p className="mt-1 text-ink-muted">Design an email and send it to every opted-in user on NAMMES Hub.</p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-5 shadow-sm">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[.05em] text-orange-600">Look</span>
              <Link to="/admin/email-templates" className="py-2 text-xs font-semibold text-brand no-underline hover:text-orange-500">
                Edit templates
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {BROADCAST_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTemplateId(t.id)
                    setOverride(null)
                  }}
                  title={t.description}
                  className={`min-h-10 rounded-md border px-3 py-2 text-left text-xs font-semibold transition-colors duration-150 ${
                    templateId === t.id && !override
                      ? 'border-green-900 bg-green-900 text-white'
                      : 'border-hairline bg-surface-low text-ink hover:bg-hairline/20'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setStudioOpen(true)}>
                <span className="material-symbols-outlined text-base">palette</span>
                Customize design
              </Button>
              {override && (
                <>
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs uppercase text-orange-600">Customized for this email</span>
                  <button type="button" onClick={() => setOverride(null)} className="min-h-10 px-1 text-xs font-semibold text-brand hover:underline">
                    Back to template look
                  </button>
                  <button type="button" onClick={() => setSavingStyle((v) => !v)} className="min-h-10 px-1 text-xs font-semibold text-brand hover:underline">
                    Save as style
                  </button>
                </>
              )}
            </div>

            {savingStyle && (
              <div className="flex flex-wrap items-center gap-2 rounded-md bg-surface-low p-2">
                <input
                  value={styleName}
                  onChange={(e) => setStyleName(e.target.value)}
                  maxLength={60}
                  placeholder="Style name, e.g. Exam notice"
                  className="min-h-10 min-w-0 flex-1 rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand"
                />
                <Button type="button" variant="primary" size="sm" loading={styleMutation.isPending} disabled={!styleName.trim()} onClick={() => styleMutation.mutate()}>
                  Save
                </Button>
              </div>
            )}

            {styles.length > 0 && (
              <div className="mt-1 flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-ink">Saved styles</span>
                <div className="flex flex-wrap gap-2">
                  {styles.map((s) => (
                    <span key={s.id} className="inline-flex items-center overflow-hidden rounded-md border border-hairline bg-surface-low">
                      <button
                        type="button"
                        onClick={() => {
                          setOverride(normalizeDesign(s.design))
                        }}
                        className="min-h-10 px-3 text-xs font-semibold text-ink hover:bg-hairline/20"
                      >
                        {s.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteStyleMutation.mutate(s.id)}
                        aria-label={`Delete style ${s.name}`}
                        className="flex h-10 w-9 items-center justify-center border-l border-hairline text-ink-muted hover:text-danger"
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <label className="flex flex-col gap-1.5 font-body">
            <span className="text-xs font-semibold uppercase tracking-[.05em] text-brand-orange">Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              className="min-h-11 rounded-md border border-hairline bg-surface px-3 py-2.5 text-base text-ink focus:outline-none focus:border-brand"
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-[.05em] text-brand-orange">Content</span>
            <BlockEditor blocks={blocks} onChange={setBlocks} />
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
            {confirming ? (
              <>
                <Button type="button" variant="primary" loading={sendMutation.isPending} onClick={() => sendMutation.mutate({ testOnly: false })}>
                  Yes, send to everyone
                </Button>
                <Button type="button" variant="ghost" onClick={() => setConfirming(false)} disabled={sendMutation.isPending}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button type="button" variant="primary" disabled={!hasContent || busy} onClick={() => setConfirming(true)}>
                Send broadcast
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              disabled={!hasContent || busy}
              loading={sendMutation.isPending && sendMutation.variables?.testOnly}
              onClick={() => sendMutation.mutate({ testOnly: true })}
            >
              Send test to me
            </Button>
            <Button type="button" variant="ghost" disabled={busy} loading={draftMutation.isPending} onClick={() => draftMutation.mutate()}>
              {draftId ? 'Update draft' : 'Save draft'}
            </Button>
          </div>
          {confirming && <p className="-mt-2 text-xs text-ink-muted">This emails every opted-in member and can&rsquo;t be recalled.</p>}
        </div>

        <div className="lg:sticky lg:top-6">
          <EmailPreview html={previewHtml} subject={subject} />
        </div>
      </div>

      {drafts.length > 0 && (
        <>
          <h2 className="mt-10 text-xl font-bold text-ink-900">Drafts</h2>
          <div className="mt-4 flex flex-col gap-2">
            {drafts.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-hairline bg-surface px-4 py-3 shadow-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink-900">{d.subject || 'Untitled draft'}</p>
                  <p className="text-xs text-ink-muted">Saved {new Date(d.updated_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => loadDraft(d)}>
                    {d.id === draftId ? 'Open (current)' : 'Open'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => deleteDraftMutation.mutate(d.id)}
                    aria-label="Delete draft"
                    className="flex h-10 w-10 items-center justify-center rounded-md text-ink-muted hover:text-danger"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="mt-10 text-xl font-bold text-ink-900">History</h2>
      {historyQuery.isLoading ? (
        <div className="mt-4">
          <SkeletonTable columns={4} rows={3} />
        </div>
      ) : history.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon="campaign" title="No broadcasts yet" description="Sent broadcasts will show up here." />
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-hairline bg-surface shadow-md">
          <Table
            columns={['Subject', 'Template', 'Recipients', 'Sent', '']}
            rows={history.map((b) => [
              b.subject,
              BROADCAST_TEMPLATES.find((t) => t.id === b.template_id)?.label || 'Default',
              b.recipient_count,
              new Date(b.created_at).toLocaleString(),
              <button key={b.id} type="button" onClick={() => openFromHistory(b)} className="min-h-10 px-2 text-xs font-semibold text-brand hover:underline">
                Reuse
              </button>,
            ])}
          />
        </div>
      )}

      {studioOpen && (
        <EmailStudioModal
          title="Design this email"
          design={effectiveDesign ?? presetDesign(templateId)}
          onChange={setOverride}
          content={{ subject, blocks }}
          onReset={override ? () => setOverride(null) : undefined}
          resetLabel="Back to template look"
          onClose={() => setStudioOpen(false)}
        />
      )}
    </div>
  )
}
