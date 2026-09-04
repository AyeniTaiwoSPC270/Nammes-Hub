import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/ToastContext'
import { useFormQuery, validateFormDraft, validateQuestions } from '../../data/forms'
import Breadcrumbs from '../../components/Breadcrumbs'
import Button from '../../components/ui/Button'
import FormField from '../../components/ui/FormField'
import ErrorState from '../../components/ui/ErrorState'
import QuestionEditorCard from '../../components/admin/forms/QuestionEditorCard'

function assertRowsChanged(rows) {
  if (!rows || rows.length === 0) {
    throw new Error('No changes were saved — your account may not have admin access to make this change.')
  }
}

function newQuestion() {
  return {
    id: crypto.randomUUID(),
    type: 'short_text',
    label: '',
    helper_text: '',
    required: false,
    options: null,
    scale_min: 1,
    scale_max: 5,
    scale_min_label: '',
    scale_max_label: '',
  }
}

function questionToRow(q, formId, position) {
  return {
    form_id: formId,
    position,
    type: q.type,
    label: q.label.trim(),
    helper_text: q.helper_text?.trim() || null,
    required: Boolean(q.required),
    options: q.options ? q.options.map((o) => o.trim()).filter(Boolean) : null,
    scale_min: q.type === 'linear_scale' ? Number(q.scale_min) : null,
    scale_max: q.type === 'linear_scale' ? Number(q.scale_max) : null,
    scale_min_label: q.scale_min_label?.trim() || null,
    scale_max_label: q.scale_max_label?.trim() || null,
  }
}

async function saveQuestions(formId, questions) {
  const { data: existing, error: fetchError } = await supabase.from('form_questions').select('id').eq('form_id', formId)
  if (fetchError) throw fetchError
  const existingIds = new Set((existing ?? []).map((q) => q.id))

  const keepIds = new Set(questions.filter((q) => existingIds.has(q.id)).map((q) => q.id))
  const toDelete = [...existingIds].filter((qid) => !keepIds.has(qid))
  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase.from('form_questions').delete().in('id', toDelete)
    if (deleteError) throw deleteError
  }

  const indexed = questions.map((q, i) => ({ q, i }))
  const toUpdate = indexed.filter(({ q }) => existingIds.has(q.id)).map(({ q, i }) => ({ id: q.id, ...questionToRow(q, formId, i) }))
  const toInsert = indexed.filter(({ q }) => !existingIds.has(q.id)).map(({ q, i }) => questionToRow(q, formId, i))

  if (toUpdate.length > 0) {
    const { error: updateError } = await supabase.from('form_questions').upsert(toUpdate)
    if (updateError) throw updateError
  }
  if (toInsert.length > 0) {
    const { error: insertError } = await supabase.from('form_questions').insert(toInsert)
    if (insertError) throw insertError
  }
}

