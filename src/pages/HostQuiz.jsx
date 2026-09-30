import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabaseClient'
import { hostAction, OPTION_STYLES, secondsRemaining, rankPlayers, formatScore, autoSecondsLeft, AUTO_ADVANCE_MS } from '../data/quiz'
import { AnswerShape, Avatar, CountdownRing, Confetti, MathBackdrop, QuizTopBar } from '../components/quiz/QuizParts'

// Projector screen for a live quiz. The host's browser only ever asks the server to move the game on
// (/api/quiz?action=advance); everything else here is reading. Spec: docs/superpowers/specs/2026-09-30-live-quiz-design.md

const POLL_MS = 2500

function Stage({ title, chip, footer, children }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-paper text-ink-900">
      <MathBackdrop />
      <QuizTopBar title={title}>{chip}</QuizTopBar>
      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 px-4 py-6 sm:px-8">{children}</main>
      {footer && (
        <footer className="sticky bottom-0 z-20 border-t border-hairline bg-paper/90 px-4 py-4 backdrop-blur sm:px-8">
          <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-3">{footer}</div>
        </footer>
      )}
    </div>
  )
}

function Chip({ children, tone = 'plain' }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold',
        tone === 'accent' ? 'bg-orange-500 text-white' : 'border border-hairline bg-surface text-ink-900',
      ].join(' ')}
    >
      {children}
    </span>
  )
}

function ActionButton({ children, onClick, disabled, tone = 'accent', icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-2xl px-8 py-4 text-xl font-bold shadow-md transition-transform',
        tone === 'accent' ? 'bg-orange-500 text-white hover:bg-orange-600' : 'border border-hairline bg-surface text-ink-900 hover:bg-surface-low',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer active:scale-[0.98]',
      ].join(' ')}
    >
      {icon && <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>}
      {children}
    </button>
  )
}

// Reveal and leaderboard move on by themselves; the host can pause that, or just click ahead.
function AutoAdvance({ auto }) {
  return (
    <button
      type="button"
      onClick={auto.toggle}
      className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-hairline bg-surface px-4 py-2 text-sm font-bold text-ink-900 hover:bg-surface-low"
    >
      <span className="material-symbols-outlined" aria-hidden="true">{auto.on ? 'pause' : 'play_arrow'}</span>
      {auto.on ? 'Pause auto-advance' : 'Resume auto-advance'}
    </button>
  )
}

function withCountdown(label, auto) {
  return auto.on ? `${label} (${auto.secondsLeft}s)` : label
}

