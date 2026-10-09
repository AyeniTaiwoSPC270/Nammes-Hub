import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEmailTemplatesQuery, updateEmailTemplate } from '../../data/emailTemplates'
import { updateEmailTemplateDesign } from '../../data/emailStudio'
import {
  BROADCAST_TEMPLATES,
  BROADCAST_TEMPLATE_TOKENS,
  DEFAULT_BROADCAST_TEMPLATE_HTML,
  buildBroadcastEmailHtml,
} from '../../../api/_lib/emailTemplateHtml.js'
import {
  SYSTEM_EMAILS,
  academicReminderContent,
  legacyToBlocks,
  newContentEmailContent,
  normalizeDesign,
  presetDesign,
  renderEmail,
  systemDesign,
  welcomeContent,
} from '../../../api/_lib/emailDesign.js'
import { useEmailPreviewImages } from '../../lib/useEmailPreviewImages'
import { finalizeEmailImages } from '../../lib/emailImage'
import Button from '../../components/ui/Button'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonCard } from '../../components/ui/Skeleton'
import { useToast } from '../../lib/ToastContext'
import EmailPreview from '../../components/admin/email/EmailPreview'
import EmailStudioModal from '../../components/admin/email/EmailStudioModal'

const SAMPLE = {
  subject: 'Sample broadcast subject',
  body: 'This is sample body text so you can preview the template while you edit it.\n\nA second paragraph, with a link: https://www.nammeshub.com.ng',
  imageUrl: 'https://placehold.co/520x260/0b2417/ffffff?text=Sample+Image',
}

const ALL_TEMPLATES = [
  ...BROADCAST_TEMPLATES.map((t) => ({ ...t, system: false })),
  ...SYSTEM_EMAILS.map((s) => ({ id: s.id, label: s.label, description: s.description, system: true })),
]

function sampleContent(id, system) {
  if (!system) return { subject: SAMPLE.subject, blocks: legacyToBlocks(SAMPLE) }
  if (id === 'welcome') return welcomeContent({ fullName: 'Ada' })
  // Every system email needs its own sample. Falling through to the new-content shape here would show whoever is
  // restyling the reminder a news alert and call it a preview.
  if (id === 'academic_reminder') {
    return academicReminderContent({
      title: 'Undergraduate Examinations in All Faculties',
      kind: 'exams',
      startsAt: '2027-01-25',
      endsAt: '2027-02-12',
      note: 'Three weeks across every faculty.',
      daysAway: 7,
    })
  }
  return newContentEmailContent({ eyebrow: 'News Update', title: 'A sample headline for a new post', url: 'https://www.nammeshub.com.ng/news/sample', imageUrl: SAMPLE.imageUrl })
}

