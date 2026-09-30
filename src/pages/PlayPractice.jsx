import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { callQuiz, OPTION_STYLES, secondsRemaining, formatScore, AVATAR_COUNT, avatarInfo, randomAvatarId } from '../data/quiz'
import { AnswerShape, Avatar, BrandMark, CountdownRing, QuizBackdrop, QuizTopBar } from '../components/quiz/QuizParts'
import { QuizThemeScope } from '../components/quiz/QuizTheme'
import Character from '../components/quiz/Character'
import MathText from '../components/quiz/MathText'
import { isChoiceType } from '../../api/_lib/quizGrading.js'

// Solo practice for a quiz an admin has opened for it: no host, no code, your own pace. Questions arrive one at a time
// and the result shows straight away. The little leaderboard is just for fun. Spec: docs/superpowers/specs/2026-09-30-live-quiz-premium-features.md

const STORAGE_KEY = 'nammes-quiz-practice'
const MEDALS = ['🥇', '🥈', '🥉']

function loadSaved(quizId) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY))
    return saved && saved.quizId === quizId ? saved : null
  } catch {
    return null
  }
}
function saveSaved(value) {
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // private mode: a reload means starting again
  }
}

function Shell({ children, tone }) {
  const bg = tone === 'good' ? 'bg-green-700 text-white' : tone === 'bad' ? 'bg-red-700 text-white' : 'bg-paper text-ink-900'
  return (
    <div className={`relative flex min-h-[100dvh] flex-col ${bg}`}>
      {!tone && <QuizBackdrop />}
      {!tone && <QuizTopBar compact />}
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-5">{children}</main>
    </div>
  )
}

function Intro({ info, onStart, busy, error }) {
  const [nickname, setNickname] = useState('')
  const [avatarId, setAvatarId] = useState(randomAvatarId)
  return (
    <Shell>
      <div className="flex flex-col items-center gap-2 pt-4 text-center">
        <BrandMark className="h-16 w-16" />
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-orange-500">Practice</p>
        <h1 className="text-3xl font-bold">{info.title}</h1>
        <p className="text-ink-muted">{info.questionCount} question{info.questionCount === 1 ? '' : 's'}. Go at your own pace and see the answer after each one.</p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onStart(nickname, avatarId)
        }}
        className="flex flex-col gap-4 rounded-3xl border border-hairline bg-surface p-5 shadow-md"
      >
        <label className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">Your nickname</span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            autoComplete="off"
            placeholder="e.g. Euler_Fan"
            className="min-h-14 rounded-2xl border-2 border-hairline bg-paper px-4 text-lg font-semibold text-ink-900 focus:border-orange-500 focus:outline-none"
          />
        </label>
        <div className="flex items-center gap-4 rounded-2xl bg-paper p-3">
          <span className="h-20 w-20 shrink-0"><Character id={avatarId} mood="wave" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-ink-muted">You will be</span>
            <span className="block truncate text-xl font-bold">{avatarInfo(avatarId).name}</span>
          </span>
          <button type="button" onClick={() => setAvatarId(randomAvatarId())} className="rounded-full bg-orange-500/12 px-3 py-2 text-sm font-bold text-orange-500">
            Shuffle
          </button>
        </div>
        <div className="grid max-h-44 grid-cols-6 gap-2 overflow-y-auto rounded-2xl border border-hairline p-2" role="group" aria-label="Characters">
          {Array.from({ length: AVATAR_COUNT }, (_, id) => (
            <button
              key={id}
              type="button"
              aria-label={avatarInfo(id).name}
              aria-pressed={avatarId === id}
              onClick={() => setAvatarId(id)}
              className={`aspect-square rounded-xl border-2 p-0.5 ${avatarId === id ? 'border-orange-500 bg-orange-500/12' : 'border-transparent bg-paper'}`}
            >
              <Character id={id} mood="static" />
            </button>
          ))}
        </div>
        {error && <p role="alert" className="rounded-2xl bg-red-600/12 px-4 py-3 text-sm font-semibold text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy || !nickname.trim()}
          className="min-h-14 rounded-2xl bg-orange-500 px-6 text-xl font-bold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Starting…' : 'Start practising'}
        </button>
      </form>
    </Shell>
  )
}

