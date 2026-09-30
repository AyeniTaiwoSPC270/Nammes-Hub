import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabaseClient'
import { hostAction, OPTION_STYLES, secondsRemaining } from '../data/quiz'

// Projector screen for a live quiz. The host's browser only ever asks the server to move the game on
// (/api/quiz?action=advance); everything else here is reading. Spec: docs/superpowers/specs/2026-09-30-live-quiz-design.md

const POLL_MS = 2500

function rankedPlayers(players) {
  return [...players].sort((a, b) => b.total_score - a.total_score || a.nickname.localeCompare(b.nickname))
}

function Shell({ children, footer }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#0b2417] p-6 text-white sm:p-10">
      <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col">{children}</div>
      {footer && <div className="mx-auto mt-6 w-full max-w-[1200px]">{footer}</div>}
    </div>
  )
}

function HostButton({ children, onClick, disabled, tone = 'accent' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'rounded-lg px-8 py-4 text-xl font-bold text-white transition-opacity',
        tone === 'accent' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-white/15 hover:bg-white/25',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function Lobby({ session, players, onStart, busy }) {
  const [qr, setQr] = useState('')
  const joinUrl = `${window.location.origin}/play?code=${session.join_code}`

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
    <Shell
      footer={
        <div className="flex justify-end">
          <HostButton onClick={onStart} disabled={busy || players.length === 0}>
            {players.length === 0 ? 'Waiting for players…' : `Start game (${players.length})`}
          </HostButton>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-8 text-center lg:flex-row lg:items-start lg:text-left">
        <div className="flex-1">
          <p className="text-xl text-white/80">
            Join at <span className="font-bold">{window.location.host}/play</span> with the code
          </p>
          <p className="mt-2 font-mono text-7xl font-bold tracking-[0.15em] sm:text-9xl" aria-label={`Game code ${session.join_code.split('').join(' ')}`}>
            {session.join_code}
          </p>
        </div>
        {qr && <img src={qr} alt={`QR code to join game ${session.join_code}`} className="h-56 w-56 rounded-lg bg-white p-2 sm:h-72 sm:w-72" />}
      </div>

      <h2 className="mt-10 text-2xl font-bold">
        Players <span className="text-white/60">({players.length})</span>
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {players.map((p) => (
          <span key={p.id} className="rounded-full bg-white/15 px-4 py-2 text-lg font-semibold">
            {p.nickname}
          </span>
        ))}
      </div>
    </Shell>
  )
}

function QuestionScreen({ question, index, total, remaining, answered, playerCount, onEnd, busy }) {
  return (
    <Shell
      footer={
        <div className="flex items-center justify-between gap-4">
          <span className="text-xl text-white/80">
            {answered} of {playerCount} answered
          </span>
          <HostButton onClick={onEnd} disabled={busy} tone="muted">
            End question
          </HostButton>
        </div>
      }
    >
      <div className="flex items-center justify-between text-xl text-white/70">
        <span>
          Question {index + 1} of {total}
        </span>
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-orange-500 text-4xl font-bold text-white">{remaining}</span>
      </div>
      <h1 className="my-8 text-center text-3xl font-bold sm:text-5xl">{question.text}</h1>
      <div className="mt-auto grid gap-4 sm:grid-cols-2">
        {question.options.map((option, i) => (
          <div key={i} className={`flex items-center gap-4 rounded-lg p-6 text-2xl font-bold sm:text-3xl ${OPTION_STYLES[i].bg}`}>
            <span aria-hidden="true">{OPTION_STYLES[i].shape}</span>
            {option}
          </div>
        ))}
      </div>
    </Shell>
  )
}

function RevealScreen({ question, counts, onNext, busy, isLast }) {
  const max = Math.max(1, ...counts)
  return (
    <Shell
      footer={
        <div className="flex justify-end">
          <HostButton onClick={onNext} disabled={busy}>
            {isLast ? 'Show results' : 'Leaderboard'}
          </HostButton>
        </div>
      }
    >
      <h1 className="my-8 text-center text-3xl font-bold sm:text-5xl">{question.text}</h1>
      <div className="mt-auto grid gap-4 sm:grid-cols-2">
        {question.options.map((option, i) => {
          const correct = i === question.correct_index
          return (
            <div key={i} className={`rounded-lg p-6 ${OPTION_STYLES[i].bg} ${correct ? 'ring-8 ring-white' : 'opacity-40'}`}>
              <div className="flex items-center justify-between gap-4 text-2xl font-bold sm:text-3xl">
                <span>
                  <span aria-hidden="true">{OPTION_STYLES[i].shape}</span> {option}
                </span>
                <span>{correct ? '✔ ' : ''}{counts[i] ?? 0}</span>
              </div>
              <div className="mt-3 h-3 rounded-full bg-black/25">
                <div className="h-3 rounded-full bg-white" style={{ width: `${((counts[i] ?? 0) / max) * 100}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </Shell>
  )
}

function LeaderboardScreen({ players, onNext, busy, isLast }) {
  const top = rankedPlayers(players).slice(0, 5)
  return (
    <Shell
      footer={
        <div className="flex justify-end">
          <HostButton onClick={onNext} disabled={busy}>
            {isLast ? 'Finish' : 'Next question'}
          </HostButton>
        </div>
      }
    >
      <h1 className="my-8 text-center text-4xl font-bold">Leaderboard</h1>
      <ol className="mx-auto flex w-full max-w-[700px] flex-col gap-3">
        {top.map((p, i) => (
          <li key={p.id} className="flex items-center justify-between rounded-lg bg-white/15 px-6 py-4 text-2xl font-bold">
            <span>
              {i + 1}. {p.nickname}
            </span>
            <span>{p.total_score}</span>
          </li>
        ))}
      </ol>
    </Shell>
  )
}

function FinishedScreen({ players }) {
  const ranked = rankedPlayers(players)
  const podium = [ranked[1], ranked[0], ranked[2]] // second, first, third: the winner stands in the middle
  const heights = ['h-40', 'h-56', 'h-28']
  const places = [2, 1, 3]
  return (
    <Shell
      footer={
        <div className="flex justify-end">
          <Link to="/admin/quizzes" className="rounded-lg bg-white/15 px-8 py-4 text-xl font-bold text-white no-underline hover:bg-white/25">
            Back to admin
          </Link>
        </div>
      }
    >
      <h1 className="my-8 text-center text-4xl font-bold">Final results</h1>
      <div className="mx-auto flex w-full max-w-[700px] items-end justify-center gap-3">
        {podium.map((p, i) =>
          p ? (
            <div key={p.id} className="flex flex-1 flex-col items-center">
              <span className="mb-2 text-center text-xl font-bold sm:text-2xl">{p.nickname}</span>
              <div className={`flex w-full flex-col items-center justify-start rounded-t-lg bg-orange-500 pt-3 ${heights[i]}`}>
                <span className="text-4xl font-bold">{places[i]}</span>
                <span className="text-lg">{p.total_score}</span>
              </div>
            </div>
          ) : (
            <div key={i} className="flex-1" />
          ),
        )}
      </div>
      {ranked.length > 3 && (
        <ol start={4} className="mx-auto mt-8 flex w-full max-w-[700px] flex-col gap-2">
          {ranked.slice(3).map((p, i) => (
            <li key={p.id} className="flex justify-between rounded-lg bg-white/10 px-5 py-3 text-lg">
              <span>
                {i + 4}. {p.nickname}
              </span>
              <span>{p.total_score}</span>
            </li>
          ))}
        </ol>
      )}
    </Shell>
  )
}

export default function HostQuiz() {
  const { sessionId } = useParams()
  const [session, setSession] = useState(null)
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

  const applySession = useCallback((row, live) => {
    setSession(row)
    if (row.state === 'question') {
      const key = `${row.id}:${row.current_question_index}`
      if (startedRef.current.key !== key) {
        startedRef.current = { key, ms: live ? Date.now() : new Date(row.question_started_at).getTime() }
      }
    }
  }, [])

  const loadPlayers = useCallback(async () => {
    const { data } = await supabase.from('quiz_players').select('id, nickname, total_score').eq('session_id', sessionId)
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
        const { data: qs } = await supabase.from('quiz_questions').select('*').eq('quiz_id', data.quiz_id).order('position')
        if (!cancelled && qs) setQuestions(qs)
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

  // Answers to the current question: counted while it is open and shown as bars on the reveal.
  useEffect(() => {
    if (!questionId || (state !== 'question' && state !== 'reveal')) return undefined
    let cancelled = false
    async function loadAnswers() {
      const { data } = await supabase.from('quiz_answers').select('chosen_index').eq('session_id', sessionId).eq('question_id', questionId)
      if (!cancelled && data) setAnswerSet({ questionId, rows: data })
    }
    loadAnswers()
    if (state === 'reveal') return () => { cancelled = true }
    const timer = setInterval(loadAnswers, 1500)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [sessionId, questionId, state])

  useEffect(() => {
    if (state !== 'question') return undefined
    const timer = setInterval(() => setNowMs(Date.now()), 250)
    return () => clearInterval(timer)
  }, [state])

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
  const answers = answerSet.questionId === questionId ? answerSet.rows : []
  const everyoneAnswered = players.length > 0 && answers.length >= players.length

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
      <Shell>
        <h1 className="mt-20 text-center text-3xl font-bold">Game not found</h1>
        <Link to="/admin/quizzes" className="mt-6 text-center text-white underline">Back to admin</Link>
      </Shell>
    )
  }
  if (!session || (session.state !== 'lobby' && session.state !== 'finished' && questions.length === 0)) {
    return (
      <Shell>
        <p className="mt-20 text-center text-2xl">{error || 'Loading…'}</p>
      </Shell>
    )
  }

  const isLast = session.current_question_index >= questions.length - 1
  const counts = question ? question.options.map((_, i) => answers.filter((a) => a.chosen_index === i).length) : []
  let screen
  if (session.state === 'lobby') screen = <Lobby session={session} players={players} onStart={advance} busy={busy} />
  else if (session.state === 'question' && question)
    screen = (
      <QuestionScreen
        question={question}
        index={session.current_question_index}
        total={questions.length}
        remaining={remaining}
        answered={answers.length}
        playerCount={players.length}
        onEnd={advance}
        busy={busy}
      />
    )
  else if (session.state === 'reveal' && question)
    screen = <RevealScreen question={question} counts={counts} onNext={advance} busy={busy} isLast={isLast} />
  else if (session.state === 'leaderboard') screen = <LeaderboardScreen players={players} onNext={advance} busy={busy} isLast={isLast} />
  else screen = <FinishedScreen players={players} />

  return (
    <>
      {screen}
      {error && (
        <div role="alert" className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-danger px-5 py-3 text-white shadow-lg">
          {error}
        </div>
      )}
    </>
  )
}