function Lobby({ session, title, players, questionCount, onStart, busy }) {
  const [qr, setQr] = useState('')
  const joinUrl = `${window.location.origin}/play?code=${session.join_code}`
  const digits = session.join_code.split('')

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(joinUrl, { width: 360, margin: 1 }).then((url) => {
      if (!cancelled) setQr(url)
    })
    return () => {
      cancelled = true
    }
  }, [joinUrl])

  return (
    <Stage
      title={title}
      chip={<Chip>{questionCount} question{questionCount === 1 ? '' : 's'}</Chip>}
      footer={
        <>
          <span className="text-ink-muted">
            {players.length === 0 ? 'Players will appear here as they join.' : 'Everyone in? Start when you are ready.'}
          </span>
          <ActionButton onClick={onStart} disabled={busy || players.length === 0} icon="play_arrow">
            {players.length === 0 ? 'Waiting for players…' : `Start game (${players.length})`}
          </ActionButton>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="qz-rise flex flex-col justify-between gap-8 rounded-3xl bg-gradient-to-br from-green-900 to-[#17492f] p-8 text-white shadow-xl sm:p-10">
          <div>
            <p className="text-lg font-semibold uppercase tracking-[0.14em] text-orange-100/80">Join the game</p>
            <p className="mt-1 text-2xl font-semibold sm:text-3xl">
              Go to <span className="text-orange-100">{window.location.host}/play</span> and enter
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3" aria-label={`Game code ${digits.join(' ')}`}>
            {digits.map((d, i) => (
              <span key={i} className="contents">
                {i === 3 && <span className="mx-1 text-4xl font-bold text-white/40" aria-hidden="true">·</span>}
                <span
                  className="qz-pop flex h-20 w-14 items-center justify-center rounded-2xl bg-white/12 text-5xl font-bold shadow-inner ring-1 ring-white/20 sm:h-28 sm:w-20 sm:text-7xl"
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  {d}
                </span>
              </span>
            ))}
          </div>
          <ol className="grid gap-3 text-base text-white/85 sm:grid-cols-3">
            {['Open the link or scan the QR', 'Type the game code', 'Pick a nickname and join'].map((step, i) => (
              <li key={step} className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500 font-bold">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </section>

        <section className="qz-rise flex flex-col items-center justify-center gap-4 rounded-3xl border border-hairline bg-surface p-6 text-center shadow-md">
          {qr ? (
            <img src={qr} alt={`QR code to join game ${session.join_code}`} className="h-64 w-64 rounded-2xl bg-white p-3 shadow-sm sm:h-72 sm:w-72" />
          ) : (
            <div className="h-64 w-64 animate-pulse rounded-2xl bg-surface-low sm:h-72 sm:w-72" />
          )}
          <p className="text-xl font-bold">Scan to join</p>
          <p className="text-sm text-ink-muted">The code is filled in for you.</p>
        </section>
      </div>

      <section className="rounded-3xl border border-hairline bg-surface p-6 shadow-md sm:p-8">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">Players</h2>
          <span className="flex h-9 min-w-9 items-center justify-center rounded-full bg-orange-500 px-3 text-lg font-bold text-white">{players.length}</span>
        </div>
        {players.length === 0 ? (
          <p className="mt-6 flex items-center gap-3 text-lg text-ink-muted">
            <span className="qz-float inline-block text-3xl" aria-hidden="true">π</span>
            Waiting for the first player to join…
          </p>
        ) : (
          <div className="mt-5 flex flex-wrap gap-3">
            {players.map((p) => (
              <span key={p.id} className="qz-pop inline-flex items-center gap-2 rounded-full border border-hairline bg-paper py-1 pl-1.5 pr-4 text-lg font-semibold">
                <Avatar name={p.nickname} avatarId={p.avatar_id} className="h-12 w-12" />
                {p.nickname}
              </span>
            ))}
          </div>
        )}
      </section>
    </Stage>
  )
}

function AnswerTiles({ question, children }) {
  return (
    <div className="grid flex-1 gap-4 sm:grid-cols-2">
      {question.options.map((option, i) => children(option, i))}
    </div>
  )
}

function QuestionScreen({ title, question, index, total, remaining, answered, playerCount, onEnd, busy }) {
  const share = playerCount > 0 ? Math.round((answered / playerCount) * 100) : 0
  return (
    <Stage
      title={title}
      chip={<Chip tone="accent">Question {index + 1} of {total}</Chip>}
      footer={
        <>
          <span className="text-ink-muted">Answers lock when the timer ends or everyone has answered.</span>
          <ActionButton onClick={onEnd} disabled={busy} tone="muted" icon="fast_forward">End question</ActionButton>
        </>
      }
    >
      <div className="flex items-center gap-6 rounded-3xl border border-hairline bg-surface p-5 shadow-md sm:p-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between text-lg font-semibold">
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-500" aria-hidden="true">groups</span>
              {answered} of {playerCount} answered
            </span>
            <span className="text-ink-muted">{share}%</span>
          </div>
          <div className="mt-3 h-4 overflow-hidden rounded-full bg-hairline/60">
            <div className="h-full rounded-full bg-orange-500 transition-[width] duration-500" style={{ width: `${share}%` }} />
          </div>
        </div>
        <CountdownRing seconds={remaining} total={question.time_limit_seconds} size={104} />
      </div>

      <h1 className="qz-rise mx-auto max-w-5xl px-2 text-center text-3xl font-bold leading-tight sm:text-5xl">{question.text}</h1>

      <AnswerTiles question={question}>
        {(option, i) => (
          <div
            key={i}
            className={`qz-rise flex min-h-[120px] items-center gap-5 rounded-3xl p-6 text-white shadow-lg ${OPTION_STYLES[i].bg}`}
            style={{ animationDelay: `${120 + i * 80}ms` }}
          >
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-black/20">
              <AnswerShape index={i} className="h-9 w-9" />
            </span>
            <span className="text-2xl font-bold leading-snug sm:text-4xl">{option}</span>
          </div>
        )}
      </AnswerTiles>
    </Stage>
  )
}

function RevealScreen({ title, question, index, total, counts, answers, playersById, questionStartedAt, playerCount, onNext, busy, isLast, auto }) {
  const max = Math.max(1, ...counts)
  const correctCount = counts[question.correct_index] ?? 0
  const percentCorrect = answers.length > 0 ? Math.round((correctCount / answers.length) * 100) : 0
  const startMs = new Date(questionStartedAt).getTime()
  const fastest = answers
    .filter((a) => a.chosen_index === question.correct_index)
    .map((a) => ({ ...a, ms: new Date(a.answered_at).getTime() - startMs }))
    .filter((a) => Number.isFinite(a.ms))
    .sort((a, b) => a.ms - b.ms)[0]
  const fastestName = fastest ? playersById.get(fastest.player_id)?.nickname : null

  return (
    <Stage
      title={title}
      chip={<Chip>Question {index + 1} of {total} · Time&apos;s up</Chip>}
      footer={
        <>
          <AutoAdvance auto={auto} />
          <ActionButton onClick={onNext} disabled={busy} icon="arrow_forward">{withCountdown(isLast ? 'Final standings' : 'Leaderboard', auto)}</ActionButton>
        </>
      }
    >
      <h1 className="mx-auto max-w-5xl px-2 pt-2 text-center text-2xl font-bold leading-tight sm:text-4xl">{question.text}</h1>

      <AnswerTiles question={question}>
        {(option, i) => {
          const correct = i === question.correct_index
          return (
            <div
              key={i}
              className={[
                'flex flex-col justify-between gap-4 rounded-3xl p-6 text-white shadow-lg transition-all',
                OPTION_STYLES[i].bg,
                correct ? 'qz-pop scale-[1.02] ring-8 ring-ink-900' : 'opacity-40',
              ].join(' ')}
            >
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-4 text-2xl font-bold sm:text-3xl">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-black/20">
                    {correct ? <span className="material-symbols-outlined text-4xl" aria-hidden="true">check</span> : <AnswerShape index={i} className="h-8 w-8" />}
                  </span>
                  {option}
                </span>
                <span className="rounded-full bg-black/25 px-4 py-1 text-2xl font-bold">{counts[i] ?? 0}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-black/25">
                <div className="h-full rounded-full bg-white transition-[width] duration-700" style={{ width: `${((counts[i] ?? 0) / max) * 100}%` }} />
              </div>
            </div>
          )
        }}
      </AnswerTiles>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: 'target', label: 'Got it right', value: `${percentCorrect}%` },
          { icon: 'bolt', label: 'Fastest correct', value: fastestName ? `${fastestName} · ${(fastest.ms / 1000).toFixed(1)}s` : '—' },
          { icon: 'groups', label: 'Answered', value: `${answers.length} of ${playerCount}` },
        ].map((stat) => (
          <div key={stat.label} className="flex items-center gap-4 rounded-2xl border border-hairline bg-surface p-4 shadow-sm">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-500">
              <span className="material-symbols-outlined" aria-hidden="true">{stat.icon}</span>
            </span>
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">{stat.label}</div>
              <div className="truncate text-xl font-bold">{stat.value}</div>
            </div>
          </div>
        ))}
      </div>
    </Stage>
  )
}

