import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../lib/ToastContext'
import {
  useQuizQuery,
  saveQuiz,
  validateQuizDraft,
  blankQuestion,
  questionFromRow,
  cleanTags,
  MAX_TAGS,
  MAX_QUESTIONS,
  QUESTION_TYPE_INFO,
  DEFAULT_MAX_PLAYERS,
  MIN_PLAYERS_LIMIT,
  MAX_PLAYERS_LIMIT,
} from '../../data/quiz'
import { sanitizeGameOptions } from '../../../api/_lib/quizGrading.js'
import Breadcrumbs from '../../components/Breadcrumbs'
import Button from '../../components/ui/Button'
import FormField from '../../components/ui/FormField'
import ErrorState from '../../components/ui/ErrorState'
import QuestionCard from '../../components/admin/quizEditor/QuestionCard'
import QuizImportModal from '../../components/admin/quizLibrary/QuizImportModal'
import QuestionBankModal from '../../components/admin/quizLibrary/QuestionBankModal'

// New quizzes start with the fun extras on; an existing quiz keeps whatever it had (older quizzes have them off).
const NEW_QUIZ_OPTIONS = { streaks: true, powerups: true, comeback: true }

const OPTION_ROWS = [
  { key: 'streaks', label: 'Streak bonus', hint: 'Answer right several times in a row for up to +200 extra points each time.' },
  { key: 'powerups', label: 'Power-ups', hint: 'Each player gets one "Double down" and one "50/50" to use during the game.' },
  { key: 'comeback', label: 'Comeback boost', hint: 'Players in the bottom quarter earn 15% extra on right answers, so nobody gives up.' },
]

export default function AdminQuizEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const quizQuery = useQuizQuery(id)
  const [title, setTitle] = useState('')
  const [maxPlayers, setMaxPlayers] = useState(String(DEFAULT_MAX_PLAYERS))
  const [gameOptions, setGameOptions] = useState(id ? sanitizeGameOptions({}) : NEW_QUIZ_OPTIONS)
  const [questions, setQuestions] = useState(() => (id ? [] : [blankQuestion()]))
  const [loaded, setLoaded] = useState(!id)
  const [addType, setAddType] = useState('multiple')
  const [tags, setTags] = useState('')
  const [dialog, setDialog] = useState(null) // 'import' or 'bank'

  useEffect(() => {
    if (!id || !quizQuery.data || loaded) return
    setTitle(quizQuery.data.title)
    setMaxPlayers(String(quizQuery.data.max_players ?? DEFAULT_MAX_PLAYERS))
    setGameOptions(sanitizeGameOptions(quizQuery.data.game_options))
    setTags((quizQuery.data.tags ?? []).join(', '))
    setQuestions(quizQuery.data.questions.map(questionFromRow))
    setLoaded(true)
  }, [id, quizQuery.data, loaded])

  const saveMutation = useMutation({
    mutationFn: () => saveQuiz({ id, title, questions, maxPlayers: Number(maxPlayers), gameOptions, tags: cleanTags(tags) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] })
      toast.success('Quiz saved.')
      navigate('/admin/quizzes')
    },
    onError: (error) => toast.error(error.message),
  })

  function handleSave() {
    const problem = validateQuizDraft({ title, questions, maxPlayers })
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
          <FormField label="Quiz title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Freshers' week quiz" />
          <FormField
            label="Tags (optional, separated by commas)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="freshers, 200L, fun"
            helper={`Used to find quizzes later. Up to ${MAX_TAGS} tags.`}
          />
          <FormField
            label="Max players"
            type="number"
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(e.target.value)}
            helper={`From ${MIN_PLAYERS_LIMIT} to ${MAX_PLAYERS_LIMIT}. You can change it again each time you host. When the lobby fills up, the game starts by itself after 10 seconds (or sooner if you press Start).`}
          />

          <fieldset className="rounded-lg border border-hairline bg-surface p-4">
            <legend className="px-1 text-sm font-bold text-ink-900">Game extras</legend>
            <div className="flex flex-col gap-3">
              {OPTION_ROWS.map((row) => (
                <label key={row.key} className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5"
                    checked={gameOptions[row.key]}
                    onChange={(e) => setGameOptions((o) => ({ ...o, [row.key]: e.target.checked }))}
                  />
                  <span>
                    <span className="block font-semibold text-ink-900">{row.label}</span>
                    <span className="block text-sm text-ink-muted">{row.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

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

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={addType}
              onChange={(e) => setAddType(e.target.value)}
              aria-label="Type of the next question"
              className="min-h-11 rounded-md border border-hairline bg-surface px-3 py-2 text-base text-ink"
            >
              {Object.entries(QUESTION_TYPE_INFO).map(([key, info]) => <option key={key} value={key}>{info.label}</option>)}
            </select>
            <Button variant="secondary" onClick={() => setQuestions((qs) => [...qs, blankQuestion(addType)])}>
              Add question
            </Button>
            <Button variant="secondary" onClick={() => setDialog('import')} disabled={questions.length >= MAX_QUESTIONS}>
              Import from spreadsheet
            </Button>
            <Button variant="secondary" onClick={() => setDialog('bank')} disabled={questions.length >= MAX_QUESTIONS}>
              Add from other quizzes
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saveMutation.isPending}>
              Save quiz
            </Button>
          </div>
        </div>
      )}
      {dialog === 'import' && (
        <QuizImportModal
          mode="append"
          onImport={({ questions: added }) => {
            // A draft that is still one empty question is replaced rather than left in front of the imported ones.
            setQuestions((qs) => [...(qs.length === 1 && !qs[0].text.trim() ? [] : qs), ...added].slice(0, MAX_QUESTIONS))
            setDialog(null)
            toast.success(`Added ${added.length} question${added.length === 1 ? '' : 's'}. Save the quiz to keep them.`)
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'bank' && (
        <QuestionBankModal
          excludeQuizId={id}
          onAdd={(added) => {
            setQuestions((qs) => [...(qs.length === 1 && !qs[0].text.trim() ? [] : qs), ...added].slice(0, MAX_QUESTIONS))
            setDialog(null)
            toast.success(`Added ${added.length} question${added.length === 1 ? '' : 's'}. Save the quiz to keep them.`)
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}
