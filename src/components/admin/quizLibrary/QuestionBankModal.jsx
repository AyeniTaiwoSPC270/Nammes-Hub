import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchQuestionBank, questionFromRow, QUESTION_TYPE_INFO } from '../../../data/quiz'
import Button from '../../ui/Button'
import ErrorState from '../../ui/ErrorState'
import QuizModal from './QuizModal'

// Pick questions from any quiz and copy them into the quiz being edited (pictures are copied too when it is saved).
export default function QuestionBankModal({ excludeQuizId, onAdd, onClose }) {
  const bank = useQuery({ queryKey: ['quiz_question_bank'], queryFn: () => fetchQuestionBank() })
  const [search, setSearch] = useState('')
  const [chosen, setChosen] = useState(() => new Set())

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return (bank.data ?? []).filter((q) => q.quiz_id !== excludeQuizId && (!needle || q.text.toLowerCase().includes(needle) || (q.quizzes?.title ?? '').toLowerCase().includes(needle)))
  }, [bank.data, search, excludeQuizId])

  function toggle(id) {
    setChosen((set) => {
      const next = new Set(set)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function add() {
    const picked = (bank.data ?? []).filter((q) => chosen.has(q.id))
    // New ids, so the copy is independent; the picture path is remembered so saving copies the file too.
    onAdd(picked.map((q) => ({ ...questionFromRow(q), id: crypto.randomUUID(), image_path: null, copyImageFrom: q.image_path ?? null })))
  }

  return (
    <QuizModal label="Add questions from other quizzes" onClose={onClose} wide>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search questions or quiz titles"
        aria-label="Search questions"
        className="min-h-11 rounded-md border border-hairline bg-surface px-3 py-2 text-base text-ink"
      />
      {bank.isError ? (
        <ErrorState message="Couldn't load questions." onRetry={bank.refetch} />
      ) : bank.isLoading ? (
        <p className="text-ink-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-ink-muted">No questions found.</p>
      ) : (
        <ul className="max-h-96 overflow-auto rounded-md border border-hairline">
          {rows.map((q) => (
            <li key={q.id} className="border-b border-hairline last:border-b-0">
              <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-surface-low">
                <input type="checkbox" className="mt-1 h-5 w-5" checked={chosen.has(q.id)} onChange={() => toggle(q.id)} />
                <span className="min-w-0">
                  <span className="block text-ink-900">{q.text}</span>
                  <span className="block text-xs text-ink-muted">{QUESTION_TYPE_INFO[q.type ?? 'multiple'].label} · from {q.quizzes?.title ?? 'a deleted quiz'}{q.image_path ? ' · has a picture' : ''}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <Button variant="accent" disabled={chosen.size === 0} onClick={add}>
        {chosen.size === 0 ? 'Choose questions' : `Add ${chosen.size} question${chosen.size === 1 ? '' : 's'}`}
      </Button>
    </QuizModal>
  )
}
