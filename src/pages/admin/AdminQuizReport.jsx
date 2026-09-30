import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchGameReport, deleteQuizSession, formatScore } from '../../data/quiz'
import { buildReport, reportToCsv, sortPlayers } from '../../data/quizReport'
import { downloadTextFile, fileSlug } from '../../lib/downloadFile'
import { useToast } from '../../lib/ToastContext'
import Breadcrumbs from '../../components/Breadcrumbs'
import Button from '../../components/ui/Button'
import ErrorState from '../../components/ui/ErrorState'
import { Avatar } from '../../components/quiz/QuizParts'

// How a finished game went: headline numbers, every question's accuracy and answers, the hardest and easiest
// questions, and a table of players. Admin only. "Print" gives an A4 page (or a PDF) without the site chrome.

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">{label}</div>
      <div className="mt-1 text-3xl font-bold text-ink-900">{value}</div>
      {hint && <div className="text-xs text-ink-muted">{hint}</div>}
    </div>
  )
}

const percent = (n) => (n === null ? '—' : `${n}%`)
const seconds = (n) => (n === null ? '—' : `${n}s`)

function QuestionRow({ q }) {
  const max = Math.max(1, ...q.options.map((o) => o.votes))
  return (
    <li className="break-inside-avoid rounded-xl border border-hairline bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 font-semibold text-ink-900">
          <span className="mr-2 text-ink-muted">{q.index + 1}.</span>
          {q.text}
        </p>
        <div className="flex gap-4 text-sm">
          {q.scored && <span><span className="text-ink-muted">Right </span><strong>{percent(q.accuracy)}</strong></span>}
          <span><span className="text-ink-muted">Answered </span><strong>{q.answered}</strong></span>
          <span><span className="text-ink-muted">Avg </span><strong>{seconds(q.avgSeconds)}</strong></span>
        </div>
      </div>
      {!q.played && <p className="mt-2 text-sm text-ink-muted">This question was not played.</p>}
      {q.options.length > 0 && q.played && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {q.options.map((o, i) => (
            <li key={i} className="flex items-center gap-3 text-sm">
              <span className={`w-40 shrink-0 truncate ${o.correct ? 'font-bold text-green-600' : 'text-ink-900'}`}>{o.correct ? '✓ ' : ''}{o.label}</span>
              <span className="h-3 flex-1 overflow-hidden rounded-full bg-hairline/60">
                <span className={`block h-full rounded-full ${o.correct ? 'bg-green-600' : 'bg-orange-500'}`} style={{ width: `${(o.votes / max) * 100}%` }} />
              </span>
              <span className="w-8 text-right tabular-nums text-ink-muted">{o.votes}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function Callout({ title, rows }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <h3 className="text-sm font-bold uppercase tracking-[0.1em] text-ink-muted">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">Not enough answers yet.</p>
      ) : (
        <ol className="mt-2 flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate"><span className="text-ink-muted">{r.index + 1}. </span>{r.text}</span>
              <strong className="shrink-0">{percent(r.accuracy)}</strong>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

const COLUMNS = [
  ['rank', 'Rank'],
  ['nickname', 'Player'],
  ['score', 'Score'],
  ['correct', 'Correct'],
  ['answered', 'Answered'],
  ['avgSeconds', 'Avg time'],
]

export default function AdminQuizReport() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['quiz_report', sessionId], queryFn: () => fetchGameReport(sessionId) })
  const [sort, setSort] = useState({ key: 'rank', direction: 'asc' })

  useEffect(() => {
    document.body.classList.add('qz-report')
    return () => document.body.classList.remove('qz-report')
  }, [])

  const report = useMemo(() => (query.data ? buildReport(query.data) : null), [query.data])
  const players = useMemo(() => (report ? sortPlayers(report.players, sort.key, sort.direction) : []), [report, sort])

  const deleteMutation = useMutation({
    mutationFn: () => deleteQuizSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz_sessions'] })
      toast.success('Game deleted.')
      navigate('/admin/quizzes')
    },
    onError: (error) => toast.error(error.message),
  })

  if (query.isError) {
    return (
      <div className="mx-auto max-w-[1100px] px-5 py-12 sm:px-6">
        <ErrorState message={query.error?.message === 'Game not found' ? 'That game does not exist any more.' : "Couldn't load this report."} onRetry={query.refetch} />
      </div>
    )
  }
  if (!report) return <p className="mx-auto max-w-[1100px] px-5 py-12 text-ink-muted sm:px-6">Loading…</p>

  const { session } = query.data
  const title = session.quizzes?.title ?? 'Deleted quiz'
  const unfinished = session.state !== 'finished'
  const { summary } = report

  function sortBy(key) {
    setSort((s) => (s.key === key ? { key, direction: s.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: key === 'nickname' || key === 'rank' ? 'asc' : 'desc' }))
  }

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-12 sm:px-6">
      <div className="qz-no-print">
        <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Live Quiz', to: '/admin/quizzes' }, { label: 'Game report' }]} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink-900">{title}</h1>
          <p className="text-ink-muted">
            Played {new Date(session.created_at).toLocaleString()} · {unfinished ? 'not finished' : 'finished'} · code {session.join_code}
          </p>
        </div>
        <div className="qz-no-print flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => downloadTextFile(`${fileSlug(title)}-report.csv`, reportToCsv(report))}>Export CSV</Button>
          <Button variant="secondary" onClick={() => window.print()}>Print / Save as PDF</Button>
          <Button
            variant="destructive"
            loading={deleteMutation.isPending}
            onClick={() => {
              if (confirm('Delete this game and everything recorded for it (players, answers)? This cannot be undone.')) deleteMutation.mutate()
            }}
          >
            Delete game
          </Button>
        </div>
      </div>

      {unfinished && (
        <p role="status" className="mt-4 rounded-lg bg-orange-500/10 p-3 text-sm text-ink-900">
          This game was not finished. The numbers cover the {summary.questionsPlayed} of {summary.questionCount} questions that were played.{' '}
          <Link to={`/host/${sessionId}`} className="qz-no-print font-semibold underline">Open the game</Link>
        </p>
      )}

      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5" aria-label="Summary">
        <Stat label="Players" value={summary.players} />
        <Stat label="Average score" value={formatScore(summary.averageScore)} />
        <Stat label="Accuracy" value={percent(summary.accuracy)} hint="right answers" />
        <Stat label="Average time" value={seconds(summary.averageSeconds)} hint="to answer" />
        <Stat label="Stayed to the end" value={percent(summary.completion)} hint="answered the last question" />
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-2">
        <Callout title="Hardest questions" rows={report.hardest} />
        <Callout title="Easiest questions" rows={report.easiest} />
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold text-ink-900">Question by question</h2>
        <ol className="mt-3 flex flex-col gap-3">
          {report.questions.map((q) => <QuestionRow key={q.id} q={q} />)}
        </ol>
      </section>

      <section className="mt-8 break-before-page">
        <h2 className="text-xl font-bold text-ink-900">Players</h2>
        {players.length === 0 ? (
          <p className="mt-2 text-ink-muted">Nobody joined this game.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-hairline">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-low text-xs uppercase tracking-[.05em] text-ink-muted">
                <tr>
                  {COLUMNS.map(([key, label]) => (
                    <th key={key} className="px-3 py-2" aria-sort={sort.key === key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" onClick={() => sortBy(key)} className="cursor-pointer font-bold uppercase">
                        {label}{sort.key === key ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id} className="border-t border-hairline">
                    <td className="px-3 py-2 tabular-nums">{p.rank}</td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        <Avatar name={p.nickname} avatarId={p.avatarId} className="h-8 w-8" />
                        {p.nickname}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-semibold tabular-nums">{formatScore(p.score)}</td>
                    <td className="px-3 py-2 tabular-nums">{p.correct}</td>
                    <td className="px-3 py-2 tabular-nums">{p.answered}</td>
                    <td className="px-3 py-2 tabular-nums">{seconds(p.avgSeconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
