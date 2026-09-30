import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { callQuiz, OPTION_STYLES, secondsRemaining, formatScore, AVATAR_COUNT, avatarInfo, randomAvatarId, autoSecondsLeft, FULL_LOBBY_COUNTDOWN_MS } from '../data/quiz'
import { AnswerShape, Avatar, BrandMark, CountdownRing, Confetti, QuizBackdrop, QuizTopBar } from '../components/quiz/QuizParts'
import QuizThemeToggle from '../components/quiz/QuizThemeToggle'
import { QuizThemeScope, useQuizTheme } from '../components/quiz/QuizTheme'
import Character from '../components/quiz/Character'
import { useCountUp } from '../lib/useCountUp'

// A player's phone. No account: the player joins with a code and nickname and keeps a secret token in this
// browser tab. The token is sent with every call, and the server decides what this phone is allowed to see
// (the correct answer only arrives once the host reveals it). Spec: docs/superpowers/specs/2026-09-30-live-quiz-design.md

const STORAGE_KEY = 'nammes-quiz-player'
const POLL_MS = 4000
const MEDALS = ['🥇', '🥈', '🥉']

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

// Standard phone screen: slim bar (with the player's name and score once they are in) and a centred column.
function Phone({ me, children }) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-paper text-ink-900">
      <QuizBackdrop />
      <QuizTopBar compact>
        {me && (
          <span className="flex items-center gap-2 rounded-full border border-hairline bg-surface py-1 pl-1 pr-3 text-sm font-bold">
            <Avatar name={me.nickname} avatarId={me.avatarId} className="h-8 w-8" />
            <span className="max-w-[7rem] truncate">{me.nickname}</span>
            <span className="text-orange-500">{formatScore(me.score)}</span>
          </span>
        )}
      </QuizTopBar>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-5">{children}</main>
    </div>
  )
}

// Full-colour result screens (green for right, red for wrong, deep green otherwise).
function ResultScreen({ tone, children }) {
  const bg = tone === 'good' ? 'bg-green-700' : tone === 'bad' ? 'bg-red-700' : 'qz-deep'
  return (
    <div className={`relative flex min-h-[100dvh] flex-col text-white ${bg}`}>
      <div className="flex justify-end p-4">
        <QuizThemeToggle />
      </div>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-6 pb-10 text-center">{children}</main>
    </div>
  )
}

function CodeInput({ value, onChange, autoFocus }) {
  const inputRef = useRef(null)
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])
  return (
    <div className="relative" onClick={() => inputRef.current?.focus()}>
      <div className="flex items-center justify-center gap-2" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className="contents">
            {i === 3 && <span className="text-2xl font-bold text-ink-muted">·</span>}
            <span
              className={[
                'flex h-16 w-11 items-center justify-center rounded-2xl border-2 bg-surface text-3xl font-bold shadow-sm transition-colors',
                focused && i === Math.min(value.length, 5) ? 'border-orange-500' : 'border-hairline',
              ].join(' ')}
            >
              {value[i] ?? ''}
            </span>
          </span>
        ))}
      </div>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label="Game code"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  )
}

