import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { callQuiz, formatScore } from '../data/quiz'
import { forgetSeat, rememberedSeats } from '../lib/quizPlayerStorage'
import { summariseSeat } from '../lib/quizHistory'
import { cardFilename, fetchCardBlob, personalCardUrl } from '../lib/quizCard'
import { saveCardBlob } from '../lib/shareCard'
import { SkeletonText } from '../components/ui/Skeleton'
import { BrandMark, QuizBackdrop, QuizTopBar } from '../components/quiz/QuizParts'
import { QuizThemeScope } from '../components/quiz/QuizTheme'

// The join screen offers a seat for a day, because that is how long a game is worth re-entering. History is a
// different question -- "how did I do?" -- and a game from last week is exactly what a student opened this page for.
// The records themselves are kept until the storage cap trims them.
const HISTORY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

const dateLabel = (at) =>
  at > 0 ? new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date unknown'

function CardButton({ seat, nickname }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function download() {
    setBusy(true)
    setError('')
    try {
      const blob = await fetchCardBlob(personalCardUrl({ sessionId: seat.sessionId, token: seat.token }))
      saveCardBlob(blob, cardFilename(nickname))
    } catch (e) {
      setError(e.message || 'Could not make your card')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={download}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl bg-orange-500 px-5 text-sm font-bold text-white disabled:opacity-50"
      >
        <span className="material-symbols-outlined text-base" aria-hidden="true">download</span>
        {busy ? 'Making your card…' : 'Download my card'}
      </button>
      {error && <p className="mt-1 text-xs font-semibold text-danger">{error}</p>}
    </div>
  )
}

function HistoryRow({ entry, onRetry }) {
  const { seat, summary, error } = entry

  if (error) {
    return (
      <article className="rounded-3xl border border-hairline bg-surface p-5 shadow-md">
        <p className="text-sm text-ink-muted">Couldn&rsquo;t load this one. {error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 text-sm font-semibold text-orange-500"
        >
          Retry
        </button>
      </article>
    )
  }

  if (!summary) {
    return (
      <article className="rounded-3xl border border-hairline bg-surface p-5 shadow-md">
        <SkeletonText lines={2} />
      </article>
    )
  }

  const rank = summary.rank === null ? '—' : `#${summary.rank}`
  const score = summary.score === null ? '—' : formatScore(summary.score)
  const winner = summary.winner && summary.rank !== 1 ? summary.winner : null

  return (
    <article className="rounded-3xl border border-hairline bg-surface p-5 shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink-900">
            {summary.nickname || 'Your game'} · {summary.code}
          </p>
          <p className="text-xs text-ink-muted">{dateLabel(summary.playedAt)}</p>
        </div>
        <span className="shrink-0 rounded-full border border-hairline px-2.5 py-1 text-xs font-semibold text-ink-muted">
          {summary.status === 'finished' ? 'Finished' : 'Still open'}
        </span>
      </div>

      <p className="mt-2 text-2xl font-bold tabular-nums text-ink-900">
        {rank} <span className="text-base font-semibold text-ink-muted">· {score} pts</span>
      </p>
      <p className="text-sm text-ink-muted">
        {summary.players === null ? 'Player count unavailable' : `of ${summary.players} players`}
        {winner ? ` · ${winner} won` : ''}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* The old low client did not store a session id, so a card cannot be drawn for those games. Hiding the
            button is honest; a button that always fails is the defect the seat list just fixed. */}
        {summary.status === 'finished' && seat.sessionId && seat.token && (
          <CardButton seat={seat} nickname={summary.nickname} />
        )}
        {summary.status === 'live' && (
          <Link
            to={`/play?code=${encodeURIComponent(summary.code)}`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl border-2 border-orange-500 px-5 text-sm font-bold text-orange-500 no-underline"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">login</span>
            Rejoin
          </Link>
        )}
      </div>
    </article>
  )
}

export default function PlayHistory() {
  // Read once on mount. The page only fetches when opened, and there is nothing live on it to wait for.
  const seats = useMemo(() => rememberedSeats({ includeFinished: true, maxAgeMs: HISTORY_MAX_AGE_MS }), [])
  const [entries, setEntries] = useState(() => seats.map((seat) => ({ seat, summary: null, error: '' })))

  const load = useCallback(async (seat) => {
    try {
      // `low: 1` always: this page needs scores, not explanations, pictures or backdrops.
      const state = await callQuiz('state', { token: seat.token, low: 1 })
      const summary = summariseSeat(seat, state)
      if (summary.status === 'gone') {
        forgetSeat(seat.code)
        setEntries((list) => list.filter((entry) => entry.seat.code !== seat.code))
        return
      }
      setEntries((list) => list.map((entry) => (entry.seat.code === seat.code ? { ...entry, summary } : entry)))
    } catch (e) {
      // The same rule the join screen uses: a token the server does not answer for is a dead seat, so the row goes
      // rather than sitting there as another button that can only fail.
      if (e.status === 401 || e.status === 404) {
        forgetSeat(seat.code)
        setEntries((list) => list.filter((entry) => entry.seat.code !== seat.code))
        return
      }
      setEntries((list) =>
        list.map((entry) => (entry.seat.code === seat.code ? { ...entry, error: e.message || 'Try again.' } : entry)),
      )
    }
  }, [])

  useEffect(() => {
    // One call per seat, in parallel, capped by rememberedSeats' six-seat limit.
    for (const seat of seats) load(seat)
  }, [seats, load])

  function retry(seat) {
    setEntries((list) => list.map((entry) => (entry.seat.code === seat.code ? { ...entry, error: '' } : entry)))
    load(seat)
  }

  return (
    // Same shell as /play and /practice. This page is reached from the join screen and is one tap from it, so a plain
    // site layout here read as a different product.
    <QuizThemeScope theme={null}>
      <div className="relative isolate flex min-h-[100dvh] flex-col bg-paper text-ink-900">
        <QuizBackdrop />
        <QuizTopBar compact />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-5">
          <Link to="/play" className="text-sm font-semibold text-orange-500">← Back to join</Link>
          <div className="flex flex-col items-center gap-2 text-center">
            <BrandMark className="h-14 w-14" />
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-orange-500">On this phone</p>
            <h1 className="text-3xl font-bold">Your results</h1>
            <p className="text-ink-muted">Results live on this phone. Clearing site data removes them.</p>
          </div>

          {/* `entries` can empty out after the fetch: a token the server no longer knows is removed rather than shown.
              Without the second half, that would leave the page with no message at all. */}
          {seats.length === 0 || entries.length === 0 ? (
            <div className="rounded-3xl border border-hairline bg-surface p-6 text-center shadow-md">
              <span className="material-symbols-outlined text-4xl text-ink-muted" aria-hidden="true">task_alt</span>
              <p className="mt-2 font-semibold text-ink-900">No games on this phone yet.</p>
              <p className="mt-1 text-sm text-ink-muted">
                Join a game and your final position will appear here.
              </p>
              <Link to="/play" className="mt-3 inline-flex items-center justify-center rounded-2xl bg-orange-500 px-5 py-3 text-sm font-bold text-white no-underline">
                Find a game
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {entries.map((entry) => (
                <HistoryRow key={entry.seat.code} entry={entry} onRetry={() => retry(entry.seat)} />
              ))}
            </div>
          )}
        </main>
      </div>
    </QuizThemeScope>
  )
}
