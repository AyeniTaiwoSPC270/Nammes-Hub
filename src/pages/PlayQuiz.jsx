import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { callQuiz, OPTION_STYLES, secondsRemaining } from '../data/quiz'
import QuizThemeToggle from '../components/quiz/QuizThemeToggle'

// A player's phone. No account: the player joins with a code and nickname and keeps a secret token in this
// browser tab. The token is sent with every call, and the server decides what this phone is allowed to see
// (the correct answer only arrives once the host reveals it). Spec: docs/superpowers/specs/2026-09-30-live-quiz-design.md

const STORAGE_KEY = 'nammes-quiz-player'
const POLL_MS = 4000

function loadSaved() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) ?? null
  } catch {
    return null
  }
}

function saveSaved(value) {
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // private mode: the game still works, but a page reload means rejoining
  }
}

function Screen({ children, tone = 'plain' }) {
  return (
    <main
      className={[
        'flex min-h-screen flex-col items-center justify-center gap-5 p-6 text-center',
        tone === 'good' ? 'bg-green-700 text-white' : tone === 'bad' ? 'bg-red-700 text-white' : 'bg-paper text-ink-900',
      ].join(' ')}
    >
      <QuizThemeToggle />
      {children}
    </main>
  )
}

function JoinForm({ onJoined }) {
  const [params] = useSearchParams()
  const [code, setCode] = useState(() => (params.get('code') ?? '').replace(/\D/g, '').slice(0, 6))
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const joined = await callQuiz('join', { code, nickname })
      onJoined(joined)
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <Screen>
      <h1 className="text-4xl font-bold">Join a game</h1>
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4">
        <input
          inputMode="numeric"
          autoComplete="off"
          placeholder="Game code"
          aria-label="Game code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="rounded-lg border border-hairline bg-surface px-4 py-4 text-center font-mono text-3xl tracking-[0.2em] text-ink-900 placeholder:text-ink-muted"
        />
        <input
          placeholder="Nickname"
          aria-label="Nickname"
          maxLength={20}
          autoComplete="off"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className="rounded-lg border border-hairline bg-surface px-4 py-4 text-center text-2xl text-ink-900 placeholder:text-ink-muted"
        />
        {error && (
          <p role="alert" className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || code.length !== 6 || !nickname.trim()}
          className="rounded-lg bg-orange-500 px-6 py-4 text-2xl font-bold text-white disabled:opacity-50"
        >
          {busy ? 'Joining…' : 'Join'}
        </button>
      </form>
    </Screen>
  )
}

function Podium({ me, top }) {
  return (
    <>
      <p className="text-xl text-ink-muted">Final result</p>
      <p className="text-6xl font-bold">{me.rank ? `#${me.rank}` : '—'}</p>
      <p className="text-2xl font-bold">{me.score} points</p>
      <ol className="mt-2 w-full max-w-sm space-y-2 text-left">
        {(top ?? []).slice(0, 3).map((p) => (
          <li key={p.id} className="flex justify-between rounded-lg bg-surface border border-hairline text-ink-900 px-4 py-2 text-lg font-semibold">
            <span>{p.rank}. {p.nickname}</span>
            <span>{p.total_score}</span>
          </li>
        ))}
      </ol>
    </>
  )
}

