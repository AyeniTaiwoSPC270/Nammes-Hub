import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchOpenQuizzes } from '../data/quiz'
import { BrandMark, QuizBackdrop, QuizTopBar } from '../components/quiz/QuizParts'
import { QuizThemeScope } from '../components/quiz/QuizTheme'

// The quizzes anyone can walk into, which is the one thing /play cannot answer: that screen is for a code somebody
// is reading off a projector, and a list of rooms above the keypad is a second, unrelated question on it. So this is
// its own route beside /play/history — reached from /play, never in the way of the keypad.
//
// Polled rather than live: it is a list of rooms, and fifteen seconds is faster than anyone walks to one. A failed
// poll keeps the last list, because a dropped request is not evidence that the games closed.
const POLL_MS = 15000

function countdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

// A game days away counts down as "2880:00", which is not a time anyone reads. Past a few hours the card prints the
// day and time it starts instead; closer than that the minutes are the useful part.
const FAR_START_MS = 6 * 60 * 60_000
function startLabel(ms) {
  if (ms <= FAR_START_MS) return `Starts in ${countdown(ms)}`
  const at = new Date(Date.now() + ms)
  return `Starts ${at.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`
}

function SessionCard({ session, nowMs, fetchedAt }) {
  const live = session.state !== 'lobby'
  // Measured from when this phone asked, not from when the answer landed, so a slow network does not delay the start.
  const startsIn = session.startsInMs == null ? null : session.startsInMs - (nowMs - fetchedAt)
  const full = session.players >= session.maxPlayers
  // A quiz that closed its doors at the first question says so rather than offering a link that is refused.
  const closed = live && !session.lateJoin

  const status = closed
    ? 'Already started'
    : live
      ? 'Live now'
      : startsIn == null
        ? 'Waiting for players'
        : startsIn > 0
          ? startLabel(startsIn)
          : 'Starting…'

  return (
    <article className="flex flex-col gap-3 rounded-3xl border border-hairline bg-surface p-5 shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-bold text-ink-900">{session.title}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
            <span className="inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-sm" aria-hidden="true">{live ? 'bolt' : 'hourglass_top'}</span>
              {status}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-sm" aria-hidden="true">group</span>
              {session.players}/{session.maxPlayers}
            </span>
          </p>
        </div>
        {full || closed ? (
          <span className="shrink-0 rounded-full border border-hairline px-3 py-1 text-xs font-semibold text-ink-muted">
            {full ? 'Full' : 'Started'}
          </span>
        ) : (
          <Link
            to={`/play?code=${session.joinCode}`}
            className="inline-flex min-h-11 shrink-0 items-center rounded-2xl bg-orange-500 px-5 text-sm font-bold text-white no-underline"
          >
            Join
          </Link>
        )}
      </div>
    </article>
  )
}

export default function PlayOpen() {
  // `null` while the first list is on its way; `[]` means the server answered and nothing is open.
  const [sessions, setSessions] = useState(null)
  const [failed, setFailed] = useState(false)
  const [fetchedAt, setFetchedAt] = useState(0)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      const askedAt = Date.now()
      fetchOpenQuizzes()
        .then((data) => {
          if (cancelled) return
          setSessions(data.sessions ?? [])
          setFetchedAt(askedAt)
          setFailed(false)
        })
        .catch(() => {
          if (!cancelled) setFailed(true)
        })
    }
    load()
    const poll = setInterval(load, POLL_MS)
    const clock = setInterval(() => setNowMs(Date.now()), 1000)
    return () => {
      cancelled = true
      clearInterval(poll)
      clearInterval(clock)
    }
  }, [reloadKey])

  return (
    // The same shell as /play, /practice and /quiz: these are phone screens beside the keypad, not site pages, so the
    // backdrop, top bar and orange accent have to match the page one tap away.
    <QuizThemeScope theme={null}>
      <div className="relative isolate flex min-h-[100dvh] flex-col bg-paper text-ink-900">
        <QuizBackdrop />
        <QuizTopBar compact />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-5">
          <Link to="/play" className="text-sm font-semibold text-orange-500">← Back to join</Link>
          <div className="flex flex-col items-center gap-2 text-center">
            <BrandMark className="h-14 w-14" />
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-orange-500">Live now</p>
            <h1 className="text-3xl font-bold">Open quizzes</h1>
            <p className="text-ink-muted">Games anyone can walk into, or that start by themselves later.</p>
          </div>

          {sessions === null && !failed && (
            <div className="flex flex-col gap-2" aria-hidden="true">
              <div className="h-24 rounded-3xl border border-hairline bg-surface" />
            </div>
          )}

          {sessions === null && failed && (
            <div className="rounded-3xl border border-hairline bg-surface p-6 text-center shadow-md">
              <span className="material-symbols-outlined text-4xl text-ink-muted" aria-hidden="true">event_busy</span>
              <p className="mt-2 font-semibold text-ink-900">Couldn&rsquo;t load the list.</p>
              <p className="mt-1 text-sm text-ink-muted">Check your connection, or enter the code from the projector.</p>
              <button
                type="button"
                onClick={() => setReloadKey((key) => key + 1)}
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-orange-500"
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">refresh</span>
                Try again
              </button>
            </div>
          )}

          {sessions !== null && sessions.length === 0 && (
            <div className="rounded-3xl border border-hairline bg-surface p-6 text-center shadow-md">
              <span className="material-symbols-outlined text-4xl text-ink-muted" aria-hidden="true">groups</span>
              <p className="mt-2 font-semibold text-ink-900">Nothing open right now.</p>
              <p className="mt-1 text-sm text-ink-muted">When a quiz opens it will appear here. You can also enter its code.</p>
              <Link to="/play" className="mt-3 inline-flex items-center justify-center rounded-2xl bg-orange-500 px-5 py-3 text-sm font-bold text-white no-underline">
                Enter a code
              </Link>
            </div>
          )}

          {sessions !== null && sessions.length > 0 && (
            <div className="flex flex-col gap-3">
              {sessions.map((session) => (
                <SessionCard key={session.id} session={session} nowMs={nowMs} fetchedAt={fetchedAt} />
              ))}
            </div>
          )}
        </main>
      </div>
    </QuizThemeScope>
  )
}
