import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/ToastContext'
import { useFormQuery, isFormOpen, isFocusFill, validateAnswers } from '../data/forms'
import { useMyResponseQuery, formatAnswerForDisplay } from '../data/formResponses'
import QuestionField from '../components/forms/QuestionField'
import FormThemeShell, { FormHeaderCard, questionCardStyle } from '../components/forms/FormThemeShell'
import { cardGap, hasTheme, normalizeTheme } from '../lib/formTheme'
import { useSiteChrome } from '../lib/ChromeContext'
import Button from '../components/ui/Button'
import ErrorState from '../components/ui/ErrorState'
import EmptyState from '../components/ui/EmptyState'
import Reveal from '../components/ui/Reveal'
import { submitPublic } from '../data/publicSubmit'
import TurnstileWidget, { useTurnstile } from '../components/TurnstileWidget'
import { canSubmitWithCaptcha } from '../lib/turnstile'

const CARD_STAGGER = 0.06
const MAX_STAGGER_DELAY = 0.3

function isAnswered(value) {
  return value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0)
}

/** The only way out of a form that has no navbar: the form list. */
function BackToForms() {
  return (
    <Link
      to="/forms"
      className="inline-flex items-center gap-1 text-sm font-semibold text-brand no-underline hover:text-orange-500 hover:underline"
    >
      <span className="material-symbols-outlined text-base">arrow_back</span>
      Back to Forms
    </Link>
  )
}

export default function FormDetail() {
  const { id } = useParams()
  const { user, loading: authLoading } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const formQuery = useFormQuery(id)
  const myResponseQuery = useMyResponseQuery(id, user?.id)

  const [answers, setAnswers] = useState({})
  const [editing, setEditing] = useState(false)
  const [formError, setFormError] = useState('')
  const captcha = useTurnstile()

  const form = formQuery.data
  const existingResponse = myResponseQuery.data

  // Only a focus-mode form's fill-in screen drops the navbar and footer, and the back link goes with
  // it. Every other screen keeps the chrome so a respondent can always get back into the site.
  const focusFill = isFocusFill(form, {
    open: Boolean(form && isFormOpen(form)),
    signedIn: Boolean(user),
    hasResponse: Boolean(existingResponse),
    editing,
  })
  useSiteChrome({ hidden: focusFill })

  const submitMutation = useMutation({
    mutationFn: async () => {
      const validationError = validateAnswers(form.questions, answers)
      if (validationError) throw new Error(validationError)

      if (!user) {
        // Anonymous responses go through the server, which checks the verification token.
        await submitPublic({ type: 'form_response', token: captcha.token, formId: id, answers })
        return
      }

      if (myResponseQuery.data) {
        const { error: updateError } = await supabase
          .from('form_responses')
          .update({ answers, updated_at: new Date().toISOString() })
          .eq('id', myResponseQuery.data.id)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase.from('form_responses').insert({
          form_id: id,
          respondent_id: user?.id ?? null,
          respondent_email: user?.email ?? null,
          answers,
        })
        if (insertError) throw insertError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form_responses', id, 'mine'] })
      toast.success('Response submitted — thank you!')
      setFormError('')
      setEditing(false)
    },
    onSettled: () => captcha.reset(),
    onError: (error) => setFormError(error.message),
  })

  if (formQuery.isError && !formQuery.data) {
    return (
      <div className="mx-auto max-w-[700px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load this form." onRetry={formQuery.refetch} />
      </div>
    )
  }

  if (formQuery.isLoading || authLoading || !form) return null

  if (!isFormOpen(form)) {
    return (
      <FormThemeShell theme={form.theme}>
        <EmptyState icon="event_busy" title="This form is closed" description="It isn't accepting responses anymore." />
      </FormThemeShell>
    )
  }

  if (form.require_signin && !user) {
    return (
      <FormThemeShell theme={form.theme}>
        <h1 className="text-3xl font-bold text-ink-900">{form.title}</h1>
        <p className="mt-4 text-ink-muted">Sign in to respond to this form.</p>
        <Link to="/login" state={{ from: { pathname: `/forms/${id}` } }}>
          <Button variant="primary" className="mt-4">Sign in</Button>
        </Link>
      </FormThemeShell>
    )
  }

  if (form.one_response_per_person && existingResponse && !editing) {
    return (
      <FormThemeShell theme={form.theme}>
        <h1 className="text-3xl font-bold text-ink-900">{form.title}</h1>
        <p className="mt-2 text-ink-muted">
          You&rsquo;ve already responded to this form{form.allow_edit_after_submit ? '.' : ' — thank you!'}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          {form.questions.map((q) => (
            <div
              key={q.id}
              className="flex flex-col gap-0.5 rounded-md bg-surface-low px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
            >
              <span className="text-sm font-semibold text-ink-900">{q.label}</span>
              <span className="text-sm text-ink-muted sm:text-right">{formatAnswerForDisplay(q, existingResponse.answers?.[q.id])}</span>
            </div>
          ))}
        </div>
        {form.allow_edit_after_submit && (
          <Button
            variant="secondary"
            className="mt-6"
            onClick={() => {
              setAnswers(existingResponse.answers || {})
              setEditing(true)
            }}
          >
            Edit response
          </Button>
        )}
      </FormThemeShell>
    )
  }

  const totalCount = form.questions.length
  const answeredCount = form.questions.filter((q) => isAnswered(answers[q.id])).length
  const progressPct = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0

  const themed = hasTheme(form.theme)
  const showProgress = !themed || normalizeTheme(form.theme).showProgress

  return (
    <FormThemeShell theme={form.theme}>
      <FormHeaderCard form={form} theme={form.theme} backLink={focusFill ? <BackToForms /> : null} />

      {totalCount > 0 && showProgress && (
        <div className="mt-6">
          <div className="mb-1.5 flex items-center justify-between text-xs text-ink-muted">
            <span>{answeredCount} of {totalCount} answered</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-low">
            <div className="h-full rounded-full bg-green-900 transition-all duration-150" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-4" style={themed ? { gap: cardGap(form.theme) } : undefined}>
        {form.questions.map((q, i) => (
          <Reveal
            key={q.id}
            delay={Math.min(i * CARD_STAGGER, MAX_STAGGER_DELAY)}
            className={themed ? '' : 'rounded-lg border border-hairline bg-surface p-5 shadow-sm'}
            style={questionCardStyle(form.theme, q.style?.card)}
          >
            <QuestionField
              question={q}
              value={answers[q.id]}
              onChange={(value) => setAnswers((prev) => ({ ...prev, [q.id]: value }))}
              theme={form.theme}
            />
          </Reveal>
        ))}
      </div>

      {formError && <p className="mt-4 text-sm text-danger">{formError}</p>}

      {!user && (
        <div className="mt-6">
          <TurnstileWidget onToken={captcha.setToken} resetKey={captcha.resetKey} />
        </div>
      )}

      <Button
        variant="primary"
        className="mt-6"
        onClick={() => submitMutation.mutate()}
        loading={submitMutation.isPending}
        disabled={!user && !canSubmitWithCaptcha(captcha)}
      >
        Submit
      </Button>
    </FormThemeShell>
  )
}