export default function AdminEmailTemplates() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const templatesQuery = useEmailTemplatesQuery()
  const [activeId, setActiveId] = useState('default')
  const [draft, setDraft] = useState('')
  const [dirty, setDirty] = useState(false)
  const [designDraft, setDesignDraft] = useState(null)
  const [designDirty, setDesignDirty] = useState(false)
  const [studioOpen, setStudioOpen] = useState(false)

  const active = ALL_TEMPLATES.find((t) => t.id === activeId)
  const isSystem = Boolean(active?.system)
  const activeRow = templatesQuery.data?.find((t) => t.template_id === activeId)
  const inDesignMode = isSystem || Boolean(designDraft)
  const factoryDesign = () => (isSystem ? systemDesign(activeId) : presetDesign(activeId))

  useEffect(() => {
    if (templatesQuery.data) {
      setDraft(activeRow?.html ?? '')
      setDirty(false)
      setDesignDraft(activeRow?.design ? normalizeDesign(activeRow.design) : isSystem ? systemDesign(activeId) : null)
      setDesignDirty(false)
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

  const content = useMemo(() => sampleContent(activeId, isSystem), [activeId, isSystem])
  const applyPreviews = useEmailPreviewImages(content.blocks, designDraft)

  const designMutation = useMutation({
    mutationFn: async (design) => {
      // Bake a cropped header banner into a real image file before saving.
      const done = design ? await finalizeEmailImages({ blocks: [], design }) : { design: null }
      await updateEmailTemplateDesign(activeId, done.design)
      return done.design
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['email_templates'] })
      setDesignDraft(saved ? normalizeDesign(saved) : isSystem ? systemDesign(activeId) : null)
      setDesignDirty(false)
      toast.success(saved ? 'Design saved.' : 'Switched back to the HTML template.')
    },
    onError: (error) => toast.error(error.message),
  })

  function handleSelect(id) {
    if (id === activeId) return
    if ((dirty || designDirty) && !window.confirm('Discard unsaved changes to this template?')) return
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

  function changeDesign(next) {
    setDesignDraft(next)
    setDesignDirty(true)
  }

  function handleUseHtml() {
    if (!window.confirm('Go back to this template’s HTML? Your saved design is removed.')) return
    designMutation.mutate(null)
  }

  const htmlPreview = useMemo(
    () => buildBroadcastEmailHtml({ ...SAMPLE, templateId: activeId, customHtml: draft || undefined }),
    [draft, activeId],
  )
  const designPreview = useMemo(
    () => (designDraft ? applyPreviews(renderEmail({ design: designDraft, content })) : ''),
    [designDraft, content, applyPreviews],
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
        Design how each email looks — colors, fonts, header, button, footer — or, for broadcast templates, edit the raw HTML
        behind it. Automatic emails (welcome, new content alerts, academic reminders) can be designed too.
      </p>

      {templatesQuery.isLoading ? (
        <div className="mt-6">
          <SkeletonCard />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[170px_1fr_1fr]">
          <div className="flex flex-row gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {ALL_TEMPLATES.map((t, i) => (
              <div key={t.id} className="contents">
                {t.system && ALL_TEMPLATES[i - 1] && !ALL_TEMPLATES[i - 1].system && (
                  <span className="hidden px-1 pt-2 text-xs font-semibold uppercase tracking-[.05em] text-ink-muted lg:block">Automatic emails</span>
                )}
                <button
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
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <div className="rounded-md border border-hairline bg-surface-low p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-ink-900">{active?.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs uppercase ${inDesignMode ? 'bg-orange-100 text-orange-600' : 'bg-hairline/40 text-ink-muted'}`}>
                    {inDesignMode ? 'Designed' : 'HTML template'}
                  </span>
                </div>
                {activeRow?.updated_at && <span className="text-xs text-ink-muted">Updated {new Date(activeRow.updated_at).toLocaleString()}</span>}
              </div>
              <p className="mt-1 text-xs text-ink-muted">{active?.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => { if (!designDraft) changeDesign(factoryDesign()); setStudioOpen(true) }}>
                  <span className="material-symbols-outlined text-base">palette</span>
                  {inDesignMode ? 'Edit design' : 'Design this template'}
                </Button>
                {inDesignMode && (
                  <Button type="button" variant="primary" size="sm" loading={designMutation.isPending} disabled={!designDirty} onClick={() => designMutation.mutate(designDraft)}>
                    Save design
                  </Button>
                )}
                {inDesignMode && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => changeDesign(factoryDesign())}>
                    Reset design
                  </Button>
                )}
                {inDesignMode && !isSystem && (
                  <Button type="button" variant="ghost" size="sm" onClick={handleUseHtml} disabled={designMutation.isPending}>
                    Use HTML instead
                  </Button>
                )}
              </div>
              {!inDesignMode && (
                <p className="mt-2 text-xs text-ink-muted">Designing replaces this template’s HTML for new broadcasts. You can switch back any time.</p>
              )}
            </div>

            {!inDesignMode && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="primary" size="sm" loading={saveMutation.isPending} disabled={!dirty} onClick={() => saveMutation.mutate()}>
                    Save HTML
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={handleResetToDefault}>
                    Reset to default
                  </Button>
                </div>
                <textarea
                  value={draft}
                  onChange={handleChange}
                  spellCheck={false}
                  className="h-[520px] w-full resize-y rounded-md border border-hairline bg-surface p-3 font-mono text-xs leading-relaxed text-ink focus:border-brand focus:outline-none"
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
              </>
            )}
          </div>

          <div className="lg:sticky lg:top-6">
            {inDesignMode ? (
              <EmailPreview html={designPreview} height={620} />
            ) : (
              <div className="overflow-hidden rounded-lg border border-hairline bg-surface-low shadow-sm">
                <div className="border-b border-hairline bg-surface px-4 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-[.05em] text-ink-muted">Preview (sample content)</p>
                </div>
                <iframe title="Email template preview" srcDoc={htmlPreview} className="h-[620px] w-full bg-white" />
              </div>
            )}
          </div>
        </div>
      )}

      {studioOpen && designDraft && (
        <EmailStudioModal
          title={`Design: ${active?.label}`}
          design={designDraft}
          onChange={changeDesign}
          content={content}
          onReset={() => changeDesign(factoryDesign())}
          resetLabel="Reset design"
          onClose={() => setStudioOpen(false)}
          hidePresets={isSystem}
        />
      )}
    </div>
  )
}
