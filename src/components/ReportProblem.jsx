import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import TurnstileWidget, { useTurnstile } from './TurnstileWidget'
import Button from './ui/Button'
import { canSubmitWithCaptcha } from '../lib/turnstile'
import { useBodyScrollLock } from '../lib/useBodyScrollLock'
import { useToast } from '../lib/ToastContext'
import { submitPublic } from '../data/publicSubmit'
import { useReportsFlag, REPORT_CATEGORIES, reportCategoryLabel } from '../data/reports'

const controlClass =
  'min-h-11 rounded-md border border-hairline px-3 py-2.5 text-base bg-surface text-ink transition-colors duration-150 focus:outline-none focus:border-brand'

/**
 * The dialog half, kept as its own component so the link above it can return early when the flag is
 * off without the two sharing a hook order.
 *
 * The page title and path are filled from the current page and are not editable: a report about the
 * wrong page is worse than no report at all.
 */
function ReportDialog({ title, onClose }) {
  const toast = useToast()
  const captcha = useTurnstile()
  const dialogRef = useRef(null)
  useBodyScrollLock()

  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState('')

  // Bounded here rather than trusted: validateReport rejects anything over the limit anyway, and
  // slicing means the common case never fails on a title that runs long.
  const pageUrl = window.location.pathname.slice(0, 300)
  const pageTitle = String(title ?? '').slice(0, 200)

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const submitMutation = useMutation({
    mutationFn: () =>
      submitPublic({
        type: 'report',
        token: captcha.token,
        category,
        page_url: pageUrl,
        page_title: pageTitle,
        message: note.trim(),
      }),
    onSettled: () => captcha.reset(),
    onSuccess: () => {
      toast.success('Thanks — your report has been sent.')
      onClose()
    },
    onError: (error) => setFormError(error.message),
  })

  function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    if (!category) {
      setFormError('Choose what kind of problem this is.')
      return
    }
    submitMutation.mutate()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-problem-title"
        tabIndex={-1}
        className="relative w-full max-w-md rounded-lg bg-surface p-6 shadow-md outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="report-problem-title" className="text-lg font-bold text-ink-900">
          Report a problem
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Tell us what is wrong on this page. We read every report — there is nothing to sign up for.
        </p>

        <div className="mt-4 rounded-md border border-hairline bg-surface-low px-3 py-2">
          <p className="truncate text-sm font-semibold text-ink-900">{pageTitle || 'This page'}</p>
          <p className="truncate text-xs text-ink-muted">{pageUrl}</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 font-body">
            <span className="text-xs font-semibold uppercase tracking-[.05em] text-brand-orange">What is wrong?</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              className={controlClass}
            >
              <option value="" disabled>
                Choose a category
              </option>
              {REPORT_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {reportCategoryLabel(value)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 font-body">
            <span className="text-xs font-semibold uppercase tracking-[.05em] text-brand-orange">
              Anything else? (optional)
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="What did you expect to see?"
              className={controlClass}
            />
          </label>

          {formError && <span className="text-xs text-danger">{formError}</span>}

          <TurnstileWidget onToken={captcha.setToken} resetKey={captcha.resetKey} />

          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              loading={submitMutation.isPending}
              disabled={!canSubmitWithCaptcha(captcha)}
            >
              Send report
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

/**
 * A small "Report a problem" link for outline, resource, news and event pages, opening a short form
 * with this page's title and path already filled in.
 *
 * Renders nothing at all while `feature_flags.reports` is off: the link, the dialog and the server
 * branch behind it are one switch, so there is no half-visible state to explain.
 */
export default function ReportProblem({ title }) {
  const enabled = useReportsFlag()
  const [open, setOpen] = useState(false)

  if (!enabled) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted transition-colors hover:text-brand-orange"
      >
        <span className="material-symbols-outlined text-base" aria-hidden="true">
          flag
        </span>
        Report a problem
      </button>
      {open && <ReportDialog title={title} onClose={() => setOpen(false)} />}
    </>
  )
}