export default function AdminFormEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { user } = useAuth()
  const formQuery = useFormQuery(id)

  const [hydrated, setHydrated] = useState(!id)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isAcceptingResponses, setIsAcceptingResponses] = useState(true)
  const [closesAt, setClosesAt] = useState('')
  const [requireSignin, setRequireSignin] = useState(false)
  const [oneResponsePerPerson, setOneResponsePerPerson] = useState(false)
  const [allowEditAfterSubmit, setAllowEditAfterSubmit] = useState(false)
  const [questions, setQuestions] = useState([newQuestion()])
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (hydrated || !formQuery.data) return
    const form = formQuery.data
    setTitle(form.title)
    setDescription(form.description || '')
    setIsAcceptingResponses(form.is_accepting_responses)
    setClosesAt(form.closes_at ? form.closes_at.slice(0, 16) : '')
    setRequireSignin(form.require_signin)
    setOneResponsePerPerson(form.one_response_per_person)
    setAllowEditAfterSubmit(form.allow_edit_after_submit)
    setQuestions(form.questions.length > 0 ? form.questions : [newQuestion()])
    setHydrated(true)
  }, [formQuery.data, hydrated])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const titleError = validateFormDraft({ title })
      if (titleError) throw new Error(titleError)
      const questionsError = validateQuestions(questions)
      if (questionsError) throw new Error(questionsError)

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        is_accepting_responses: isAcceptingResponses,
        closes_at: closesAt || null,
        require_signin: requireSignin,
        one_response_per_person: requireSignin ? oneResponsePerPerson : false,
        allow_edit_after_submit: allowEditAfterSubmit,
      }

      let formId = id
      if (formId) {
        const { data, error } = await supabase.from('forms').update(payload).eq('id', formId).select()
        if (error) throw error
        assertRowsChanged(data)
      } else {
        const { data, error } = await supabase.from('forms').insert({ ...payload, created_by: user.id }).select().single()
        if (error) throw error
        formId = data.id
      }

      await saveQuestions(formId, questions)
      return formId
    },
    onSuccess: (formId) => {
      queryClient.invalidateQueries({ queryKey: ['forms'] })
      toast.success('Form saved.')
      setFormError('')
      navigate(`/admin/forms/${formId}/edit`, { replace: true })
    },
    onError: (error) => setFormError(error.message),
  })

  function updateQuestion(index, next) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? next : q)))
  }

  function removeQuestion(index) {
    setQuestions((prev) => prev.filter((_, i) => i !== index))
  }

  function moveQuestion(index, direction) {
    setQuestions((prev) => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  if (id && formQuery.isError && !formQuery.data) {
    return (
      <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load this form." onRetry={formQuery.refetch} />
      </div>
    )
  }

  if (id && !hydrated) return null

  return (
    <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Forms', to: '/admin/forms' }, { label: id ? 'Edit' : 'New' }]} />

      <h1 className="text-3xl font-bold text-ink-900">{id ? 'Edit form' : 'New form'}</h1>

      <div className="mt-6 flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-5 shadow-sm">
        <FormField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Form title" required />
        <FormField
          label="Description (optional)"
          type="textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this form for?"
        />

        <div className="grid grid-cols-1 gap-3 border-t border-hairline pt-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={isAcceptingResponses} onChange={(e) => setIsAcceptingResponses(e.target.checked)} />
            Accepting responses
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={requireSignin} onChange={(e) => setRequireSignin(e.target.checked)} />
            Require sign-in to respond
          </label>
          <label className={['flex items-center gap-2 text-sm', requireSignin ? 'text-ink' : 'text-ink-muted opacity-50'].join(' ')}>
            <input
              type="checkbox"
              checked={oneResponsePerPerson}
              disabled={!requireSignin}
              onChange={(e) => setOneResponsePerPerson(e.target.checked)}
            />
            Limit to one response per person
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={allowEditAfterSubmit} onChange={(e) => setAllowEditAfterSubmit(e.target.checked)} />
            Allow editing a response after submit
          </label>
        </div>

        <FormField
          label="Closes at (optional)"
          type="datetime-local"
          value={closesAt}
          onChange={(e) => setClosesAt(e.target.value)}
          helper="Leave blank to keep the form open until you close it manually."
        />
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {questions.map((q, i) => (
          <QuestionEditorCard
            key={q.id}
            question={q}
            index={i}
            total={questions.length}
            onChange={(next) => updateQuestion(i, next)}
            onRemove={() => removeQuestion(i)}
            onMoveUp={() => moveQuestion(i, -1)}
            onMoveDown={() => moveQuestion(i, 1)}
          />
        ))}
        <Button variant="ghost" type="button" onClick={() => setQuestions((prev) => [...prev, newQuestion()])}>
          + Add question
        </Button>
      </div>

      {formError && <p className="mt-4 text-sm text-danger">{formError}</p>}

      <div className="mt-6 flex gap-3">
        <Button variant="primary" onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
          Save form
        </Button>
        <Link to="/admin/forms">
          <Button variant="secondary" type="button">Cancel</Button>
        </Link>
      </div>
    </div>
  )
}