function JoinForm({ onJoined }) {
  const [params] = useSearchParams()
  const initialCode = (params.get('code') ?? '').replace(/\D/g, '').slice(0, 6)
  const [code, setCode] = useState(initialCode)
  const [nickname, setNickname] = useState('')
  const [avatarId, setAvatarId] = useState(randomAvatarId)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const joined = await callQuiz('join', { code, nickname, avatarId })
      onJoined(joined)
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <Phone>
      <div className="qz-rise flex flex-col items-center gap-2 pt-4 text-center">
        <BrandMark className="h-16 w-16" />
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-orange-500">Campus challenge</p>
        <h1 className="text-4xl font-bold">Join a game</h1>
        <p className="text-ink-muted">Enter the code on the big screen to get in.</p>
      </div>

      <form onSubmit={submit} className="qz-rise mt-2 flex flex-col gap-5 rounded-3xl border border-hairline bg-surface p-5 shadow-md" style={{ animationDelay: '100ms' }}>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">Game code</span>
          <CodeInput value={code} onChange={setCode} autoFocus={!initialCode} />
        </div>
        <label className="flex flex-col gap-2">
          <span className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">
            Your nickname
            <span className="font-normal normal-case tracking-normal">{nickname.length}/20</span>
          </span>
          <input
            placeholder="e.g. Euler_Fan"
            maxLength={20}
            autoComplete="off"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="min-h-14 rounded-2xl border-2 border-hairline bg-paper px-4 text-lg font-semibold text-ink-900 placeholder:font-normal placeholder:text-ink-muted focus:border-orange-500 focus:outline-none"
          />
        </label>
        <div className="flex flex-col gap-3">
          <span className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">
            Pick your character
            <button type="button" onClick={() => setAvatarId(randomAvatarId())} className="flex items-center gap-1 rounded-full bg-orange-500/12 px-3 py-1 text-xs font-bold normal-case tracking-normal text-orange-500">
              <span className="material-symbols-outlined text-base" aria-hidden="true">casino</span>
              Surprise me
            </button>
          </span>
          <div className="flex items-center gap-4 rounded-2xl bg-paper p-3">
            <span className="h-24 w-24 shrink-0"><Character id={avatarId} mood="wave" /></span>
            <span className="min-w-0">
              <span className="block text-xs text-ink-muted">You will be</span>
              <span className="block truncate text-xl font-bold">{avatarInfo(avatarId).name}</span>
            </span>
          </div>
          <div className="grid max-h-56 grid-cols-5 gap-2 overflow-y-auto rounded-2xl border border-hairline p-2" role="group" aria-label="Characters">
            {Array.from({ length: AVATAR_COUNT }, (_, id) => (
              <button
                key={id}
                type="button"
                aria-label={avatarInfo(id).name}
                aria-pressed={avatarId === id}
                onClick={() => setAvatarId(id)}
                className={[
                  'aspect-square rounded-xl border-2 p-1 transition-transform active:scale-95',
                  avatarId === id ? 'border-orange-500 bg-orange-500/12' : 'border-transparent bg-paper',
                ].join(' ')}
              >
                <Character id={id} mood={avatarId === id ? 'happy' : 'static'} />
              </button>
            ))}
          </div>
        </div>
        {error && (
          <p role="alert" className="flex items-center gap-2 rounded-2xl bg-red-600/12 px-4 py-3 text-sm font-semibold text-red-600">
            <span className="material-symbols-outlined" aria-hidden="true">error</span>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || code.length !== 6 || !nickname.trim()}
          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-6 text-xl font-bold text-white shadow-md transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Joining…' : 'Join game'}
          {!busy && <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>}
        </button>
      </form>
    </Phone>
  )
}

// The player's total ticking up by the points they just earned.
function CountingScore({ from, to }) {
  const value = useCountUp(from, to, { durationMs: 900, delayMs: 500 })
  return <span className="tabular-nums">{formatScore(value)}</span>
}

function WaitingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-2 w-2 animate-pulse rounded-full bg-orange-500" style={{ animationDelay: `${i * 200}ms` }} />
      ))}
    </span>
  )
}

