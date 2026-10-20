import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { callQuiz, OPTION_STYLES, secondsRemaining, elapsedAtPauseMs, formatScore, autoSecondsLeft, FULL_LOBBY_COUNTDOWN_MS, useCastQuery } from '../data/quiz'
import { AnswerShape, Avatar, BrandMark, CountdownRing, Confetti, QuizBackdrop, QuizTopBar } from '../components/quiz/QuizParts'
import { BracketCard } from '../components/quiz/BracketParts'
import QuizThemeToggle from '../components/quiz/QuizThemeToggle'
import { QuizThemeScope, useQuizTheme } from '../components/quiz/QuizTheme'
import Character from '../components/quiz/Character'
import { CharacterCastContext } from '../components/quiz/characterCastContext.js'
import CharacterPicker from '../components/quiz/CharacterPicker'
import { randomCastId } from '../components/quiz/characterPickerUtils.js'
import { useCountUp } from '../lib/useCountUp'
import { quizSound, buzz } from '../lib/quizSound'
import { isChoiceType } from '../../api/_lib/quizGrading.js'
import { OrderPicker } from '../components/quiz/OrderPicker'
import { DiagramTap } from '../components/quiz/DiagramTap'
import { teamStyle } from '../data/quizTeams'
import { storeKey, readStore, writeStore, forgetSession, forgetSeat, finishSeat, rememberNickname, knownNicknames, rememberedSeats, stampSeat } from '../lib/quizPlayerStorage'
import { useLowData, setLowData, playerPollMs } from '../data/lowData'
import MathText from '../components/quiz/MathText'
import ResultCardModal from '../components/quiz/ResultCardModal'
import { personalCardUrl, cardFilename } from '../lib/quizCard'
import { castIds, characterSpec } from '../../api/_lib/quizCharacterArt.js'

// A player's phone. No account: the player joins with a code and nickname and keeps a secret token in this
// browser tab. The token is sent with every call, and the server decides what this phone is allowed to see
// (the correct answer only arrives once the host reveals it). Spec: docs/superpowers/specs/2026-09-30-live-quiz-design.md

const BACKOFF_MAX_MS = 30000
const MEDALS = ['🥇', '🥈', '🥉']