export default function PlayPractice() {
  const { quizId } = useParams()
  const [info, setInfo] = useState(null)
  const [infoError, setInfoError] = useState('')
  const [saved, setSaved] = useState(() => loadSaved(quizId))
  const [run, setRun] = useState(null)
  const [offset, setOffset] = useState(0)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [typed, setTyped] = useState('')
  const [top, setTop] = useState([])
  const timedOutFor = useRef(-1)

  const token = saved?.token
  const accept = useCallback((data) => {
    setOffset(data.serverNow - Date.now())
    setRun(data)
  }, [])

  useEffect(() => {
    let cancelled = false
    callQuiz('practice', { op: 'info', quizId })
      .then((data) => !cancelled && setInfo(data))
      .catch((e) => !cancelled && setInfoError(e.message))
    return () => {
      cancelled = true
    }
  }, [quizId])

  // Pick up a run in progress (for example after a page reload).
  useEffect(() => {
    if (!token) return
    callQuiz('practice', { op: 'state', token })
      .then(accept)
      .catch((e) => {
        if (e.status === 401 || e.status === 404) {
          saveSaved(null)
          setSaved(null)
        }
      })
  }, [token, accept])

  const questionActive = run && !run.finished && !run.result
  useEffect(() => {
    if (!questionActive) return undefined
    const timer = setInterval(() => setNowMs(Date.now()), 250)
    return () => clearInterval(timer)
  }, [questionActive])

  // Out of time with no answer: ask the server, which records a miss and sends the result.
  const remaining = questionActive
    ? secondsRemaining({ startedAtMs: new Date(run.startedAt).getTime(), timeLimitSeconds: run.question.timeLimitSeconds, nowMs: nowMs + offset })
    : null
  useEffect(() => {
    if (remaining !== 0 || !token || timedOutFor.current === run?.index) return
    timedOutFor.current = run.index
    const timer = setTimeout(() => callQuiz('practice', { op: 'state', token }).then(accept).catch(() => {}), 1700)
    return () => clearTimeout(timer)
  }, [remaining, token, run, accept])

  useEffect(() => {
    if (!run?.finished) return
    callQuiz('practice', { op: 'top', quizId }).then((d) => setTop(d.top)).catch(() => {})
  }, [run?.finished, quizId])

  async function act(body, then) {
    setBusy(true)
    setError('')
    try {
      then(await callQuiz('practice', { ...body, token }))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function start(nickname, avatarId) {
    setBusy(true)
    setError('')
    try {
      const data = await callQuiz('practice', { op: 'start', quizId, nickname, avatarId })
      const next = { token: data.token, quizId }
      saveSaved(next)
      setSaved(next)
      accept(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  function answer(payload) {
    act({ op: 'answer', ...payload }, (data) => {
      setRun((r) => ({ ...r, result: data.result, score: data.score }))
      setTyped('')
    })
  }

  function restart() {
    saveSaved(null)
    setSaved(null)
    setRun(null)
    setTop([])
    timedOutFor.current = -1
  }

  const theme = run?.theme ?? info?.theme ?? null

  if (infoError) {
    return (
      <QuizThemeScope theme={null}>
        <Shell>
          <div className="mt-24 flex flex-col items-center gap-3 text-center">
            <span className="material-symbols-outlined text-5xl text-ink-muted" aria-hidden="true">error</span>
            <h1 className="text-2xl font-bold">Practice is not available</h1>
            <p className="text-ink-muted">{infoError}</p>
          </div>
        </Shell>
      </QuizThemeScope>
    )
  }
  if (!info) {
    return (
      <QuizThemeScope theme={null}>
        <Shell><p className="mt-24 text-center text-xl text-ink-muted">Loading…</p></Shell>
      </QuizThemeScope>
    )
  }

  let body
  if (!run) {
    body = token ? <Shell><p className="mt-24 text-center text-xl text-ink-muted">Loading…</p></Shell> : <Intro info={info} onStart={start} busy={busy} error={error} />
  } else if (run.finished) {
    body = (
      <Shell>
        <section className="qz-pop rounded-3xl qz-deep p-8 text-center text-white shadow-xl">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-orange-100/80">Practice complete</p>
          <p className="mt-2 text-6xl font-bold">{formatScore(run.score)}</p>
          <p className="text-xl font-semibold">points</p>
          <p className="mt-2 text-lg">{run.correctCount} of {run.total} right</p>
        </section>
        {top.length > 0 && (
          <div>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.1em] text-ink-muted">Practice top 10 (just for fun)</h2>
            <ol className="flex flex-col gap-2">
              {top.map((p, i) => (
                <li key={i} className="flex items-center gap-3 rounded-2xl border border-hairline bg-surface p-3">
                  <span className="w-8 text-center text-xl font-bold">{MEDALS[i] ?? i + 1}</span>
                  <Avatar name={p.nickname} avatarId={p.avatarId} className="h-10 w-10" />
                  <span className="min-w-0 flex-1 truncate font-semibold">{p.nickname}</span>
                  <span className="font-bold tabular-nums">{formatScore(p.score)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        <button type="button" onClick={restart} className="min-h-14 rounded-2xl bg-orange-500 px-6 text-xl font-bold text-white shadow-md">Try again</button>
      </Shell>
    )
  } else if (run.result) {
    const { result, question } = run
    const tone = result.correct ? 'good' : 'bad'
    const label = result.correctText ?? (result.correctIndex !== null ? question.options[result.correctIndex] : null)
    const last = run.index + 1 >= run.total
    body = (
      <Shell tone={tone}>
        <div className="mt-6 flex flex-col items-center gap-4 text-center">
          <div className="qz-pop h-36 w-36 rounded-full bg-white/20 p-3"><Character id={run.avatarId ?? 0} mood={result.correct ? 'dance' : 'sad'} /></div>
          <h1 className="text-5xl font-bold">{result.correct ? 'Correct!' : result.timedOut ? "Time's up" : 'Not quite'}</h1>
          {result.correct && <p className="rounded-full bg-white px-6 py-2 text-4xl font-bold text-green-700">+{formatScore(result.pointsAwarded)}</p>}
          {!result.correct && label && (
            <div className="w-full rounded-2xl bg-white/15 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/80">The answer was</p>
              <p className="mt-1 break-words text-2xl font-bold"><MathText>{label}</MathText></p>
            </div>
          )}
          <p className="rounded-full bg-black/20 px-5 py-2 text-lg font-semibold">{formatScore(run.score)} pts · question {run.index + 1} of {run.total}</p>
          {error && <p role="alert" className="text-sm">{error}</p>}
          <button
            type="button"
            disabled={busy}
            onClick={() => act({ op: 'next' }, (data) => { accept(data); timedOutFor.current = -1 })}
            className="min-h-14 w-full rounded-2xl bg-white px-6 text-xl font-bold text-ink-900 shadow-md disabled:opacity-60"
          >
            {last ? 'See my results' : 'Next question'}
          </button>
        </div>
      </Shell>
    )
  } else {
    const { question } = run
    const choice = isChoiceType(question.type)
    body = (
      <Shell>
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-orange-500 px-4 py-2 text-sm font-bold text-white">Q{run.index + 1} of {run.total}</span>
          <span className="font-bold tabular-nums">{formatScore(run.score)} pts</span>
          <CountdownRing seconds={remaining ?? 0} total={question.timeLimitSeconds} size={52} stroke={6} />
        </div>
        {question.multiplier === 2 && <span className="mx-auto rounded-full bg-orange-500 px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-white">Double points</span>}
        {question.imageUrl && <img src={question.imageUrl} alt={question.imageAlt} className="mx-auto max-h-40 w-auto max-w-full rounded-2xl border border-hairline bg-white object-contain p-1" />}
        <p className="text-center text-lg font-bold leading-snug"><MathText>{question.text}</MathText></p>
        {choice ? (
          <div className={`grid flex-1 auto-rows-fr gap-3 ${question.options.length === 2 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {question.options.map((option, i) => (
              <button
                key={i}
                type="button"
                disabled={busy || remaining === 0}
                onClick={() => answer({ chosenIndex: i })}
                className={`flex min-h-[130px] flex-col justify-between rounded-3xl p-4 text-left text-white shadow-lg active:scale-[0.97] disabled:opacity-60 ${OPTION_STYLES[i].bg}`}
              >
                <AnswerShape index={i} className="h-10 w-10" />
                <span className="break-words text-xl font-bold leading-tight"><MathText>{option}</MathText></span>
              </button>
            ))}
          </div>
        ) : (
          <form
            className="flex flex-1 flex-col justify-center gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (typed.trim() && !busy && remaining !== 0) answer({ answerText: typed.trim() })
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
              placeholder={question.type === 'numeric' ? 'A number, like 3.14 or 1/2' : 'Type your answer'}
              className="min-h-16 rounded-2xl border-2 border-hairline bg-surface px-4 text-2xl font-bold text-ink-900 placeholder:text-base placeholder:font-normal focus:border-orange-500 focus:outline-none"
            />
            <button type="submit" disabled={busy || !typed.trim() || remaining === 0} className="min-h-14 rounded-2xl bg-orange-500 px-6 text-xl font-bold text-white shadow-md disabled:opacity-50">
              Lock in answer
            </button>
          </form>
        )}
        {error && <p role="alert" className="text-center text-sm text-ink-muted">{error}</p>}
      </Shell>
    )
  }

  return <QuizThemeScope theme={theme}>{body}</QuizThemeScope>
}
