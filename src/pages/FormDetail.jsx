import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/ToastContext'
import { useFormQuery, isFormOpen, validateAnswers } from '../data/forms'
import { useMyResponseQuery, formatAnswerForDisplay } from '../data/formResponses'
import QuestionField from '../components/forms/QuestionField'
import Button from '../components/ui/Button'
import ErrorState from '../components/ui/ErrorState'
import EmptyState from '../components/ui/EmptyState'

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

  const form = formQuery.data

  const submitMutation = useMutation({
    mutationFn: async () => {
      const validationError = validateAnswers(form.questions, answers)
      if (validationError) throw new Error(validationError)

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
      <div className="mx-auto max-w-[700px] px-5 py-12 sm:px-6">
        <EmptyState icon="event_busy" title="This form is closed" description="It isn't accepting responses anymore." />
      </div>
    )
  }

  if (form.require_signin && !user) {
    return (
      <div className="mx-auto max-w-[700px] px-5 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-ink-900">{form.title}</h1>
        <p className="mt-4 text-ink-muted">Sign in to respond to this form.</p>
        <Link to="/login" state={{ from: { pathname: `/forms/${id}` } }}>
          <Button variant="primary" className="mt-4">Sign in</Button>
        </Link>
      </div>
    )
  }

  const existingResponse = myResponseQuery.data
  if (form.one_response_per_person && existingResponse && !editing) {
    return (
      <div className="mx-auto max-w-[700px] px-5 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-ink-900">{form.title}</h1>
        <p className="mt-2 text-ink-muted">
          You&rsquo;ve already responded to this form{form.allow_edit_after_submit ? '.' : ' — thank you!'}
        </p>
        <div className="mt-6 flex flex-col gap-4">
          {form.questions.map((q) => (
            <div key={q.id}>
              <div className="text-sm font-semibold text-ink-900">{q.label}</div>
              <div className="text-sm text-ink-muted">{formatAnswerForDisplay(q, existingResponse.answers?.[q.id])}</div>
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
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[700px] px-5 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-ink-900">{form.title}</h1>
      {form.description && <p className="mt-2 text-ink-muted">{form.description}</p>}

      <div className="mt-6 flex flex-col gap-6">
        {form.questions.map((q) => (
          <QuestionField
            key={q.id}
            question={q}
            value={answers[q.id]}
            onChange={(value) => setAnswers((prev) => ({ ...prev, [q.id]: value }))}
          />
        ))}
      </div>

      {formError && <p className="mt-4 text-sm text-danger">{formError}</p>}

      <Button variant="primary" className="mt-6" onClick={() => submitMutation.mutate()} loading={submitMutation.isPending}>
        Submit
      </Button>
    </div>
  )
}