const MEDALS = ['🥇', '🥈', '🥉']

function LeaderboardScreen({ title, index, total, players, gains, question, onNext, busy, isLast, auto }) {
  const ranked = useMemo(() => rankPlayers(players), [players])
  const previous = useMemo(
    () => new Map(rankPlayers(players.map((p) => ({ ...p, total_score: p.total_score - (gains.get(p.id) ?? 0) }))).map((p) => [p.id, p.rank])),
    [players, gains],
  )
  const top = ranked.slice(0, 5)

  return (
    <Stage
      title={title}
      chip={<Chip>After question {index + 1} of {total}</Chip>}
      footer={
        <>
          <AutoAdvance auto={auto} />
          <ActionButton onClick={onNext} disabled={busy} icon="arrow_forward">{withCountdown(isLast ? 'Final results' : 'Next question', auto)}</ActionButton>
        </>
      }
    >
      <h1 className="text-center text-4xl font-bold sm:text-5xl">Leaderboard</h1>
      <ol className="mx-auto flex w-full max-w-4xl flex-col gap-3">
        {top.map((p, i) => {
          const moved = (previous.get(p.id) ?? p.rank) - p.rank
          const gain = gains.get(p.id) ?? 0
          return (
            <li
              key={p.id}
              className={[
                'qz-rise flex items-center gap-4 rounded-2xl border p-4 shadow-sm sm:p-5',
                i === 0 ? 'border-orange-500 bg-orange-500/10' : 'border-hairline bg-surface',
              ].join(' ')}
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <span className="w-12 text-center text-3xl font-bold" aria-label={`Rank ${p.rank}`}>{MEDALS[p.rank - 1] ?? p.rank}</span>
              <Avatar name={p.nickname} avatarId={p.avatar_id} mood={p.rank === 1 ? 'dance' : gain > 0 ? 'happy' : 'idle'} className="h-16 w-16" />
              <span className="min-w-0 flex-1 truncate text-2xl font-bold sm:text-3xl">{p.nickname}</span>
              {moved !== 0 && (
                <span className={`hidden items-center text-lg font-bold sm:flex ${moved > 0 ? 'text-green-600' : 'text-red-600'}`} aria-label={moved > 0 ? `Up ${moved}` : `Down ${-moved}`}>
                  <span className="material-symbols-outlined" aria-hidden="true">{moved > 0 ? 'arrow_upward' : 'arrow_downward'}</span>
                  {Math.abs(moved)}
                </span>
              )}
              {gain > 0 && <span className="rounded-full bg-green-600/15 px-3 py-1 text-lg font-bold text-green-600">+{formatScore(gain)}</span>}
              <span className="w-28 text-right text-3xl font-bold tabular-nums sm:w-36 sm:text-4xl">{formatScore(p.total_score)}</span>
            </li>
          )
        })}
      </ol>
      {question && (
        <p className="mx-auto max-w-4xl text-center text-ink-muted">
          The answer to that one was <span className="font-bold text-ink-900">{question.options[question.correct_index]}</span>.
        </p>
      )}
    </Stage>
  )
}

