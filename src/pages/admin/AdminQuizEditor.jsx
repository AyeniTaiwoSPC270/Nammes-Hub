import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../lib/ToastContext'
import {
  useQuizQuery,
  saveQuiz,
  validateQuizDraft,
  blankQuestion,
  OPTION_STYLES,
  TIME_LIMIT_CHOICES,
  POINT_CHOICES,
} from '../../data/quiz'
import Breadcrumbs from '../../components/Breadcrumbs'
import Button from '../../components/ui/Button'
import FormField from '../../components/ui/FormField'
import ErrorState from '../../components/ui/ErrorState'

const selectClass = 'min-h-11 rounded-md border border-hairline bg-surface px-3 py-2 text-base text-ink'

function QuestionCard({ question, number, total, onChange, onMove, onRemove }) {
  function setOption(index, value) {
    const options = [...question.options]
    options[index] = value
    onChange({ ...question, options })
  }

  return (
    <div className="rounded-lg border border-hairline bg-surface p-4 shadow-md">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="font-semibold text-ink-900">Question {number}</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => onMove(-1)} disabled={number === 1} aria-label="Move question up">↑</Button>
          <Button variant="ghost" size="sm" onClick={() => onMove(1)} disabled={number === total} aria-label="Move question down">↓</Button>
          <Button variant="destructive" size="sm" onClick={onRemove}>Remove</Button>
        </div>
      </div>

      <FormField
        label="Question"
        type="textarea"
        rows={2}
        maxLength={300}
        value={question.text}
        onChange={(e) => onChange({ ...question, text: e.target.value })}
        placeholder="Which course covers eigenvalues?"
      />

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {OPTION_STYLES.map((style, i) => (
          <div key={i} className="flex items-center gap-2">
            <label className="flex shrink-0 cursor-pointer items-center gap-1" title="Mark as the correct answer">
              <input
                type="radio"
                name={`correct-${question.id}`}
                checked={question.correct_index === i}
                onChange={() => onChange({ ...question, correct_index: i })}
              />
              <span className={`flex h-9 w-9 items-center justify-center rounded-md text-white ${style.bg}`} aria-hidden="true">
                {style.shape}
              </span>
            </label>
            <input
              type="text"
              value={question.options[i]}
              maxLength={100}
              onChange={(e) => setOption(i, e.target.value)}
              placeholder={i < 2 ? `Answer ${i + 1}` : `Answer ${i + 1} (optional)`}
              aria-label={`Answer ${i + 1}`}
              className="min-h-11 min-w-0 flex-1 rounded-md border border-hairline bg-surface px-3 py-2 text-base text-ink"
            />
          </div>
        ))}
      </div>
      <p className="mt-1 text-xs text-ink-muted">Tick the circle next to the correct answer. Leave a box empty for fewer than four answers.</p>

      <div className="mt-4 flex flex-wrap gap-4">
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[.05em] text-brand-orange">
          Time limit
          <select
            className={selectClass}
            value={question.time_limit_seconds}
            onChange={(e) => onChange({ ...question, time_limit_seconds: Number(e.target.value) })}
          >
            {TIME_LIMIT_CHOICES.map((s) => <option key={s} value={s}>{s} seconds</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[.05em] text-brand-orange">
          Points
          <select
            className={selectClass}
            value={question.points}
            onChange={(e) => onChange({ ...question, points: Number(e.target.value) })}
          >
            {POINT_CHOICES.map((p) => <option key={p} value={p}>{p}{p === 1000 ? ' (standard)' : p === 2000 ? ' (double)' : ''}</option>)}
          </select>
        </label>
      </div>
    </div>
  )
}

export default function AdminQuizEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const quizQuery = useQuizQuery(id)
  const [title, setTitle] = useState('')
  const [questions, setQuestions] = useState(() => (id ? [] : [blankQuestion()]))
  const [loaded, setLoaded] = useState(!id)

  useEffect(() => {
    if (!id || !quizQuery.data || loaded) return
    setTitle(quizQuery.data.title)
    setQuestions(
      quizQuery.data.questions.map((q) => ({
        id: q.id,
        text: q.text,
        options: [...q.options, '', '', '', ''].slice(0, 4),
        correct_index: q.correct_index,
        time_limit_seconds: q.time_limit_seconds,
        points: q.points,
      })),
    )
    setLoaded(true)
  }, [id, quizQuery.data, loaded])

  const saveMutation = useMutation({
    mutationFn: () => saveQuiz({ id, title, questions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] })
      toast.success('Quiz saved.')
      navigate('/admin/quizzes')
    },
    onError: (error) => toast.error(error.message),
  })

  function handleSave() {
    const problem = validateQuizDraft({ title, questions })
    if (problem) {
      toast.error(problem)
      return
    }
    saveMutation.mutate()
  }

  function updateQuestion(index, next) {
    setQuestions((qs) => qs.map((q, i) => (i === index ? next : q)))
  }

  function moveQuestion(index, delta) {
    setQuestions((qs) => {
      const target = index + delta
      if (target < 0 || target >= qs.length) return qs
      const copy = [...qs]
      ;[copy[index], copy[target]] = [copy[target], copy[index]]
      return copy
    })
  }

  if (id && quizQuery.isError) {
    return (
      <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load this quiz." onRetry={quizQuery.refetch} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
      <Breadcrumbs
        items={[{ label: 'Admin', to: '/admin' }, { label: 'Live Quiz', to: '/admin/quizzes' }, { label: id ? 'Edit quiz' : 'New quiz' }]}
      />
      <h1 className="text-3xl font-bold text-ink-900">{id ? 'Edit quiz' : 'New quiz'}</h1>

      {!loaded ? (
        <p className="mt-6 text-ink-muted">Loading…</p>
      ) : (
        <div className="mt-6 flex flex-col gap-5">
          <FormField
            label="Quiz title"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Freshers' week quiz"
          />

          {questions.map((q, i) => (
            <QuestionCard
              key={q.id}
              question={q}
              number={i + 1}
              total={questions.length}
              onChange={(next) => updateQuestion(i, next)}
              onMove={(delta) => moveQuestion(i, delta)}
              onRemove={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}
            />
          ))}

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setQuestions((qs) => [...qs, blankQuestion()])}>
              Add question
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saveMutation.isPending}>
              Save quiz
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