export default function PlayQuiz() {
  const [saved, setSaved] = useState(loadSaved)
  const [game, setGame] = useState(null)
  const [offset, setOffset] = useState(0) // server clock minus this phone's clock
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [picked, setPicked] = useState(null) // index tapped on this question, so the button reacts at once
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')

  const token = saved?.token
  const sessionId = saved?.sessionId

  const refresh = useCallback(async () => {
    if (!token) return
    try {
      const data = await callQuiz('state', { token })
      setOffset(data.serverNow - Date.now())
      setGame(data)
      setMessage('')
    } catch (e) {
      if (e.status === 401 || e.status === 404) {
        saveSaved(null)
        setSaved(null)
        setGame(null)
      } else {
        setMessage('Connection problem. Trying again…')
      }
    }
  }, [token])

  useEffect(() => {
    if (!token) return undefined
    refresh()
    const timer = setInterval(refresh, POLL_MS)
    return () => clearInterval(timer)
  }, [token, refresh])

  // The host moving the game on wakes every phone; a small random delay spreads the requests out.
  useEffect(() => {
    if (!sessionId) return undefined
    let pending
    const channel = supabase
      .channel(`play-${sessionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'quiz_sessions', filter: `id=eq.${sessionId}` }, () => {
        clearTimeout(pending)
        pending = setTimeout(refresh, Math.random() * 400)
      })
      .subscribe()
    return () => {
      clearTimeout(pending)
      supabase.removeChannel(channel)
    }
  }, [sessionId, refresh])

  const state = game?.session.state
  useEffect(() => {
    if (state !== 'question') return undefined
    const timer = setInterval(() => setNowMs(Date.now()), 250)
    return () => clearInterval(timer)
  }, [state])

  function handleJoined(joined) {
    const next = { token: joined.token, sessionId: joined.sessionId, nickname: joined.nickname }
    saveSaved(next)
    setSaved(next)
  }

  function leave() {
    saveSaved(null)
    setSaved(null)
    setGame(null)
  }

  async function answer(index) {
    if (sending || picked !== null) return
    setPicked(index)
    setSending(true)
    try {
      await callQuiz('answer', { token, chosenIndex: index })
    } catch (e) {
      // "already answered" or "time is up": the next refresh shows the truth, so just clear the local tap
      setPicked(null)
      setMessage(e.message)
    } finally {
      setSending(false)
      refresh()
    }
  }

  // A new question clears the local tap.
  const questionKey = game ? `${game.session.state}:${game.session.index}` : ''
  useEffect(() => {
    setPicked(null)
    setMessage('')
  }, [questionKey])

  if (!token) return <JoinForm onJoined={handleJoined} />
  if (!game) return <Screen><p className="text-xl">{message || 'Joining…'}</p></Screen>

  const { session, me, question, reveal, top } = game
  const footer = (
    <p className="text-sm text-ink-muted">
      {me.nickname} · {me.score} pts
    </p>
  )

  if (session.state === 'lobby') {
    return (
      <Screen>
        <h1 className="text-4xl font-bold">You're in!</h1>
        <p className="text-2xl">See your name on the big screen.</p>
        <p className="text-ink-muted">{game.playerCount} player{game.playerCount === 1 ? '' : 's'} so far</p>
        {footer}
      </Screen>
    )
  }

  if (session.state === 'question' && question) {
    const startedAtMs = new Date(session.startedAt).getTime()
    const remaining = secondsRemaining({ startedAtMs, timeLimitSeconds: question.timeLimitSeconds, nowMs: nowMs + offset })
    const answeredNow = question.answered || picked !== null
    if (answeredNow) {
      return (
        <Screen>
          <h1 className="text-3xl font-bold">Answer locked in</h1>
          <p className="text-xl text-ink-muted">Waiting for the others…</p>
          <p className="text-5xl font-bold">{remaining}</p>
          {footer}
        </Screen>
      )
    }
    return (
      <main className="flex min-h-screen flex-col bg-paper p-3 pt-16 text-ink-900">
        <QuizThemeToggle />
        <div className="flex items-center justify-between px-2 py-3">
          <span className="text-lg">Q{session.index + 1} of {session.questionCount}</span>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 text-2xl font-bold text-white">{remaining}</span>
        </div>
        <p className="px-2 pb-3 text-center text-xl font-bold">Look at the big screen</p>
        <div className="grid flex-1 grid-cols-2 gap-3">
          {question.options.map((option, i) => (
            <button
              key={i}
              type="button"
              disabled={sending || remaining === 0}
              onClick={() => answer(i)}
              className={`flex flex-col items-center justify-center gap-2 rounded-xl p-3 text-xl font-bold text-white disabled:opacity-60 ${OPTION_STYLES[i].bg}`}
            >
              <span className="text-5xl" aria-hidden="true">{OPTION_STYLES[i].shape}</span>
              <span className="break-words">{option}</span>
            </button>
          ))}
        </div>
        {message && <p role="alert" className="mt-2 text-center text-sm text-ink-muted">{message}</p>}
      </main>
    )
  }

  if (session.state === 'reveal' && reveal) {
    const answered = reveal.chosenIndex !== null
    const correct = answered && reveal.chosenIndex === reveal.correctIndex
    return (
      <Screen tone={correct ? 'good' : 'bad'}>
        <h1 className="text-5xl font-bold">{correct ? 'Correct!' : answered ? 'Not quite' : "Time's up"}</h1>
        {correct && <p className="text-3xl font-bold">+{reveal.pointsAwarded}</p>}
        {!correct && question && (
          <p className="text-xl">
            Answer: <span className="font-bold">{question.options[reveal.correctIndex]}</span>
          </p>
        )}
        <p className="text-lg">{me.rank ? `You are #${me.rank}` : ''} · {me.score} pts</p>
      </Screen>
    )
  }

  if (session.state === 'leaderboard') {
    return (
      <Screen>
        <h1 className="text-3xl font-bold">{me.rank ? `You are #${me.rank}` : 'Leaderboard'}</h1>
        <p className="text-2xl font-bold">{me.score} points</p>
        <ol className="w-full max-w-sm space-y-2 text-left">
          {(top ?? []).slice(0, 5).map((p) => (
            <li key={p.id} className="flex justify-between rounded-lg bg-surface border border-hairline text-ink-900 px-4 py-2 text-lg font-semibold">
              <span>{p.rank}. {p.nickname}</span>
              <span>{p.total_score}</span>
            </li>
          ))}
        </ol>
        <p className="text-ink-muted">Next question coming up…</p>
      </Screen>
    )
  }

  if (session.state === 'finished') {
    return (
      <Screen>
        <Podium me={me} top={top} />
        <button type="button" onClick={leave} className="mt-4 rounded-lg border border-hairline bg-surface px-6 py-3 text-lg font-bold text-ink-900">
          Play again
        </button>
      </Screen>
    )
  }

  return <Screen><p className="text-xl">Waiting for the host…</p>{footer}</Screen>
}
