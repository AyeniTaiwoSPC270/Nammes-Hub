import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import {
  useAllQuizzesQuery,
  deleteQuiz,
  duplicateQuiz,
  setQuizArchived,
  fetchQuizWithQuestions,
  saveQuiz,
  hostAction,
  hostOp,
  deleteQuizSession,
  questionFromRow,
  DEFAULT_MAX_PLAYERS,
} from '../../data/quiz'
import { questionsToCsv } from '../../data/quizCsv'
import { downloadTextFile, fileSlug } from '../../lib/downloadFile'
import Breadcrumbs from '../../components/Breadcrumbs'
import HostQuizModal from '../../components/admin/HostQuizModal'
import QuizImportModal from '../../components/admin/quizLibrary/QuizImportModal'
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
        .select('id, join_code, state, current_question_index, created_at, quizzes(title)')
        .order('created_at', { ascending: false })
        .limit(40)
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
  const [importing, setImporting] = useState(false)
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [askingGame, setAskingGame] = useState(null) // the recent game whose delete or end is waiting for a yes
  const [showAllGames, setShowAllGames] = useState(false)
  const quizzes = quizzesQuery.data?.filter((x) => !x.is_custom && !x.is_cbt)
  const sessions = sessionsQuery.data ?? []

  const allTags = useMemo(() => [...new Set((quizzes ?? []).flatMap((q) => q.tags ?? []))].sort(), [quizzes])
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return (quizzes ?? []).filter((q) => {
      if (Boolean(q.archived_at) !== showArchived) return false
      if (tag && !(q.tags ?? []).includes(tag)) return false
      return !needle || q.title.toLowerCase().includes(needle) || (q.tags ?? []).some((t) => t.includes(needle))
    })
  }, [quizzes, search, tag, showArchived])
  const archivedCount = (quizzes ?? []).filter((q) => q.archived_at).length

  const deleteMutation = useMutation({
    mutationFn: deleteQuiz,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] })
      queryClient.invalidateQueries({ queryKey: ['quiz_sessions'] })
      toast.success('Quiz deleted.')
    },
    onError: (error) => toast.error(error.message),
  })

  async function gameAction(game, kind) {
    setBusyId(game.id)
    try {
      if (kind === 'delete') await deleteQuizSession(game.id)
      else await hostOp('end', game.id, { expectedState: game.state, expectedIndex: game.current_question_index })
      await queryClient.invalidateQueries({ queryKey: ['quiz_sessions'] })
      toast.success(kind === 'delete' ? 'Game deleted.' : 'Game ended.')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusyId(null)
      setAskingGame(null)
    }
  }

  async function run(quiz, work, done) {
    setBusyId(quiz.id)
    try {
      await work()
      await queryClient.invalidateQueries({ queryKey: ['quizzes'] })
      if (done) toast.success(done)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusyId(null)
    }
  }

  async function handleHost(quiz, maxPlayers, extra = {}) {
    setHostingId(quiz.id)
    try {
      const { sessionId } = await hostAction('create', { quizId: quiz.id, maxPlayers, ...extra })
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

  function handleExport(quiz) {
    return run(quiz, async () => {
      const full = await fetchQuizWithQuestions(quiz.id)
      downloadTextFile(`${fileSlug(quiz.title)}-questions.csv`, questionsToCsv(full.questions.map(questionFromRow)))
    })
  }

  async function handleImport({ title, questions }) {
    setBusyId('import')
    try {
      const id = await saveQuiz({ title, questions, maxPlayers: DEFAULT_MAX_PLAYERS, gameOptions: { streaks: true, powerups: true, comeback: true } })
      await queryClient.invalidateQueries({ queryKey: ['quizzes'] })
      toast.success(`Imported ${questions.length} question${questions.length === 1 ? '' : 's'}.`)
      setImporting(false)
      navigate(`/admin/quizzes/${id}/edit`)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusyId(null)
    }
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink-900">Live Quiz</h1>
          <p className="text-ink-muted">Build a quiz, then host it on a projector while students join from their phones.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setImporting(true)}>Import from spreadsheet</Button>
          <Link to="/admin/quizzes/battles">
            <Button variant="secondary">Battles</Button>
          </Link>
          <Link to="/admin/quizzes/new">
            <Button variant="primary">New quiz</Button>
          </Link>
        </div>
      </div>

      {(quizzes?.length ?? 0) > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search quizzes"
            aria-label="Search quizzes"
            className="min-h-11 min-w-0 flex-1 rounded-md border border-hairline bg-surface px-3 py-2 text-base text-ink sm:max-w-xs"
          />
          {allTags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTag(tag === t ? '' : t)}
              aria-pressed={tag === t}
              className={['min-h-9 cursor-pointer rounded-full border px-3 text-sm font-semibold', tag === t ? 'border-orange-500 bg-orange-500 text-white' : 'border-hairline bg-surface text-ink-900 hover:bg-surface-low'].join(' ')}
            >
              {t}
            </button>
          ))}
          {archivedCount > 0 && (
            <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink-900">
              <input type="checkbox" className="h-5 w-5" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Archived ({archivedCount})
            </label>
          )}
        </div>
      )}

      {quizzesQuery.isLoading ? (
        <div className="mt-6">
          <SkeletonTable columns={3} rows={4} />
        </div>
      ) : (quizzes?.length ?? 0) === 0 ? (
        <div className="mt-6">
          <EmptyState icon="quiz" title="No quizzes yet" description="Create your first quiz, or import one from a spreadsheet, to run a live game at an event." />
        </div>
      ) : visible.length === 0 ? (
        <p className="mt-6 text-ink-muted">No quizzes match.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {visible.map((quiz) => (
            <div
              key={quiz.id}
              className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4 shadow-md lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="min-w-0">
                <div className="font-semibold text-ink-900">{quiz.title}</div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                  <span>{quiz.questionCount} question{quiz.questionCount === 1 ? '' : 's'}</span>
                  {quiz.practice_enabled && <Badge tone="updated">Practice on</Badge>}
                  {quiz.battle_enabled && <Badge tone="updated">Battles on</Badge>}
                  {(quiz.tags ?? []).map((t) => <Badge key={t} tone="neutral">{t}</Badge>)}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {!quiz.archived_at && (
                  <Button variant="accent" size="sm" onClick={() => setHostingQuiz(quiz)} disabled={quiz.questionCount === 0}>
                    Host
                  </Button>
                )}
                <Link to={`/admin/quizzes/${quiz.id}/edit`}>
                  <Button variant="secondary" size="sm">Edit</Button>
                </Link>
                <Link to={`/admin/quizzes/${quiz.id}/studio`}>
                  <Button variant="secondary" size="sm">Design</Button>
                </Link>
                <Button variant="secondary" size="sm" disabled={busyId === quiz.id} onClick={() => run(quiz, async () => { const id = await duplicateQuiz(quiz.id); navigate(`/admin/quizzes/${id}/edit`) }, 'Copied. You are editing the copy.')}>
                  Duplicate
                </Button>
                <Button variant="secondary" size="sm" disabled={busyId === quiz.id || quiz.questionCount === 0} onClick={() => handleExport(quiz)}>
                  Export
                </Button>
                {quiz.practice_enabled && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/practice/${quiz.id}`).then(() => toast.success('Practice link copied.'), () => toast.error('Could not copy. Open the quiz editor to see the link.'))}
                  >
                    Copy practice link
                  </Button>
                )}
                <Button variant="ghost" size="sm" disabled={busyId === quiz.id} onClick={() => run(quiz, () => setQuizArchived(quiz.id, !quiz.archived_at), quiz.archived_at ? 'Restored.' : 'Archived.')}>
                  {quiz.archived_at ? 'Restore' : 'Archive'}
                </Button>
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
          <p className="text-sm text-ink-muted">Open a game to resume hosting it, or open its report to see how it went.</p>
          <div className="mt-3 flex flex-col gap-2">
            {sessions.slice(0, showAllGames ? sessions.length : 10).map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-hairline bg-surface px-4 py-3">
                <Link to={`/host/${s.id}`} className="font-semibold text-ink-900 no-underline hover:underline">
                  {s.quizzes?.title ?? 'Deleted quiz'}
                </Link>
                <span className="flex items-center gap-3 text-xs text-ink-muted">
                  <Badge tone={s.state === 'finished' ? 'neutral' : 'updated'}>{STATE_LABELS[s.state]}</Badge>
                  <span>{new Date(s.created_at).toLocaleString()}</span>
                  <Link to={`/admin/quizzes/games/${s.id}`} className="font-semibold text-brand-orange">Report</Link>
                </span>
                {askingGame?.id === s.id ? (
                  <span className="flex w-full flex-wrap items-center justify-end gap-2 text-sm">
                    <span className="text-ink-muted">
                      {askingGame.kind === 'delete' ? 'Delete this game and its results? This cannot be undone.' : 'End this game now? Players see the final results.'}
                    </span>
                    <Button variant={askingGame.kind === 'delete' ? 'destructive' : 'primary'} size="sm" disabled={busyId === s.id} onClick={() => gameAction(s, askingGame.kind)}>
                      {askingGame.kind === 'delete' ? 'Yes, delete' : 'Yes, end it'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setAskingGame(null)}>Cancel</Button>
                  </span>
                ) : (
                  <span className="flex w-full flex-wrap justify-end gap-2">
                    {s.state !== 'lobby' && s.state !== 'finished' && (
                      <Button variant="secondary" size="sm" onClick={() => setAskingGame({ id: s.id, kind: 'end' })}>End game</Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setAskingGame({ id: s.id, kind: 'delete' })}>Delete</Button>
                  </span>
                )}
              </div>
            ))}
          </div>
          {sessions.length > 10 && (
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowAllGames((v) => !v)}>
              {showAllGames ? 'Show fewer' : `Show all ${sessions.length}`}
            </Button>
          )}
        </section>
      )}

      {hostingQuiz && (
        <HostQuizModal
          quiz={hostingQuiz}
          busy={hostingId === hostingQuiz.id}
          onHost={(maxPlayers, extra) => handleHost(hostingQuiz, maxPlayers, extra)}
          onClose={() => setHostingQuiz(null)}
        />
      )}
      {importing && <QuizImportModal mode="new" busy={busyId === 'import'} onImport={handleImport} onClose={() => setImporting(false)} />}
    </div>
  )
}