function downloadCsv(ranked, quizTitle) {
  const escape = (value) => `"${String(value).replace(/"/g, '""')}"`
  const rows = [['Rank', 'Nickname', 'Score'], ...ranked.map((p) => [p.rank, p.nickname, p.total_score])]
  const blob = new Blob([rows.map((r) => r.map(escape).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${(quizTitle || 'quiz').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-results.csv`
  link.click()
  URL.revokeObjectURL(url)
}

const PODIUM = [
  { place: 2, height: 'h-44 sm:h-56', block: 'bg-green-900 text-white', delay: 600 },
  { place: 1, height: 'h-60 sm:h-80', block: 'bg-gradient-to-b from-orange-500 to-orange-600 text-white', delay: 1000 },
  { place: 3, height: 'h-32 sm:h-40', block: 'border border-hairline bg-surface text-ink-900', delay: 200 },
]

function FinishedScreen({ title, players }) {
  const ranked = useMemo(() => rankPlayers(players), [players])
  const byPlace = (place) => ranked[place - 1]
  return (
    <Stage
      title={title}
      chip={<Chip tone="accent">Final results</Chip>}
      footer={
        <>
          <ActionButton onClick={() => downloadCsv(ranked, title)} tone="muted" icon="download">Download results (CSV)</ActionButton>
          <Link to="/admin/quizzes" className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-8 py-4 text-xl font-bold text-white no-underline shadow-md hover:bg-orange-600 hover:text-white">
            Back to admin
          </Link>
        </>
      }
    >
      {ranked.length > 0 && <Confetti />}
      <h1 className="text-center text-4xl font-bold sm:text-5xl">Final results</h1>
      <p className="text-center text-lg text-ink-muted">{ranked.length} player{ranked.length === 1 ? '' : 's'} took part</p>

      <div className="mx-auto flex w-full max-w-3xl items-end justify-center gap-3 sm:gap-5">
        {PODIUM.map(({ place, height, block, delay }) => {
          const p = byPlace(place)
          return (
            <div key={place} className="flex flex-1 flex-col items-center">
              {p && (
                <div className="qz-rise mb-3 flex flex-col items-center gap-2 text-center" style={{ animationDelay: `${delay + 500}ms` }}>
                  {place === 1 && <span className="qz-float text-5xl" aria-hidden="true">👑</span>}
                  <Avatar name={p.nickname} avatarId={p.avatar_id} mood={place === 1 ? 'dance' : 'happy'} className={place === 1 ? 'h-28 w-28' : 'h-20 w-20'} />
                  <span className={`max-w-full truncate font-bold ${place === 1 ? 'text-3xl' : 'text-xl'}`}>{p.nickname}</span>
                </div>
              )}
              <div
                className={`qz-grow flex w-full flex-col items-center rounded-t-3xl pt-4 shadow-lg ${height} ${block}`}
                style={{ animationDelay: `${delay}ms` }}
              >
                <span className="text-5xl font-bold">{place}</span>
                {p && <span className="text-xl font-semibold tabular-nums opacity-90">{formatScore(p.total_score)}</span>}
              </div>
            </div>
          )
        })}
      </div>

      {ranked.length > 3 && (
        <ol className="mx-auto grid w-full max-w-4xl gap-3 sm:grid-cols-2">
          {ranked.slice(3).map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-hairline bg-surface px-4 py-3">
              <span className="w-8 text-center text-lg font-bold text-ink-muted">{p.rank}</span>
              <Avatar name={p.nickname} avatarId={p.avatar_id} className="h-11 w-11" />
              <span className="min-w-0 flex-1 truncate text-lg font-semibold">{p.nickname}</span>
              <span className="text-lg font-bold tabular-nums">{formatScore(p.total_score)}</span>
            </li>
          ))}
        </ol>
      )}
    </Stage>
  )
}

export default function HostQuiz() {
  const { sessionId } = useParams()
  const [session, setSession] = useState(null)
  const [quizTitle, setQuizTitle] = useState('')
  const [questions, setQuestions] = useState([])
  const [players, setPlayers] = useState([])
  const [answerSet, setAnswerSet] = useState({ questionId: null, rows: [] })
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())
  // When the host's own screen first saw this question start (used for the countdown, so a host laptop
  // with a slightly wrong clock still counts down correctly). On a page reload we fall back to the server time.
  const startedRef = useRef({ key: '', ms: 0 })
  const autoKeyRef = useRef('')
  const [autoOn, setAutoOn] = useState(true)
  // When the current step (question, reveal, leaderboard...) first appeared on this screen; drives the auto-advance countdown.
  const enteredRef = useRef({ key: '', ms: 0 })

  const applySession = useCallback((row, live) => {
    setSession(row)
    const enterKey = `${row.state}:${row.current_question_index}`
    if (enteredRef.current.key !== enterKey) enteredRef.current = { key: enterKey, ms: Date.now() }
    if (row.state === 'question') {
      const key = `${row.id}:${row.current_question_index}`
      if (startedRef.current.key !== key) {
        startedRef.current = { key, ms: live ? Date.now() : new Date(row.question_started_at).getTime() }
      }
    }
  }, [])

  const loadPlayers = useCallback(async () => {
    const { data } = await supabase.from('quiz_players').select('id, nickname, total_score, avatar_id').eq('session_id', sessionId)
    if (data) setPlayers(data)
  }, [sessionId])

  // First load, then a slow poll as a safety net in case live updates drop.
  useEffect(() => {
    let cancelled = false
    async function loadAll(first) {
      const { data, error: loadError } = await supabase.from('quiz_sessions').select('*').eq('id', sessionId).maybeSingle()
      if (cancelled) return
      if (loadError) {
        setError('Could not load the game. Check your connection.')
        return
      }
      if (!data) {
        setNotFound(true)
        return
      }
      setError('')
      applySession(data, false)
      loadPlayers()
      if (first) {
        const [{ data: qs }, { data: quiz }] = await Promise.all([
          supabase.from('quiz_questions').select('*').eq('quiz_id', data.quiz_id).order('position'),
          supabase.from('quizzes').select('title').eq('id', data.quiz_id).maybeSingle(),
        ])
        if (cancelled) return
        if (qs) setQuestions(qs)
        if (quiz) setQuizTitle(quiz.title)
      }
    }
    loadAll(true)
    const timer = setInterval(() => loadAll(false), POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [sessionId, applySession, loadPlayers])

  useEffect(() => {
    const channel = supabase
      .channel(`host-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_sessions', filter: `id=eq.${sessionId}` }, (payload) => {
        if (payload.new?.id) applySession(payload.new, true)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'quiz_players', filter: `session_id=eq.${sessionId}` }, () => loadPlayers())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, applySession, loadPlayers])

  const question = session && session.current_question_index >= 0 ? questions[session.current_question_index] : null
  const state = session?.state
  const questionId = question?.id

  // Answers to the current question: counted while it is open, and used for the bars and round points after it closes.
  useEffect(() => {
    if (!questionId || (state !== 'question' && state !== 'reveal' && state !== 'leaderboard')) return undefined
    let cancelled = false
    async function loadAnswers() {
      const { data } = await supabase
        .from('quiz_answers')
        .select('player_id, chosen_index, points_awarded, answered_at')
        .eq('session_id', sessionId)
        .eq('question_id', questionId)
      if (!cancelled && data) setAnswerSet({ questionId, rows: data })
    }
    loadAnswers()
    if (state !== 'question') return () => { cancelled = true }
    const timer = setInterval(loadAnswers, 1500)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [sessionId, questionId, state])

  useEffect(() => {
    if (state !== 'question' && state !== 'reveal' && state !== 'leaderboard') return undefined
    const timer = setInterval(() => setNowMs(Date.now()), 250)
    return () => clearInterval(timer)
  }, [state])

  // After the reveal and after the leaderboard the game moves on by itself, so the host does not have to keep
  // clicking. The last leaderboard finishes the game. The server ignores a repeat, so a click at the same moment is harmless.
  useEffect(() => {
    if (!autoOn || (state !== 'reveal' && state !== 'leaderboard')) return undefined
    const timer = setTimeout(() => advance(), AUTO_ADVANCE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOn, state, session?.current_question_index])

  async function advance() {
    if (busy || !session) return
    setBusy(true)
    setError('')
    try {
      const { session: next } = await hostAction('advance', {
        sessionId,
        expectedState: session.state,
        expectedIndex: session.current_question_index,
      })
      applySession(next, true)
    } catch (e) {
      if (e.status === 409 && e.data?.session) applySession(e.data.session, true)
      else setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const remaining = question
    ? secondsRemaining({ startedAtMs: startedRef.current.ms, timeLimitSeconds: question.time_limit_seconds, nowMs })
    : 0
  // Only count answers that belong to the question on screen (a leftover set from the previous question must not close this one).
  const answers = useMemo(() => (answerSet.questionId === questionId ? answerSet.rows : []), [answerSet, questionId])
  const everyoneAnswered = players.length > 0 && answers.length >= players.length
  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])
  const gains = useMemo(() => new Map(answers.map((a) => [a.player_id, a.points_awarded])), [answers])

  // Close the question by itself when time runs out or everyone has answered. The server ignores a repeat.
  useEffect(() => {
    if (state !== 'question' || !question) return
    if (remaining > 0 && !everyoneAnswered) return
    const key = `${sessionId}:${session.current_question_index}`
    if (autoKeyRef.current === key) return
    autoKeyRef.current = key
    advance()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, remaining, everyoneAnswered])

  if (notFound) {
    return (
      <Stage title="">
        <h1 className="mt-20 text-center text-3xl font-bold">Game not found</h1>
        <Link to="/admin/quizzes" className="text-center underline">Back to admin</Link>
      </Stage>
    )
  }
  if (!session || (session.state !== 'lobby' && session.state !== 'finished' && questions.length === 0)) {
    return (
      <Stage title="">
        <p className="mt-20 text-center text-2xl text-ink-muted">{error || 'Loading…'}</p>
      </Stage>
    )
  }

  const isLast = session.current_question_index >= questions.length - 1
  const auto = {
    on: autoOn,
    toggle: () => setAutoOn((on) => !on),
    secondsLeft: autoSecondsLeft({ enteredMs: enteredRef.current.ms, nowMs }),
  }
  const counts = question ? question.options.map((_, i) => answers.filter((a) => a.chosen_index === i).length) : []
  const shared = { title: quizTitle, index: session.current_question_index, total: questions.length, busy }
  let screen
  if (session.state === 'lobby') {
    screen = <Lobby session={session} title={quizTitle} players={players} questionCount={questions.length} onStart={advance} busy={busy} />
  } else if (session.state === 'question' && question) {
    screen = (
      <QuestionScreen {...shared} question={question} remaining={remaining} answered={answers.length} playerCount={players.length} onEnd={advance} />
    )
  } else if (session.state === 'reveal' && question) {
    screen = (
      <RevealScreen
        {...shared}
        question={question}
        counts={counts}
        answers={answers}
        playersById={playersById}
        questionStartedAt={session.question_started_at}
        playerCount={players.length}
        onNext={advance}
        isLast={isLast}
        auto={auto}
      />
    )
  } else if (session.state === 'leaderboard') {
    screen = <LeaderboardScreen {...shared} players={players} gains={gains} question={question} onNext={advance} isLast={isLast} auto={auto} />
  } else {
    screen = <FinishedScreen title={quizTitle} players={players} />
  }

  return (
    <>
      {screen}
      {error && (
        <div role="alert" className="fixed bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-2xl bg-danger px-5 py-3 text-white shadow-lg">
          {error}
        </div>
      )}
    </>
  )
}
