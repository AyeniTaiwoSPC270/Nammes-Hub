import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import TurnstileWidget, { useTurnstile } from './TurnstileWidget'
import Button from './ui/Button'
import { useBodyScrollLock } from '../lib/useBodyScrollLock'
import { useToast } from '../lib/ToastContext'
import { canSubmitWithCaptcha } from '../lib/turnstile'
import { submitFeedback } from '../data/feedback'
import { FEEDBACK_CATEGORIES } from '../../api/_lib/publicSubmission.js'

const controlClass =
  'min-h-11 rounded-md border border-hairline px-3 py-2.5 text-base bg-surface text-ink transition-colors duration-150 focus:outline-none focus:border-brand'

const chipClass = (active) =>
  [
    'rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors',
    active ? 'border-brand bg-brand text-white' : 'border-hairline bg-surface text-ink-muted hover:text-ink-900',
  ].join(' ')

// Every reason is a single lowercase word, so capitalising it is the whole label -- no second list
// to keep in step with FEEDBACK_CATEGORIES, which the server validates against anyway.
const reasonLabel = (code) => `${code.charAt(0).toUpperCase()}${code.slice(1)}`

/**
 * Five stars, an optional reason, an optional comment. A star alone is a complete answer: the
 * comment box only appears once someone has rated, because asking for prose before a verdict is
 * how you get neither.
 */
export default function FeedbackModal({ onClose, onRated }) {
  const toast = useToast()
  const captcha = useTurnstile()
  const dialogRef = useRef(null)
  useBodyScrollLock()

  const [rating, setRating] = useState(0)
  const [category, setCategory] = useState(null)
  const [message, setMessage] = useState('')
  const [formError, setFormError] = useState('')

  const pagePath = `${window.location.pathname}`.slice(0, 300)

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
    mutationFn: () => submitFeedback({ rating, category, message, pagePath }),
    onSettled: () => captcha.reset(),
    onSuccess: () => {
      onRated?.()
      toast.success('Thanks for rating the Hub.')
      onClose()
    },
    onError: (error) => setFormError(error.message),
  })

  function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    if (rating < 1) {
      setFormError('Tap a star to rate the Hub.')
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
        aria-labelledby="feedback-title"
        tabIndex={-1}
        className="relative w-full max-w-md rounded-lg bg-surface p-6 shadow-md outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="feedback-title" className="text-lg font-bold text-ink-900">
          Rate the Hub
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          How has it been for you so far? One tap is enough — the rest is optional.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                aria-label={`Rate ${star} out of 5`}
                aria-pressed={rating >= star}
                className="rounded-md p-1 transition-transform hover:scale-110"
              >
                <span
                  className={`material-symbols-outlined text-4xl ${rating >= star ? 'text-brand-orange' : 'text-ink-muted'}`}
                  style={rating >= star ? { fontVariationSettings: "'FILL' 1" } : undefined}
                  aria-hidden="true"
                >
                  star
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {FEEDBACK_CATEGORIES.map((code) => (
              <button key={code} type="button" onClick={() => setCategory(category === code ? null : code)} className={chipClass(category === code)}>
                {reasonLabel(code)}
              </button>
            ))}
          </div>

          {rating > 0 && (
            <label className="flex flex-col gap-1.5 font-body">
              <span className="text-xs font-semibold uppercase tracking-[.05em] text-brand-orange">
                Anything you want to add? (optional)
              </span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="What should we improve?"
                className={controlClass}
              />
            </label>
          )}

          {formError && <span className="text-xs text-danger">{formError}</span>}

          <TurnstileWidget onToken={captcha.setToken} resetKey={captcha.resetKey} />

          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" type="button" onClick={onClose}>
              Not now
            </Button>
            <Button variant="primary" type="submit" loading={submitMutation.isPending} disabled={!canSubmitWithCaptcha(captcha)}>
              Send rating
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
