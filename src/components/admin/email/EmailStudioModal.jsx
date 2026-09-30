import { useEffect, useMemo, useState } from 'react'
import { useBodyScrollLock } from '../../../lib/useBodyScrollLock'
import { renderEmail } from '../../../../api/_lib/emailDesign.js'
import { useEmailPreviewImages } from '../../../lib/useEmailPreviewImages'
import Segmented from './MobilePaneToggle'
import EmailDesignControls from './EmailDesignControls'
import EmailPreview from './EmailPreview'

/**
 * Full-screen design studio for one email: controls on the left, live preview on the right.
 * `content` is what the preview shows: { subject, blocks, preheader?, eyebrow? }.
 */
export default function EmailStudioModal({ title = 'Design email', design, onChange, content, onClose, onReset, resetLabel = 'Reset', hidePresets = false, footer }) {
  useBodyScrollLock()
  const [pane, setPane] = useState('controls')
  const applyPreviews = useEmailPreviewImages(content.blocks, design)

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const html = useMemo(
    () => applyPreviews(renderEmail({ design, content: { ...content, subject: content.subject || 'Your subject line' } })),
    [design, content, applyPreviews],
  )

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex flex-col bg-paper">
      <div className="flex items-center justify-between gap-3 border-b border-hairline bg-surface px-4 py-3">
        <h2 className="truncate text-lg font-bold text-ink-900">{title}</h2>
        <div className="flex items-center gap-2">
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 text-sm font-semibold text-ink hover:bg-surface-low"
            >
              <span className="material-symbols-outlined text-base">restart_alt</span>
              <span className="hidden sm:inline">{resetLabel}</span>
            </button>
          )}
          {footer}
          <button type="button" onClick={onClose} className="min-h-10 rounded-md bg-green-900 px-5 text-sm font-bold text-white hover:opacity-90">
            Done
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-hairline bg-surface px-3 py-2 lg:hidden">
        <Segmented value={pane} onChange={setPane} />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[400px_1fr]">
        <div className={['min-h-0 flex-col border-hairline bg-surface lg:flex lg:border-r', pane === 'controls' ? 'flex' : 'hidden'].join(' ')}>
          <EmailDesignControls design={design} onChange={onChange} hidePresets={hidePresets} />
        </div>
        <div className={['min-h-0 overflow-y-auto p-3 lg:block', pane === 'preview' ? 'block' : 'hidden'].join(' ')}>
          <EmailPreview html={html} subject={content.subject ?? ''} height={720} />
        </div>
      </div>
    </div>
  )
}
