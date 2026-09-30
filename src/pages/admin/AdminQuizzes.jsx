import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { useAllQuizzesQuery, deleteQuiz, hostAction } from '../../data/quiz'
import Breadcrumbs from '../../components/Breadcrumbs'
import HostQuizModal from '../../components/admin/HostQuizModal'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonTable } from '../../components/ui/Skeleton'
import { useToast } from '../../lib/ToastContext'

const STATE_LABELS = { lobby: 'Lobby', question: 'In progress', reveal: 'In progress', leaderboard: 'In progress', finished: 'Finished' }

function useRecentSessionsQuery() {
  return useQuery({
    queryKey: ['quiz_sessions', 'recent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quiz_sessions')
        .select('id, join_code, state, created_at, quizzes(title)')
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return data
    },
  })
}

export default function AdminQuizzes() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()
  const quizzesQuery = useAllQuizzesQuery()
  const sessionsQuery = useRecentSessionsQuery()
  const [hostingQuiz, setHostingQuiz] = useState(null) // the quiz whose "Host game" dialog is open
  const [hostingId, setHostingId] = useState(null)
  const quizzes = quizzesQuery.data ?? []
  const sessions = sessionsQuery.data ?? []

  const deleteMutation = useMutation({
    mutationFn: deleteQuiz,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] })
      queryClient.invalidateQueries({ queryKey: ['quiz_sessions'] })
      toast.success('Quiz deleted.')
    },
    onError: (error) => toast.error(error.message),
  })

  async function handleHost(quiz, maxPlayers) {
    setHostingId(quiz.id)
    try {
      const { sessionId } = await hostAction('create', { quizId: quiz.id, maxPlayers })
      navigate(`/host/${sessionId}`)
    } catch (error) {
      toast.error(error.message)
      setHostingId(null)
    }
  }

  function handleDelete(quiz) {
    if (!confirm(`Delete "${quiz.title}"? This removes its questions and every game played with it.`)) return
    deleteMutation.mutate(quiz.id)
  }

  if (quizzesQuery.isError && !quizzesQuery.data) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load quizzes right now." onRetry={quizzesQuery.refetch} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Live Quiz' }]} />

      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink-900">Live Quiz</h1>
          <p className="text-ink-muted">Build a quiz, then host it on a projector while students join from their phones.</p>
        </div>
        <Link to="/admin/quizzes/new">
          <Button variant="primary">New quiz</Button>
        </Link>
      </div>

      {quizzesQuery.isLoading ? (
        <div className="mt-6">
          <SkeletonTable columns={3} rows={4} />
        </div>
      ) : quizzes.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon="quiz" title="No quizzes yet" description="Create your first quiz to run a live game at an event." />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {quizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface p-4 shadow-md sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="font-semibold text-ink-900">{quiz.title}</div>
                <div className="text-xs text-ink-muted">
                  {quiz.questionCount} question{quiz.questionCount === 1 ? '' : 's'}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  variant="accent"
                  size="sm"
                  onClick={() => setHostingQuiz(quiz)}
                  disabled={quiz.questionCount === 0}
                >
                  Host
                </Button>
                <Link to={`/admin/quizzes/${quiz.id}/edit`}>
                  <Button variant="secondary" size="sm">Edit</Button>
                </Link>
                <Link to={`/admin/quizzes/${quiz.id}/studio`}>
                  <Button variant="secondary" size="sm">Design</Button>
                </Link>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(quiz)} loading={deleteMutation.isPending}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {sessions.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold text-ink-900">Recent games</h2>
          <p className="text-sm text-ink-muted">Open a game to resume hosting it, or to see its final results.</p>
          <div className="mt-3 flex flex-col gap-2">
            {sessions.map((s) => (
              <Link
                key={s.id}
                to={`/host/${s.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-hairline bg-surface px-4 py-3 no-underline hover:bg-surface-low"
              >
                <span className="font-semibold text-ink-900">{s.quizzes?.title ?? 'Deleted quiz'}</span>
                <span className="flex items-center gap-3 text-xs text-ink-muted">
                  <Badge tone={s.state === 'finished' ? 'neutral' : 'updated'}>{STATE_LABELS[s.state]}</Badge>
                  <span>{new Date(s.created_at).toLocaleString()}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {hostingQuiz && (
        <HostQuizModal
          quiz={hostingQuiz}
          busy={hostingId === hostingQuiz.id}
          onHost={(maxPlayers) => handleHost(hostingQuiz, maxPlayers)}
          onClose={() => setHostingQuiz(null)}
        />
      )}
    </div>
  )
}