// Standard phone screen: slim bar (with the player's name and score once they are in) and a centred column.
function Phone({ me, cast, children }) {
  const low = useLowData()
  return (
    <CharacterCastContext.Provider value={cast}>
      {/* Low data makes the backdrop a flat surface: it is what puts quizCharacterArt's SVG strings and the motion
          layers on the critical path, and it is decoration. That is most of why the setting exists. */}
      <div className="relative isolate flex min-h-[100dvh] flex-col bg-paper text-ink-900">
        {low ? null : <QuizBackdrop />}
        <QuizTopBar compact>
          <LowDataToggle />
          {me && (
            <span className="flex items-center gap-2 rounded-full border border-hairline bg-surface py-1 pl-1 pr-3 text-sm font-bold">
              <Avatar name={me.nickname} avatarId={me.avatarId} className="h-8 w-8" />
              <span className="max-w-[7rem] truncate">{me.nickname}</span>
              <span className="text-orange-500">{formatScore(me.score)}</span>
              {me.streak >= 2 && <span aria-label={`${me.streak} in a row`} title={`${me.streak} in a row`}>🔥{me.streak}</span>}
            </span>
          )}
        </QuizTopBar>
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-5">{children}</main>
      </div>
    </CharacterCastContext.Provider>
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

function JoinForm({ onJoined, notice }) {
  const [params] = useSearchParams()
  const initialCode = (params.get('code') ?? '').replace(/\D/g, '').slice(0, 6)
  const [code, setCode] = useState(initialCode)
  // Prefilled from the nickname index, and never from a guess: the stored token is what turns this from "pick another
  // nickname" into a resume, and it is sent below. A name on its own gets the student nothing but a convenience.
  const [nickname, setNickname] = useState(() => knownNicknames()[0] ?? '')
  const [avatarId, setAvatarId] = useState(() => randomCastId(undefined))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [teams, setTeams] = useState(null) // the teams to choose from, once the game says it is a team game
  const castQuery = useCastQuery({ code: code.length === 6 ? code : null })
  const cast = castQuery.data
  // Filled after the server answers which of the remembered rooms are still open. A record on this device has no idea
  // that its game ended, so it cannot be trusted to be offered: `quiz-join` refuses a finished session, and a cleaned-up
  // one is gone. Rendering the list from storage first is how three finished games sat above the code box until they
  // aged out a day later. Stays empty when there is nothing stored, which is the common case.
  const [seats, setSeats] = useState([])

  useEffect(() => {
    const remembered = rememberedSeats()
    if (!remembered.length) return undefined
    let cancelled = false
    // One read for every room, against a table that is public for exactly this kind of pre-join question. The rule is
    // the one `quiz-join` applies: a session that is not `finished` still has a door. A seat it does not answer for is
    // dropped from storage as well, so the list heals itself instead of waiting for a tap that can only 404.
    supabase
      .from('quiz_sessions')
      .select('join_code, state')
      .in('join_code', remembered.map((seat) => seat.code))
      .then(({ data, error }) => {
        if (cancelled) return
        // A failed check is not evidence of a dead room. Offline still offers the list; tapping one settles it.
        if (error) {
          setSeats(remembered)
          return
        }
        const open = new Set((data ?? []).filter((row) => row.state !== 'finished').map((row) => row.join_code))
        for (const seat of remembered) if (!open.has(seat.code)) forgetSeat(seat.code)
        setSeats(remembered.filter((seat) => open.has(seat.code)))
      })
      .catch(() => {
        if (!cancelled) setSeats(remembered)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (cast && !castIds(cast).includes(avatarId)) setAvatarId(randomCastId(cast))
  }, [cast, avatarId])

  async function attempt(teamId) {
    setBusy(true)
    setError('')
    try {
      // The stored token belongs to this room only. Without it a returning player is an ordinary new join and gets a
      // 409 from the nickname index -- so it is the difference between a seat and an apology.
      const saved = readStore(storeKey(code))
      const joined = await callQuiz('join', { code, nickname, avatarId, token: saved?.token, ...(teamId ? { teamId } : {}) })
      onJoined({ ...joined, code })
    } catch (e) {
      if (e.data?.needsTeam) setTeams(e.data.teams)
      else {
        // A 404 means the room is gone -- finished, or cleaned up. The seat for it is dead weight, so it is dropped and
        // the list on this screen updates: a dead room offered as "back into game" is a button that cannot work, and a
        // list of those teaches a student to ignore the one thing meant to help them.
        if (e.status === 404) {
          forgetSeat(code)
          setSeats((list) => list.filter((seat) => seat.code !== code))
        }
        setError(e.message)
      }
      setBusy(false)
    }
  }

  function submit(event) {
    event.preventDefault()
    attempt(null)
  }

  return (
    <Phone cast={cast}>
      <div className="qz-rise flex flex-col items-center gap-2 pt-4 text-center">
        <BrandMark className="h-16 w-16" />
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-orange-500">Campus challenge</p>
        <h1 className="text-4xl font-bold">Join a game</h1>
        <p className="text-ink-muted">Enter the code on the big screen to get in.</p>
        <Link to="/battle" className="text-sm font-semibold text-orange-500">Want to challenge a friend instead? Battle mode</Link>
      </div>

      {/* Offered only when the device already holds a seat, and only as a shortcut: the token is still what resumes,
          and the server verifies it. Without this a phone that refreshed on a bare /play was left holding a seat it had
          no way back to, and had to be told the code it had just been in. Every entry here was checked against its
          session a moment ago, so a game that has finished is not on the list. */}
      {seats.length > 0 && code.length !== 6 && (
        <div className="qz-rise flex flex-col gap-2" style={{ animationDelay: '50ms' }}>
          {seats.slice(0, 3).map((seat) => (
            <button
              key={seat.code}
              type="button"
              onClick={() => setCode(seat.code)}
              className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-orange-500 bg-orange-500/10 px-4 text-left font-semibold text-ink-900"
            >
              <span>
                <span className="block text-lg">{seat.nickname || 'Your seat'}</span>
                <span className="block text-xs font-normal text-ink-muted">Back into game {seat.code}</span>
              </span>
              <span className="material-symbols-outlined text-orange-500" aria-hidden="true">login</span>
            </button>
          ))}
          <p className="text-center text-xs text-ink-muted">Already in a game? Tap to fill its code.</p>
          {/* History is the one thing a finished seat is good for, and it is not offered above. It sits inside the
              seat block, so it never pushes the code box further down than the chips already did. */}
          <Link to="/play/history" className="text-center text-xs font-semibold text-orange-500">
            See your past results
          </Link>
        </div>
      )}

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
              <button type="button" onClick={() => setAvatarId(randomCastId(cast))} className="flex items-center gap-1 rounded-full bg-orange-500/12 px-3 py-1 text-xs font-bold normal-case tracking-normal text-orange-500">
              <span className="material-symbols-outlined text-base" aria-hidden="true">casino</span>
              Surprise me
            </button>
          </span>
          <div className="flex items-center gap-4 rounded-2xl bg-paper p-3">
            <span className="h-24 w-24 shrink-0"><Character spec={characterSpec(avatarId, cast)} mood="wave" /></span>
            <span className="min-w-0">
              <span className="block text-xs text-ink-muted">You will be</span>
              <span className="block truncate text-xl font-bold">{characterSpec(avatarId, cast).name}</span>
            </span>
          </div>
          <CharacterPicker cast={cast} value={avatarId} onChange={setAvatarId} />
        </div>
        {teams && (
          <div className="flex flex-col gap-3" role="group" aria-label="Pick your team">
            <span className="text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">Pick your team</span>
            <div className="grid grid-cols-2 gap-2">
              {teams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={busy}
                  onClick={() => attempt(t.id)}
                  className={`flex min-h-16 flex-col items-start justify-center rounded-2xl px-4 py-2 text-left text-white shadow-md active:scale-[0.97] disabled:opacity-60 ${teamStyle(t.color).bg}`}
                >
                  <span className="text-lg font-bold">{t.name}</span>
                  <span className="text-xs opacity-90">{t.members} player{t.members === 1 ? '' : 's'}</span>
                </button>
              ))}
            </div>
            <button type="button" disabled={busy} onClick={() => attempt('auto')} className="min-h-12 rounded-2xl border-2 border-hairline font-semibold text-ink-900 disabled:opacity-60">
              Put me anywhere
            </button>
          </div>
        )}
        {notice && !error && (
          <p role="status" className="flex items-center gap-2 rounded-2xl bg-orange-500/12 px-4 py-3 text-sm font-semibold text-ink-900">
            <span className="material-symbols-outlined text-orange-500" aria-hidden="true">info</span>
            {notice}
          </p>
        )}
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
          {busy ? 'Joining…' : teams ? 'Join with another team' : 'Join game'}
          {!busy && <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>}
        </button>
        {/* The one door to /play/low. It was a working route with no door leading to it, so the students who most need
            it -- the ones on a weak connection who just sat through 263 KB of backdrop -- had no way to find it. This
            is below the fold on purpose: it is for someone already struggling, not an advert for everyone. */}
        <Link
          to={`/play/low${initialCode ? `?code=${initialCode}` : ''}`}
          className="mt-1 flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-hairline px-4 text-center text-sm font-semibold text-ink-muted"
        >
          <span className="material-symbols-outlined" aria-hidden="true">network_cell</span>
          Slow connection? Use the light version
        </Link>
      </form>
    </Phone>
  )
}

// The player's total ticking up by the points they just earned.
function LowDataToggle() {
  const low = useLowData()
  return (
    <button
      type="button"
      onClick={() => setLowData(!low)}
      className={`rounded-full border px-3 py-1 text-xs font-bold ${low ? 'border-orange-500 bg-orange-500/15 text-orange-500' : 'border-hairline text-ink-muted'}`}
      aria-pressed={low}
      title="Save data: fewer downloads, no backdrop or characters"
    >
      {low ? 'Low data on' : 'Low data'}
    </button>
  )
}

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

// Team standings on a phone: one row per team, the player's own team highlighted.
function TeamList({ teams, myTeamId, scoring }) {
  // HostQuiz threads `scoring` through to the host's own leaderboard; the phone's copy was given the same prop and
  // never destructured it, so a game set to average scoring showed a bare number with nothing saying what it meant.
  const averaged = scoring === 'average'
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
        {averaged ? 'Average score per player' : 'Total team score'}
      </p>
      <ol className="flex flex-col gap-2" aria-label={averaged ? 'Team standings by average score' : 'Team standings by total score'}>
        {teams.map((t) => (
          <li key={t.id} className={`flex items-center gap-3 rounded-2xl border p-3 ${t.id === myTeamId ? 'border-orange-500 bg-orange-500/12' : 'border-hairline bg-surface'}`}>
            <span className="w-8 text-center text-xl font-bold">{MEDALS[t.rank - 1] ?? t.rank}</span>
            <span className={`h-8 w-2 rounded-full ${teamStyle(t.color).bg}`} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-lg font-semibold">{t.name}{t.id === myTeamId ? ' (you)' : ''}</span>
            <span className="text-lg font-bold tabular-nums">{formatScore(t.score)}</span>
          </li>
        ))}
      </ol>
    </div>
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

// Keyed by the join code, because that is the one identifier the URL carries: the browser cannot know the session id
// until it has already joined, which is exactly too late to look the token up.
function PlayQuizGame({ onTheme }) {
  const theme = useQuizTheme()
  const [code] = useState(() => new URLSearchParams(window.location.search).get('code') ?? '')
  const [saved, setSaved] = useState(() => (code ? readStore(storeKey(code)) : null))
  const castQuery = useCastQuery({ code: saved?.code ?? code ?? null })
  const cast = castQuery.data
  const [game, setGame] = useState(null)
  const [offset, setOffset] = useState(0) // server clock minus this phone's clock
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [picked, setPicked] = useState(null) // what this phone just sent for this question ({ index } or { text }), so the screen reacts at once
  const [typed, setTyped] = useState('')
  // Drafts rather than answers: an ordering question and a diagram tap are both "pick" interactions, and `answer` only
  // fires on the button, so the student's half-finished state has to survive a re-render.
  const [orderDraft, setOrderDraft] = useState([])
  const [diagramDraft, setDiagramDraft] = useState(null)
  const [notice, setNotice] = useState('')
  const [zoomed, setZoomed] = useState(false)
  const inGame = useRef(false)
  const soundPrefs = useSyncExternalStore(quizSound.subscribe, quizSound.getSnapshot)
  const effectsOn = theme.sound.effects && soundPrefs.unlocked && !soundPrefs.muted

  // Phones keep their own built-in sounds: they honour what the admin has switched off, but an imported clip stays on
  // the device it was imported on, so the custom ids and the music choice are deliberately not passed on.
  useEffect(() => {
    quizSound.setSoundConfig({ effects: theme.sound.effects, off: theme.sound.off })
  }, [theme.sound.effects, theme.sound.off])
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [cardOpen, setCardOpen] = useState(false)
  const rankStart = useRef({ key: '', rank: null }) // rank when the current question began, to show up/down moves
  const finishedSeat = useRef('') // the code already flagged as over, so a poll on the final screen writes storage once
  const failures = useRef(0) // consecutive failed polls, for the backoff

  const token = saved?.token
  const sessionId = saved?.sessionId
  const low = useLowData()
  const pollMs = playerPollMs(low)

  // Returns whether the phone is still in the game, so the poll loop can back off. A 401/404 is not a connection
  // problem: the phone is out, and the caller stops asking.
  const refresh = useCallback(async () => {
    if (!token) return false
    try {
      // `low` is the one thing the server can act on: it drops the explanation and an unused picture from the payload
      // rather than leaving the client to discard bytes it has already paid for.
      const data = await callQuiz('state', { token, ...(low ? { low: 1 } : {}) })
      setOffset(data.serverNow - Date.now())
      setGame(data)
      // The game is over as far as other people are concerned: its seat can never be joined again, so the join form must
      // stop advertising it. Flagging rather than forgetting keeps the token, which is what repaints this final screen
      // (and its result card) if the phone reloads.
      const seatCode = saved?.code ?? code
      if (data.session.state === 'finished' && seatCode && finishedSeat.current !== seatCode) {
        finishedSeat.current = seatCode
        finishSeat(seatCode)
      }
      inGame.current = true
      failures.current = 0
      setMessage('')
      return true
    } catch (e) {
      if (e.status === 401 || e.status === 404) {
        // A 401 for a phone that was in the game means the host removed it.
        if (inGame.current && e.status === 401) setNotice('You were removed from this game. You can join again with the code if the host lets you.')
        inGame.current = false
        // The seat is gone for good (kicked, or the game finished and cleaned up), so this phone's token is dead
        // weight. Dropping it here is the whole of the client-side pruning the spec asks for.
        forgetSession(saved?.code ?? code)
        setSaved(null)
        setGame(null)
        return false
      }
      failures.current += 1
      setMessage('Connection problem. Trying again…')
      return false
    }
  }, [token, saved?.code, code, low])

  useEffect(() => {
    if (!token) return undefined
    let stopped = false
    let timer = null

    const tick = async () => {
      if (stopped) return
      const alive = await refresh()
      if (stopped) return
      const delay = alive ? pollMs : Math.min(pollMs * 2 ** Math.max(0, failures.current - 1), BACKOFF_MAX_MS)
      timer = setTimeout(tick, delay)
    }

    // Coming back online cancels the wait instead of sitting it out. That is worth more than the backoff itself: a
    // student whose signal has just returned should not spend the rest of a penalty levied for a problem that has
    // already gone away, which is exactly what a flat retry timer makes them do.
    const back = () => {
      clearTimeout(timer)
      failures.current = 0
      tick()
    }

    failures.current = 0
    tick()
    window.addEventListener('online', back)
    return () => {
      stopped = true
      clearTimeout(timer)
      window.removeEventListener('online', back)
    }
  }, [token, refresh, pollMs])

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
    setTyped('')
    setZoomed(false)
    setMessage('')
  }, [questionKey])
  // Right or wrong: a short sound and buzz when the result arrives (only if this player switched sound on).
  useEffect(() => {
    if (!effectsOn || !game || game.session.state !== 'reveal' || !game.reveal || game.question?.type === 'poll') return
    if (game.reveal.correct === true) {
      quizSound.play('correct')
      buzz(80)
    } else if (game.reveal.chosenIndex !== null || game.reveal.answerText !== null) {
      quizSound.play('wrong')
      buzz([120, 60, 120])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionKey])
  useEffect(() => {
    if (!game || game.session.state !== 'question') return
    const key = String(game.session.index)
    if (rankStart.current.key !== key) rankStart.current = { key, rank: game.me.rank }
  }, [game])

  function handleJoined(joined) {
    const next = {
      token: joined.token,
      sessionId: joined.sessionId,
      code: joined.code ?? code,
      nickname: joined.nickname,
      // A resume hands these back so a returning phone can show its standing on the very first paint rather than
      // sitting at zero until the next poll lands. A fresh join has neither, and the state call fills them in.
      ...(joined.score !== undefined ? { score: joined.score } : {}),
      ...(joined.streak !== undefined ? { streak: joined.streak } : {}),
      ...(joined.resumed ? { resumed: true } : {}),
    }
    writeStore(storeKey(next.code), stampSeat(next))
    rememberNickname(joined.nickname)
    // Put the code in the address bar. The seat is stored under the code and the code is the only thing this page can
    // read it back with, so a phone that joined by typing the code -- which is what the host's own instructions tell
    // students to do -- held a seat it could not find again. Refreshing dropped the player onto the join form with
    // their token still saved, looking like a lost game. A browser's back button must not walk into the lobby either,
    // so this replaces rather than pushes.
    if (next.code && new URLSearchParams(window.location.search).get('code') !== next.code) {
      window.history.replaceState(null, '', `/play?code=${encodeURIComponent(next.code)}`)
    }
    setNotice('')
    setSaved(next)
  }

  // Play again is only reachable from the finished screen, and a finished game cannot be re-entered: `quiz-join`
  // refuses it until the row is cleaned up. So the seat goes with the button, rather than being left on the join form
  // as "back into game" where it could only answer "No game found with that code". The code goes out of the address bar
  // for the same reason -- it was put there to be reloaded into a game that no longer accepts players.
  function leave() {
    forgetSeat(saved?.code ?? code)
    if (new URLSearchParams(window.location.search).get('code')) window.history.replaceState(null, '', '/play')
    setSaved(null)
    setGame(null)
  }

  // Sends an answer: { chosenIndex } for tiles, { answerText } for typed questions.
  async function answer(payload, local) {
    if (sending || picked !== null) return
    setPicked(local)
    if (effectsOn) quizSound.play('lock')
    setSending(true)
    try {
      await callQuiz('answer', { token, ...payload })
    } catch (e) {
      // "already answered" or "time is up": the next refresh shows the truth, so just clear the local tap
      setPicked(null)
      setMessage(e.message)
    } finally {
      setSending(false)
      refresh()
    }
  }

  async function spendPowerup(kind) {
    if (sending) return
    setSending(true)
    try {
      await callQuiz('powerup', { token, kind })
    } catch (e) {
      setMessage(e.message)
    } finally {
      setSending(false)
      refresh()
    }
  }

  if (!token) return <JoinForm onJoined={handleJoined} notice={notice} />
  if (!game) {
    return (
      <Phone cast={cast}>
        <p className="mt-24 text-center text-xl text-ink-muted">{message || 'Joining…'}</p>
      </Phone>
    )
  }

  const { session, me, question, reveal, top } = game
  const rankDelta = rankStart.current.rank && me.rank ? rankStart.current.rank - me.rank : 0

  if (session.state === 'lobby') {
    return (
      <Phone me={me} cast={cast}>
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
            {me.team && (
              <p className={`mt-2 inline-block rounded-full px-4 py-1 text-sm font-bold text-white ${teamStyle(me.team.color).bg}`}>Team {me.team.name}</p>
            )}
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
        {quizSound.isSupported() && theme.sound.effects && (
          <button
            type="button"
            onClick={() => {
              if (!soundPrefs.unlocked) {
                quizSound.unlock()
                quizSound.setMuted(false)
                quizSound.play('lock')
              } else quizSound.setMuted(!soundPrefs.muted)
            }}
            aria-pressed={effectsOn}
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-hairline bg-surface px-4 font-semibold"
          >
            <span className="material-symbols-outlined" aria-hidden="true">{effectsOn ? 'volume_up' : 'volume_off'}</span>
            {effectsOn ? 'Sound effects on' : 'Turn on sound effects'}
          </button>
        )}
        <div className="qz-rise flex items-start gap-3 rounded-2xl bg-orange-500/12 p-4 text-sm" style={{ animationDelay: '320ms' }}>
          <span className="material-symbols-outlined text-orange-500" aria-hidden="true">bolt</span>
          <p><span className="font-bold">Speed counts.</span> The faster you answer correctly, the more points you earn.</p>
        </div>
      </Phone>
    )
  }

  if (session.state === 'question' && question) {
    const startedAtMs = new Date(session.startedAt).getTime()
    const remaining = secondsRemaining({
      startedAtMs,
      timeLimitSeconds: question.timeLimitSeconds,
      nowMs: nowMs + offset,
      bonusMs: session.timeBonusMs,
      pausedMs: session.pausedTotalMs,
      frozenElapsedMs: session.paused
        ? elapsedAtPauseMs({ question_started_at: session.startedAt, paused_at: session.pausedAt, paused_total_ms: session.pausedTotalMs })
        : null,
    })
    const ringTotal = question.timeLimitSeconds + session.timeBonusMs / 1000
    const type = question.type
    const choice = isChoiceType(type)
    const chosen = picked?.index ?? question.chosenIndex
    const typedAnswer = picked?.text ?? question.answerText

    if (question.answered || picked !== null) {
      return (
        <Phone me={me} cast={cast}>
          <div className="mt-4 flex flex-col items-center gap-5 text-center">
            {game.session.bracket && <div className="w-full"><BracketCard bracket={game.session.bracket} compact /></div>}
            <div className="qz-pop flex h-20 w-20 items-center justify-center rounded-full bg-green-600 text-white shadow-lg">
              <span className="material-symbols-outlined text-5xl" aria-hidden="true">lock</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold">{type === 'poll' ? 'Vote counted' : 'Answer locked in'}</h1>
              <p className="mt-1 flex items-center justify-center gap-3 text-ink-muted">Waiting for the others <WaitingDots /></p>
            </div>
            {session.paused ? (
              <p role="status" className="rounded-full bg-orange-500 px-4 py-1.5 font-bold text-white">Paused by the host</p>
            ) : (
              <CountdownRing seconds={remaining} total={ringTotal} size={120} />
            )}
            {choice && chosen !== null && chosen !== undefined && question.options[chosen] !== undefined && (
              <div className="flex w-full items-center gap-4 rounded-3xl border border-hairline bg-surface p-4 text-left shadow-md">
                <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${OPTION_STYLES[chosen].bg}`}>
                  <AnswerShape index={chosen} className="h-8 w-8" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">Your answer</span>
                  <span className="block truncate text-xl font-bold"><MathText>{question.options[chosen]}</MathText></span>
                </span>
              </div>
            )}
            {!choice && typedAnswer && (
              <div className="w-full rounded-3xl border border-hairline bg-surface p-4 text-left shadow-md">
                <span className="block text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">Your answer</span>
                <span className="block break-words text-2xl font-bold">{typedAnswer}</span>
              </div>
            )}
          </div>
        </Phone>
      )
    }

    const twoOptions = question.options.length === 2
    const used = question.powerup
    const canDouble = question.powerupsLeft.includes('double') && type !== 'poll' && question.multiplier !== 2
    const canFifty = question.powerupsLeft.includes('fifty') && type === 'multiple' && question.options.length === 4
    const blocked = sending || remaining === 0 || session.paused
    const isOrder = type === 'order'
    const isDiagram = type === 'diagram'
    // A unit is a hint about the shape of the answer, not a value: it is shown in the placeholder and echoed back on the
    // reveal so the student can see what was asked for.
    const unitHint = type === 'numeric' && question.unit ? ` with ${question.unit}` : ''
    return (
      <div className="relative isolate flex min-h-[100dvh] flex-col bg-paper text-ink-900">
        {low ? null : <QuizBackdrop />}
        <QuizTopBar compact>
          <span className="rounded-full bg-orange-500 px-4 py-2 text-sm font-bold text-white">Q{session.index + 1} of {session.questionCount}</span>
          <CountdownRing seconds={remaining} total={ringTotal} size={52} stroke={6} />
        </QuizTopBar>
        {session.paused && (
          <p role="status" className="bg-orange-500 px-4 py-2 text-center text-sm font-bold text-white">Paused by the host. The clock is stopped.</p>
        )}
        {session.bracket && <div className="mx-auto w-full max-w-md px-4 pt-2"><BracketCard bracket={session.bracket} compact /></div>}
        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-2 px-4 pt-3">
          {(question.multiplier === 2 || question.comeback || me.streak >= 2) && (
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-bold">
              {question.multiplier === 2 && <span className="rounded-full bg-orange-500 px-3 py-1 uppercase tracking-[0.1em] text-white">Double points</span>}
              {question.comeback && <span className="rounded-full bg-green-600/20 px-3 py-1 text-green-700">Comeback +15%</span>}
              {me.streak >= 2 && <span className="rounded-full bg-orange-500/15 px-3 py-1 text-orange-500">🔥 {me.streak} in a row</span>}
            </div>
          )}
          {question.imageUrl && (
            <button type="button" onClick={() => setZoomed(true)} className="block max-w-full cursor-zoom-in rounded-2xl bg-white p-1 shadow-sm ring-1 ring-black/10" aria-label="Enlarge the picture">
              <img src={question.imageUrl} alt={question.imageAlt} className="max-h-40 w-auto max-w-full rounded-xl object-contain" />
            </button>
          )}
          <p className="text-center text-lg font-bold leading-snug"><MathText>{question.text}</MathText></p>
        </div>

        {(canDouble || canFifty || used) && (
          <div className="mx-auto mt-3 flex w-full max-w-md flex-wrap items-center justify-center gap-2 px-4">
            {used ? (
              <span className="rounded-full bg-orange-500/15 px-4 py-2 text-sm font-bold text-orange-500">
                {used === 'double' ? 'Double down is on: a right answer earns double' : '50/50 used: two wrong answers removed'}
              </span>
            ) : (
              <>
                {canDouble && (
                  <button type="button" disabled={blocked} onClick={() => spendPowerup('double')} className="flex min-h-11 items-center gap-2 rounded-full border-2 border-orange-500 px-4 text-sm font-bold text-orange-500 disabled:opacity-50">
                    <span aria-hidden="true">✕2</span> Double down
                  </button>
                )}
                {canFifty && (
                  <button type="button" disabled={blocked} onClick={() => spendPowerup('fifty')} className="flex min-h-11 items-center gap-2 rounded-full border-2 border-orange-500 px-4 text-sm font-bold text-orange-500 disabled:opacity-50">
                    <span aria-hidden="true">½</span> 50/50
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {isOrder ? (
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col p-4">
            <OrderPicker
              steps={question.options}
              value={orderDraft}
              onChange={setOrderDraft}
              disabled={blocked}
            />
            <button
              type="button"
              disabled={blocked || orderDraft.length !== question.options.length}
              onClick={() => !blocked && answer({ order: orderDraft }, { order: orderDraft })}
              className="mt-4 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-6 text-xl font-bold text-white shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Lock in order
            </button>
          </div>
        ) : isDiagram ? (
          <div className="mx-auto w-full max-w-md flex-1 p-4">
            <DiagramTap
              src={question.imageUrl}
              alt={question.imageAlt}
              preview={diagramDraft}
              onTap={(tap) => setDiagramDraft(tap)}
              disabled={blocked}
            />
            <button
              type="button"
              disabled={blocked || !diagramDraft}
              onClick={() => !blocked && answer({ tap: diagramDraft }, { tap: diagramDraft })}
              className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-6 text-xl font-bold text-white shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Lock in answer
            </button>
          </div>
        ) : choice ? (
          <div className={`mx-auto grid w-full max-w-md flex-1 auto-rows-fr gap-3 p-4 ${twoOptions ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {question.options.map((option, i) => {
              const hidden = question.hidden.includes(i)
              return (
                <button
                  key={i}
                  type="button"
                  disabled={blocked || hidden}
                  onClick={() => answer({ chosenIndex: i }, { index: i })}
                  className={`flex min-h-[140px] flex-col justify-between rounded-3xl p-4 text-left text-white shadow-lg transition-transform active:scale-[0.97] disabled:opacity-60 ${OPTION_STYLES[i].bg} ${hidden ? '!opacity-15' : ''}`}
                >
                  <AnswerShape index={i} className="h-11 w-11" />
                  <span className="break-words text-xl font-bold leading-tight">{hidden ? '—' : <MathText>{option}</MathText>}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <form
            className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 p-4"
            onSubmit={(e) => {
              e.preventDefault()
              const text = typed.trim()
              if (text && !blocked) answer({ answerText: text }, { text })
            }}
          >
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              maxLength={40}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Your answer"
              placeholder={type === 'numeric' ? `A number${unitHint}, like 3.14 or 1/2` : 'Type your answer'}
              className="min-h-16 rounded-2xl border-2 border-hairline bg-surface px-4 text-2xl font-bold text-ink-900 placeholder:text-base placeholder:font-normal placeholder:text-ink-muted focus:border-orange-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={blocked || !typed.trim()}
              className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-6 text-xl font-bold text-white shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Lock in answer
            </button>
          </form>
        )}
        {message && <p role="alert" className="pb-4 text-center text-sm text-ink-muted">{message}</p>}
        {zoomed && question.imageUrl && (
          <button type="button" onClick={() => setZoomed(false)} aria-label="Close the picture" className="fixed inset-0 z-40 flex cursor-zoom-out items-center justify-center bg-black/80 p-4">
            <img src={question.imageUrl} alt={question.imageAlt} className="max-h-full max-w-full rounded-xl bg-white object-contain" />
          </button>
        )}
      </div>
    )
  }

  if (session.state === 'reveal' && reveal) {
    const poll = question?.type === 'poll'
    const answered = reveal.chosenIndex !== null || reveal.answerText !== null
    const correct = reveal.correct === true
    const tone = poll ? 'neutral' : correct ? 'good' : answered ? 'bad' : 'neutral'
    const answerLabel = reveal.correctText ?? (question && reveal.correctIndex !== null ? question.options[reveal.correctIndex] : null)
    // An ordering answer is the first type that can be partly right, so the headline and the credit are separate: the
    // score line says what was earned, this says how close the ordering was.
    const credit = reveal.credit
    const orderClose = question?.type === 'order' && credit !== null && credit !== undefined
    return (
      <ResultScreen tone={tone}>
        {/* Low-data skips the cast picture here too: it is the largest single SVG on the screen and it redraws on every reveal. */}
        {low ? null : (
          <div className="qz-pop h-40 w-40 rounded-full bg-white/20 p-3">
            <Character id={me.avatarId} mood={poll ? 'wave' : correct ? 'dance' : 'sad'} />
          </div>
        )}
        <h1 className="qz-rise text-5xl font-bold text-white">
          {poll ? (answered ? 'Vote counted' : "Time's up") : correct ? 'Correct!' : answered ? 'Not quite' : "Time's up"}
        </h1>
        {orderClose && !correct && (
      <p className="qz-pop rounded-full bg-white/20 px-5 py-2 text-lg font-bold text-white">
        {Math.round(credit * question.options.length)} of {question.options.length} steps in the right place
      </p>
    )}
    {correct && <p className="qz-pop rounded-full bg-white px-6 py-2 text-4xl font-bold text-green-700">+{formatScore(reveal.pointsAwarded)}</p>}
    {reveal.pointsAwarded > 0 && !correct && (
      <p className="qz-pop rounded-full bg-white/20 px-5 py-2 text-xl font-bold text-white">+{formatScore(reveal.pointsAwarded)}</p>
    )}
        {correct && reveal.bonusPoints > 0 && (
          <p className="-mt-2 text-sm font-semibold text-white/90">
            includes +{formatScore(reveal.bonusPoints)} from streak, power-up or bonus round{me.streak >= 2 ? ` · 🔥 ${me.streak} in a row` : ''}
          </p>
        )}
        {!poll && !correct && answerLabel && (
          <div className="w-full rounded-2xl bg-white/15 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/80">The answer was</p>
            <p className="mt-1 break-words text-2xl font-bold"><MathText>{answerLabel}</MathText></p>
          </div>
        )}
        {/* The phone is the copy a student screenshots into the class group, which is why this is the surface the
            explanation was worth adding for. 500 characters is what keeps it inside a reveal that auto-advances. */}
        {reveal.explanation && (
          <div className="w-full rounded-2xl bg-black/25 p-4 text-left">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/80">Why</p>
            <p className="mt-1 break-words text-lg leading-snug text-white"><MathText>{reveal.explanation}</MathText></p>
          </div>
        )}
        {game.session.bracket && <div className="w-full"><BracketCard bracket={game.session.bracket} /></div>}
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
      <Phone me={me} cast={cast}>
        <section className="qz-pop rounded-3xl qz-deep p-6 text-center text-white shadow-xl">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-orange-100/80">Your position</p>
          <p className="mt-1 text-7xl font-bold">{me.rank ? `#${me.rank}` : '—'}</p>
          <div className="mt-2 flex items-center justify-center gap-3 text-xl font-semibold">
            <span>{formatScore(me.score)} pts</span>
            <RankMove delta={rankDelta} />
          </div>
        </section>
        {game.session.bracket && <BracketCard bracket={game.session.bracket} />}
        {game.teams?.length > 0 && <TeamList teams={game.teams} myTeamId={me.team?.id} scoring={game.session.teamScoring} />}
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
    // The modal sits outside <Phone>, which is a fixed-width phone frame: it has to cover the whole screen.
    return (
      <>
        <Phone me={me} cast={cast}>
        {podium && <Confetti count={30} />}
        <section className="qz-pop mt-2 rounded-3xl qz-deep p-8 text-center text-white shadow-xl">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-orange-100/80">{podium ? 'You made the podium!' : 'Final result'}</p>
          <Avatar name={me.nickname} avatarId={me.avatarId} mood={podium ? 'dance' : 'happy'} className="mx-auto mt-2 h-32 w-32" />
          <p className="mt-2 text-6xl font-bold">{me.rank ? (MEDALS[me.rank - 1] ?? `#${me.rank}`) : '—'}</p>
          {me.rank && me.rank > 3 && <p className="text-3xl font-bold">You finished #{me.rank}</p>}
          <p className="mt-2 text-2xl font-semibold">{formatScore(me.score)} points</p>
        </section>
        {game.session.bracket && <BracketCard bracket={game.session.bracket} />}
        {game.teams?.length > 0 && <TeamList teams={game.teams} myTeamId={me.team?.id} scoring={game.session.teamScoring} />}
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
          onClick={() => setCardOpen(true)}
          className="mt-2 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-green-900 px-6 text-xl font-bold text-white shadow-md active:scale-[0.98]"
        >
          <span className="material-symbols-outlined" aria-hidden="true">share</span>
          Share my result
        </button>
        <Link
          to="/play/history"
          className="mt-2 flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-hairline bg-surface px-6 text-lg font-bold text-ink-900 shadow-sm active:scale-[0.98]"
        >
          <span className="material-symbols-outlined" aria-hidden="true">task_alt</span>
          My past results
        </Link>
        <button
          type="button"
          onClick={leave}
          className="mt-2 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-6 text-xl font-bold text-white shadow-md active:scale-[0.98]"
        >
          <span className="material-symbols-outlined" aria-hidden="true">replay</span>
          Play again
        </button>
      </Phone>
        {cardOpen && token && sessionId && (
          <ResultCardModal
            url={personalCardUrl({ sessionId, token })}
          sessionId={sessionId}
            filename={cardFilename(me.nickname)}
            shareTitle={`I placed ${me.rank} in this quiz`}
            onClose={() => setCardOpen(false)}
          />
        )}
      </>
    )
  }

  return (
    <Phone me={me} cast={cast}>
      <p className="mt-24 flex items-center justify-center gap-3 text-xl text-ink-muted">Waiting for the host <WaitingDots /></p>
    </Phone>
  )
}