function RankMove({ delta }) {
  if (!delta) return null
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-sm font-bold ${delta > 0 ? 'bg-green-600/25 text-green-100' : 'bg-red-900/40 text-red-100'}`}>
      <span className="material-symbols-outlined text-base" aria-hidden="true">{delta > 0 ? 'arrow_upward' : 'arrow_downward'}</span>
      {Math.abs(delta)}
    </span>
  )
}

export default function PlayQuiz() {
  // The look of the game (set by the host in the studio) arrives with the game state, so the screens read it from here.
  const [theme, setTheme] = useState(null)
  return (
    <QuizThemeScope theme={theme}>
      <PlayQuizGame onTheme={setTheme} />
    </QuizThemeScope>
  )
}

function PlayQuizGame({ onTheme }) {
  const theme = useQuizTheme()
  const [saved, setSaved] = useState(loadSaved)
  const [game, setGame] = useState(null)
  const [offset, setOffset] = useState(0) // server clock minus this phone's clock
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [picked, setPicked] = useState(null) // index tapped on this question, so the button reacts at once
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const rankStart = useRef({ key: '', rank: null }) // rank when the current question began, to show up/down moves

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

  const gameTheme = game?.theme ?? null
  const gameThemeKey = JSON.stringify(gameTheme)
  useEffect(() => {
    onTheme(gameTheme)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameThemeKey, onTheme])

  const state = game?.session.state
  const lobbyFull = state === 'lobby' && Boolean(game?.session.fullAt)
  useEffect(() => {
    if (state !== 'question' && !lobbyFull) return undefined
    const timer = setInterval(() => setNowMs(Date.now()), 250)
    return () => clearInterval(timer)
  }, [state, lobbyFull])

  // A new question clears the local tap and remembers the rank we started it with.
  const questionKey = game ? `${game.session.state}:${game.session.index}` : ''
  useEffect(() => {
    setPicked(null)
    setMessage('')
  }, [questionKey])
  useEffect(() => {
    if (!game || game.session.state !== 'question') return
    const key = String(game.session.index)
    if (rankStart.current.key !== key) rankStart.current = { key, rank: game.me.rank }
  }, [game])

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

  if (!token) return <JoinForm onJoined={handleJoined} />
  if (!game) {
    return (
      <Phone>
        <p className="mt-24 text-center text-xl text-ink-muted">{message || 'Joining…'}</p>
      </Phone>
    )
  }

  const { session, me, question, reveal, top } = game
  const rankDelta = rankStart.current.rank && me.rank ? rankStart.current.rank - me.rank : 0

  if (session.state === 'lobby') {
    return (
      <Phone me={me}>
        <div className="mt-6 flex flex-col items-center gap-4 text-center">
          <div className="qz-pop relative">
            <Avatar name={me.nickname} avatarId={me.avatarId} mood="wave" className="h-36 w-36" />
            <span className="qz-pop absolute -right-1 bottom-2 flex h-11 w-11 items-center justify-center rounded-full border-4 border-paper bg-green-600 text-white shadow-md" aria-hidden="true">
              <span className="material-symbols-outlined text-2xl">check</span>
            </span>
          </div>
          <div className="qz-rise" style={{ animationDelay: '120ms' }}>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-orange-500">You&apos;re in</p>
            <h1 className="text-4xl font-bold">{me.nickname}</h1>
            {theme.headline && <p className="mt-2 text-lg font-semibold text-ink-muted">{theme.headline}</p>}
          </div>
        </div>
        <div className="qz-rise rounded-3xl border border-hairline bg-surface p-5 text-center shadow-md" style={{ animationDelay: '220ms' }}>
          <p className="text-xl font-bold">Look for your name on the big screen</p>
          <p className="mt-1 text-ink-muted">
            {game.playerCount}
            {session.maxPlayers ? ` of ${session.maxPlayers}` : ''} player{game.playerCount === 1 ? '' : 's'} in the lobby
          </p>
          {session.fullAt ? (
            <div role="status" className="qz-pop mt-4 flex items-center justify-center gap-3 rounded-2xl border-2 border-orange-500 bg-orange-500/12 p-3 text-ink-900">
              <CountdownRing
                seconds={autoSecondsLeft({ enteredMs: new Date(session.fullAt).getTime(), nowMs: nowMs + offset, totalMs: FULL_LOBBY_COUNTDOWN_MS })}
                total={FULL_LOBBY_COUNTDOWN_MS / 1000}
                size={56}
                stroke={6}
              />
              <span className="text-left">
                <span className="block text-lg font-bold">Lobby full!</span>
                <span className="block text-sm text-ink-muted">The game is about to start</span>
              </span>
            </div>
          ) : (
            <p className="mt-4 flex items-center justify-center gap-3 text-sm text-ink-muted">
              Waiting for the host to start <WaitingDots />
            </p>
          )}
        </div>
        <div className="qz-rise flex items-start gap-3 rounded-2xl bg-orange-500/12 p-4 text-sm" style={{ animationDelay: '320ms' }}>
          <span className="material-symbols-outlined text-orange-500" aria-hidden="true">bolt</span>
          <p><span className="font-bold">Speed counts.</span> The faster you answer correctly, the more points you earn.</p>
        </div>
      </Phone>
    )
  }

  if (session.state === 'question' && question) {
    const startedAtMs = new Date(session.startedAt).getTime()
    const remaining = secondsRemaining({ startedAtMs, timeLimitSeconds: question.timeLimitSeconds, nowMs: nowMs + offset })
    const chosen = picked ?? question.chosenIndex
    if (question.answered || picked !== null) {
      return (
        <Phone me={me}>
          <div className="mt-4 flex flex-col items-center gap-5 text-center">
            <div className="qz-pop flex h-20 w-20 items-center justify-center rounded-full bg-green-600 text-white shadow-lg">
              <span className="material-symbols-outlined text-5xl" aria-hidden="true">lock</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold">Answer locked in</h1>
              <p className="mt-1 flex items-center justify-center gap-3 text-ink-muted">Waiting for the others <WaitingDots /></p>
            </div>
            <CountdownRing seconds={remaining} total={question.timeLimitSeconds} size={120} />
            {chosen !== null && chosen !== undefined && question.options[chosen] !== undefined && (
              <div className="flex w-full items-center gap-4 rounded-3xl border border-hairline bg-surface p-4 text-left shadow-md">
                <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${OPTION_STYLES[chosen].bg}`}>
                  <AnswerShape index={chosen} className="h-8 w-8" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">Your answer</span>
                  <span className="block truncate text-xl font-bold">{question.options[chosen]}</span>
                </span>
              </div>
            )}
          </div>
        </Phone>
      )
    }
    const twoOptions = question.options.length === 2
    return (
      <div className="relative flex min-h-[100dvh] flex-col bg-paper text-ink-900">
        <QuizTopBar compact>
          <span className="rounded-full bg-orange-500 px-4 py-2 text-sm font-bold text-white">Q{session.index + 1} of {session.questionCount}</span>
          <CountdownRing seconds={remaining} total={question.timeLimitSeconds} size={52} stroke={6} />
        </QuizTopBar>
        <p className="mx-auto w-full max-w-md px-4 pt-3 text-center text-lg font-bold leading-snug">{question.text}</p>
        <div className={`mx-auto grid w-full max-w-md flex-1 auto-rows-fr gap-3 p-4 ${twoOptions ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {question.options.map((option, i) => (
            <button
              key={i}
              type="button"
              disabled={sending || remaining === 0}
              onClick={() => answer(i)}
              className={`flex min-h-[140px] flex-col justify-between rounded-3xl p-4 text-left text-white shadow-lg transition-transform active:scale-[0.97] disabled:opacity-60 ${OPTION_STYLES[i].bg}`}
            >
              <AnswerShape index={i} className="h-11 w-11" />
              <span className="break-words text-xl font-bold leading-tight">{option}</span>
            </button>
          ))}
        </div>
        {message && <p role="alert" className="pb-4 text-center text-sm text-ink-muted">{message}</p>}
      </div>
    )
  }

  if (session.state === 'reveal' && reveal) {
    const answered = reveal.chosenIndex !== null
    const correct = answered && reveal.chosenIndex === reveal.correctIndex
    return (
      <ResultScreen tone={correct ? 'good' : answered ? 'bad' : 'neutral'}>
        <div className="qz-pop h-40 w-40 rounded-full bg-white/20 p-3">
          <Character id={me.avatarId} mood={correct ? 'dance' : 'sad'} />
        </div>
        <h1 className="qz-rise text-5xl font-bold text-white">{correct ? 'Correct!' : answered ? 'Not quite' : "Time's up"}</h1>
        {correct && <p className="qz-pop rounded-full bg-white px-6 py-2 text-4xl font-bold text-green-700">+{formatScore(reveal.pointsAwarded)}</p>}
        {!correct && question && (
          <div className="w-full rounded-2xl bg-white/15 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/80">The answer was</p>
            <p className="mt-1 text-2xl font-bold">{question.options[reveal.correctIndex]}</p>
          </div>
        )}
        <div className="flex items-center gap-3 rounded-full bg-black/20 px-5 py-2 text-lg font-semibold">
          {me.rank && <span>#{me.rank}</span>}
          <span><CountingScore from={me.score - reveal.pointsAwarded} to={me.score} /> pts</span>
          <RankMove delta={rankDelta} />
        </div>
      </ResultScreen>
    )
  }

  if (session.state === 'leaderboard') {
    return (
      <Phone me={me}>
        <section className="qz-pop rounded-3xl qz-deep p-6 text-center text-white shadow-xl">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-orange-100/80">Your position</p>
          <p className="mt-1 text-7xl font-bold">{me.rank ? `#${me.rank}` : '—'}</p>
          <div className="mt-2 flex items-center justify-center gap-3 text-xl font-semibold">
            <span>{formatScore(me.score)} pts</span>
            <RankMove delta={rankDelta} />
          </div>
        </section>
        <ol className="flex flex-col gap-2">
          {(top ?? []).slice(0, 5).map((p, i) => {
            const mine = p.nickname === me.nickname
            return (
              <li
                key={p.id}
                className={[
                  'qz-rise flex items-center gap-3 rounded-2xl border p-3',
                  mine ? 'border-orange-500 bg-orange-500/12' : 'border-hairline bg-surface',
                ].join(' ')}
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <span className="w-8 text-center text-xl font-bold">{MEDALS[p.rank - 1] ?? p.rank}</span>
                <Avatar name={p.nickname} avatarId={p.avatar_id} className="h-11 w-11" />
                <span className="min-w-0 flex-1 truncate text-lg font-semibold">{p.nickname}{mine ? ' (you)' : ''}</span>
                <span className="text-lg font-bold tabular-nums">{formatScore(p.total_score)}</span>
              </li>
            )
          })}
        </ol>
        <p className="flex items-center justify-center gap-3 text-sm text-ink-muted">Next question coming up <WaitingDots /></p>
      </Phone>
    )
  }

  if (session.state === 'finished') {
    const podium = me.rank && me.rank <= 3
    return (
      <Phone me={me}>
        {podium && <Confetti count={30} />}
        <section className="qz-pop mt-2 rounded-3xl qz-deep p-8 text-center text-white shadow-xl">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-orange-100/80">{podium ? 'You made the podium!' : 'Final result'}</p>
          <Avatar name={me.nickname} avatarId={me.avatarId} mood={podium ? 'dance' : 'happy'} className="mx-auto mt-2 h-32 w-32" />
          <p className="mt-2 text-6xl font-bold">{me.rank ? (MEDALS[me.rank - 1] ?? `#${me.rank}`) : '—'}</p>
          {me.rank && me.rank > 3 && <p className="text-3xl font-bold">You finished #{me.rank}</p>}
          <p className="mt-2 text-2xl font-semibold">{formatScore(me.score)} points</p>
        </section>
        <ol className="flex flex-col gap-2">
          {(top ?? []).slice(0, 3).map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-hairline bg-surface p-3">
              <span className="w-8 text-center text-xl font-bold">{MEDALS[p.rank - 1] ?? p.rank}</span>
              <Avatar name={p.nickname} avatarId={p.avatar_id} className="h-11 w-11" />
              <span className="min-w-0 flex-1 truncate text-lg font-semibold">{p.nickname}</span>
              <span className="text-lg font-bold tabular-nums">{formatScore(p.total_score)}</span>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={leave}
          className="mt-2 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-6 text-xl font-bold text-white shadow-md active:scale-[0.98]"
        >
          <span className="material-symbols-outlined" aria-hidden="true">replay</span>
          Play again
        </button>
      </Phone>
    )
  }

  return (
    <Phone me={me}>
      <p className="mt-24 flex items-center justify-center gap-3 text-xl text-ink-muted">Waiting for the host <WaitingDots /></p>
    </Phone>
  )
}
