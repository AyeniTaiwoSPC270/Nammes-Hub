import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { callQuiz, OPTION_STYLES, secondsRemaining, formatScore, AVATAR_COUNT, avatarInfo, randomAvatarId } from '../data/quiz'
import { AnswerShape, Avatar, BrandMark, CountdownRing, QuizBackdrop, QuizTopBar } from '../components/quiz/QuizParts'
import { QuizThemeScope } from '../components/quiz/QuizTheme'
import Character from '../components/quiz/Character'
import MathText from '../components/quiz/MathText'
import { isChoiceType } from '../../api/_lib/quizGrading.js'

// Battle mode for players, no account needed. Routes: /battle (start or join one) and /battle/:code (a shared link).
// Two kinds: a challenge (play, then a friend plays the same questions later) and a live duel (both play together, with
// an optional bot). Spec: docs/superpowers/specs/2026-10-01-quiz-battle-mode.md

const STORAGE_KEY = 'nammes-battle'
const TAG_KEY = 'nammes-battle-tag'
const MEDALS = ['🥇', '🥈', '🥉']
const BOT_LEVELS = [
  { value: 'average', label: 'Average' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'expert', label: 'Expert' },
  { value: 'mixed', label: 'Surprise me' },
]

function loadSaved() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY))
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
// A random id kept on this device, so a player's battle record follows them (it is not an account).
function deviceTag() {
  try {
    let tag = localStorage.getItem(TAG_KEY)
    if (!tag) {
      tag = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('')
      localStorage.setItem(TAG_KEY, tag)
    }
    return tag
  } catch {
    return undefined
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

function Heading({ kicker, title, children }) {
  return (
    <div className="flex flex-col items-center gap-2 pt-2 text-center">
      <BrandMark className="h-14 w-14" />
      <p className="text-sm font-bold uppercase tracking-[0.14em] text-orange-500">{kicker}</p>
      <h1 className="text-3xl font-bold">{title}</h1>
      {children}
    </div>
  )
}

// "Leave" with an optional are-you-sure step, for when leaving costs something (a duel under way).
function LeaveButton({ label, confirm, onLeave, busy, tone }) {
  const [asking, setAsking] = useState(false)
  const light = tone === 'light'
  const base = light ? 'text-white/90 underline' : 'text-ink-muted underline'
  if (!asking) {
    return (
      <button type="button" disabled={busy} onClick={() => (confirm ? setAsking(true) : onLeave())} className={`mx-auto min-h-11 px-4 text-sm font-semibold ${base}`}>
        {label}
      </button>
    )
  }
  return (
    <div role="alert" className={`mx-auto flex flex-wrap items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold ${light ? 'bg-black/25 text-white' : 'bg-surface text-ink-900'}`}>
      <span>{confirm}</span>
      <button type="button" disabled={busy} onClick={onLeave} className="min-h-11 rounded-full bg-red-600 px-4 font-bold text-white">Yes, leave</button>
      <button type="button" onClick={() => setAsking(false)} className={`min-h-11 rounded-full px-4 font-bold ${light ? 'bg-white/20' : 'bg-paper'}`}>Stay</button>
    </div>
  )
}

function ErrorLine({ error }) {
  return error ? <p role="alert" className="rounded-2xl bg-red-600/12 px-4 py-3 text-sm font-semibold text-red-600">{error}</p> : null
}

// Nickname and character, shared by every way in.
function Profile({ nickname, setNickname, avatarId, setAvatarId }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col gap-3">
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
        <span className="h-16 w-16 shrink-0"><Character id={avatarId} mood="wave" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-ink-muted">You will be</span>
          <span className="block truncate text-lg font-bold">{avatarInfo(avatarId).name}</span>
        </span>
        <button type="button" onClick={() => setAvatarId(randomAvatarId())} className="rounded-full bg-orange-500/12 px-3 py-2 text-sm font-bold text-orange-500">Shuffle</button>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="rounded-full bg-orange-500/12 px-3 py-2 text-sm font-bold text-orange-500">{open ? 'Hide' : 'Pick'}</button>
      </div>
      {open && (
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
      )}
    </div>
  )
}

const bigButton = 'min-h-14 rounded-2xl px-6 text-xl font-bold shadow-md disabled:cursor-not-allowed disabled:opacity-50'

// The champions list on the battle page: this week or all time, plus the player's own record.
function Champions({ ranking, period, onPeriod }) {
  if (!ranking) return null
  const { top, you } = ranking
  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-hairline bg-surface p-5 shadow-md" aria-label="Champions">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-bold">Champions</h2>
        <div className="flex gap-1 rounded-full bg-paper p-1 text-sm font-bold" role="group" aria-label="Period">
          {[['week', 'This week'], ['all', 'All time']].map(([value, label]) => (
            <button key={value} type="button" aria-pressed={period === value} onClick={() => onPeriod(value)} className={`rounded-full px-3 py-1 ${period === value ? 'bg-orange-500 text-white' : 'text-ink-muted'}`}>{label}</button>
          ))}
        </div>
      </div>
      {you && (
        <p className="rounded-2xl bg-orange-500/12 px-4 py-2 text-sm font-semibold">
          Your record: rating {you.rating} · {you.wins}W {you.losses}L {you.draws}D · #{you.rank}
        </p>
      )}
      {top.length === 0 ? (
        <p className="text-center text-ink-muted">{period === 'week' ? 'No finished battles this week yet. Be the first!' : 'No ranked battles yet.'}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {top.map((p) => (
            <li key={p.rank} className="flex items-center gap-3 rounded-2xl border border-hairline bg-paper p-2">
              <span className="w-8 text-center text-lg font-bold">{MEDALS[p.rank - 1] ?? p.rank}</span>
              <Avatar name={p.nickname} avatarId={p.avatarId} mood="static" className="h-10 w-10" />
              <span className="min-w-0 flex-1 truncate font-semibold">{p.nickname}</span>
              <span className="text-right text-sm text-ink-muted">{p.wins}W {p.losses}L</span>
              {period === 'all' && <span className="w-12 text-right font-bold tabular-nums">{p.rating}</span>}
            </li>
          ))}
        </ol>
      )}
      <p className="text-xs text-ink-muted">Records follow this device. Clearing your browser starts a new one. Bots are never ranked.</p>
    </section>
  )
}

// /battle: choose a quiz and how to battle, or join with a code.
function Hub({ onCreate, onJoinCode, busy, error, quizzes, presetQuiz, ranking, period, onPeriod }) {
  const [nickname, setNickname] = useState('')
  const [avatarId, setAvatarId] = useState(randomAvatarId)
  const [quizId, setQuizId] = useState(presetQuiz ?? '')
  const [botSkill, setBotSkill] = useState('average')
  const [code, setCode] = useState('')
  const chosen = quizzes.find((q) => q.id === quizId) ?? quizzes[0]
  const ready = Boolean(nickname.trim() && chosen)
  const make = (mode, vsBot = false) => onCreate({ quizId: chosen.id, mode, vsBot, botSkill, nickname, avatarId })
  return (
    <Shell>
      <Link to="/" className="text-sm font-semibold text-orange-500">← Back to NAMMES Hub</Link>
      <Heading kicker="Battle" title="Challenge someone">
        <p className="text-ink-muted">Pick a quiz and take on a friend, or a bot. No account needed.</p>
      </Heading>
      {quizzes.length === 0 ? (
        <p className="rounded-2xl border border-hairline bg-surface p-5 text-center text-ink-muted">No quiz is open for battles right now.</p>
      ) : (
        <div className="flex flex-col gap-4 rounded-3xl border border-hairline bg-surface p-5 shadow-md">
          <Profile nickname={nickname} setNickname={setNickname} avatarId={avatarId} setAvatarId={setAvatarId} />
          {quizzes.length > 1 && (
            <label className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">Quiz</span>
              <select value={chosen?.id ?? ''} onChange={(e) => setQuizId(e.target.value)} className="min-h-14 rounded-2xl border-2 border-hairline bg-paper px-4 text-lg font-semibold text-ink-900">
                {quizzes.map((q) => <option key={q.id} value={q.id}>{q.title} ({q.questionCount} questions)</option>)}
              </select>
            </label>
          )}
          <ErrorLine error={error} />
          <button type="button" disabled={busy || !ready} onClick={() => make('challenge')} className={`${bigButton} bg-orange-500 text-white`}>Challenge a friend</button>
          <p className="-mt-2 text-sm text-ink-muted">You play first, then send a link. Your friend plays the same questions whenever they like.</p>
          <button type="button" disabled={busy || !ready} onClick={() => make('duel')} className={`${bigButton} border-2 border-orange-500 text-orange-500`}>Live duel</button>
          <p className="-mt-2 text-sm text-ink-muted">Get a code, and play at the same moment as a friend.</p>
          <div className="flex items-center gap-2">
            <button type="button" disabled={busy || !ready} onClick={() => make('duel', true)} className={`${bigButton} flex-1 border-2 border-hairline`}>Duel a bot</button>
            <select value={botSkill} onChange={(e) => setBotSkill(e.target.value)} aria-label="Bot skill" className="min-h-14 rounded-2xl border-2 border-hairline bg-paper px-3 font-semibold text-ink-900">
              {BOT_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onJoinCode(code.trim().toUpperCase())
        }}
        className="flex items-center gap-2 rounded-3xl border border-hairline bg-surface p-4 shadow-md"
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          placeholder="Have a code?"
          aria-label="Battle code"
          autoCapitalize="characters"
          autoComplete="off"
          className="min-h-14 min-w-0 flex-1 rounded-2xl border-2 border-hairline bg-paper px-4 text-lg font-bold uppercase tracking-[0.2em] text-ink-900 focus:border-orange-500 focus:outline-none"
        />
        <button type="submit" disabled={code.length !== 6} className={`${bigButton} bg-orange-500 text-white`}>Go</button>
      </form>
      <Champions ranking={ranking} period={period} onPeriod={onPeriod} />
    </Shell>
  )
}

// /battle/:code: someone shared this link.
function Landing({ info, onTake, busy, error }) {
  const [nickname, setNickname] = useState('')
  const [avatarId, setAvatarId] = useState(randomAvatarId)
  const who = info.challenger
  const blocked = info.expired ? 'This battle has ended.' : info.notReady ? `${who?.nickname ?? 'The challenger'} is still playing. Try again in a moment.` : !info.seatFree ? 'This battle already has two players.' : null
  return (
    <Shell>
      <Heading kicker={info.mode === 'duel' ? 'Live duel' : 'Challenge'} title={info.title}>
        {who && (
          <div className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 shadow-sm">
            <Avatar name={who.nickname} avatarId={who.avatarId} className="h-14 w-14" />
            <div className="text-left">
              <p className="font-bold">{who.nickname} challenges you</p>
              {who.score !== undefined && <p className="text-ink-muted">Their score to beat: <span className="font-bold text-ink-900">{formatScore(who.score)}</span></p>}
            </div>
          </div>
        )}
      </Heading>
      {blocked ? (
        <p className="rounded-2xl border border-hairline bg-surface p-5 text-center text-ink-muted">{blocked}</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onTake(nickname, avatarId)
          }}
          className="flex flex-col gap-4 rounded-3xl border border-hairline bg-surface p-5 shadow-md"
        >
          <Profile nickname={nickname} setNickname={setNickname} avatarId={avatarId} setAvatarId={setAvatarId} />
          <ErrorLine error={error} />
          <button type="submit" disabled={busy || !nickname.trim()} className={`${bigButton} bg-orange-500 text-white`}>{busy ? 'Joining…' : info.mode === 'duel' ? 'Join the duel' : 'Accept the challenge'}</button>
        </form>
      )}
      <Link to="/battle" className="text-center text-sm font-semibold text-orange-500">Start your own battle</Link>
      <Link to="/" className="text-center text-sm font-semibold text-ink-muted">Back to NAMMES Hub</Link>
    </Shell>
  )
}

function ShareBox({ code }) {
  const [copied, setCopied] = useState(false)
  const link = `${window.location.origin}/battle/${code}`
  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Battle me on NAMMES Hub', url: link })
        return
      }
    } catch {
      // cancelled: fall through to copying
    }
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // the link is shown below to copy by hand
    }
  }
  return (
    <div className="flex w-full flex-col items-center gap-3 rounded-3xl border border-hairline bg-surface p-5 text-center shadow-md">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">Battle code</p>
      <p className="text-5xl font-bold tracking-[0.25em]" aria-label={`Battle code ${code.split('').join(' ')}`}>{code}</p>
      <p className="break-all text-sm text-ink-muted">{link}</p>
      <button type="button" onClick={share} className={`${bigButton} w-full bg-orange-500 text-white`}>{copied ? 'Link copied!' : 'Share the link'}</button>
    </div>
  )
}

// Options or a typed box, the same for a challenge and a duel.
function QuestionPanel({ question, disabled, onAnswer, typed, setTyped }) {
  if (isChoiceType(question.type)) {
    return (
      <div className={`grid flex-1 auto-rows-fr gap-3 ${question.options.length === 2 ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {question.options.map((option, i) => (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onAnswer({ chosenIndex: i })}
            className={`flex min-h-[120px] flex-col justify-between rounded-3xl p-4 text-left text-white shadow-lg active:scale-[0.97] disabled:opacity-60 ${OPTION_STYLES[i].bg}`}
          >
            <AnswerShape index={i} className="h-10 w-10" />
            <span className="break-words text-xl font-bold leading-tight"><MathText>{option}</MathText></span>
          </button>
        ))}
      </div>
    )
  }
  return (
    <form
      className="flex flex-1 flex-col justify-center gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (typed.trim() && !disabled) onAnswer({ answerText: typed.trim() })
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
      <button type="submit" disabled={disabled || !typed.trim()} className={`${bigButton} bg-orange-500 text-white`}>Lock in answer</button>
    </form>
  )
}

// Both players' scores, side by side.
function VersusBar({ me, opponent }) {
  const total = Math.max(1, (me.score ?? 0) + (opponent.score ?? 0))
  const mine = Math.round(((me.score ?? 0) / total) * 100)
  return (
    <div className="flex flex-col gap-1" aria-label="Score">
      <div className="flex items-center justify-between gap-2 text-sm font-bold">
        <span className="flex min-w-0 items-center gap-2"><Avatar name={me.nickname} avatarId={me.avatarId} mood="static" className="h-8 w-8" /><span className="truncate">You</span> <span className="tabular-nums">{formatScore(me.score ?? 0)}</span></span>
        <span className="flex min-w-0 items-center gap-2"><span className="tabular-nums">{formatScore(opponent.score ?? 0)}</span><span className="truncate">{opponent.nickname}</span><Avatar name={opponent.nickname} avatarId={opponent.avatarId} mood="static" className="h-8 w-8" /></span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-red-500/70">
        <div className="bg-orange-500 transition-[width] duration-500" style={{ width: `${(me.score ?? 0) + (opponent.score ?? 0) === 0 ? 50 : mine}%` }} />
      </div>
    </div>
  )
}

function FinalBoard({ view, onRematch, busy }) {
  const { final, me, opponent } = view
  const banner = final.winner === 'me' ? 'You won!' : final.winner === 'them' ? `${opponent.nickname} won` : 'A draw'
  return (
    <Shell>
      <section className="qz-pop rounded-3xl qz-deep p-6 text-center text-white shadow-xl">
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-orange-100/80">{view.mode === 'duel' ? 'Duel over' : 'Challenge complete'}{final.forfeit ? ' · left early' : ''}</p>
        <p className="mt-1 text-4xl font-bold">{banner}</p>
        <div className="mt-4 flex items-center justify-around gap-2">
          {[{ s: me, you: true }, { s: opponent }].map(({ s, you }) => (
            <div key={you ? 'me' : 'them'} className="flex flex-col items-center gap-1">
              <span className="h-20 w-20">
                <Character id={s.avatarId ?? 0} mood={(final.winner === 'me') === Boolean(you) && final.winner ? 'dance' : final.winner ? 'sad' : 'idle'} />
              </span>
              <span className="max-w-[8rem] truncate font-bold">{you ? 'You' : s.nickname}</span>
              <span className="text-3xl font-bold tabular-nums">{formatScore(s.score ?? 0)}</span>
            </div>
          ))}
        </div>
      </section>
      <section aria-label="Question by question">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.1em] text-ink-muted">Question by question</h2>
        <ol className="flex flex-col gap-2">
          {final.questions.map((q, i) => (
            <li key={q.questionId} className="rounded-2xl border border-hairline bg-surface p-3">
              <p className="mb-2 text-sm font-semibold"><span className="text-ink-muted">{i + 1}.</span> <MathText>{q.text}</MathText></p>
              <div className="flex items-center justify-between gap-2 text-sm font-bold">
                <span className={`rounded-full px-3 py-1 ${q.mine.correct ? 'bg-green-600/15 text-green-600' : 'bg-red-600/15 text-red-600'}`}>
                  You {q.mine.correct ? `✓ +${formatScore(q.mine.points)}` : q.mine.answered ? '✗' : '–'}
                </span>
                <span className="text-lg" aria-label={q.winner === 'me' ? 'You won this one' : q.winner === 'them' ? 'They won this one' : 'Level'}>{q.winner === 'me' ? '◀' : q.winner === 'them' ? '▶' : '='}</span>
                <span className={`rounded-full px-3 py-1 ${q.theirs.correct ? 'bg-green-600/15 text-green-600' : 'bg-red-600/15 text-red-600'}`}>
                  {q.theirs.correct ? `✓ +${formatScore(q.theirs.points)}` : q.theirs.answered ? '✗' : '–'} {opponent.nickname}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <button type="button" disabled={busy} onClick={onRematch} className={`${bigButton} bg-orange-500 text-white`}>{view.mode === 'duel' && opponent.isBot ? 'Rematch' : 'New battle'}</button>
      <Link to="/battle" className="text-center text-sm font-semibold text-orange-500">Back to battles</Link>
      <Link to="/" className="text-center text-sm font-semibold text-ink-muted">Back to NAMMES Hub</Link>
    </Shell>
  )
}

export default function PlayBattle() {
  const { code: linkCode } = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const [saved, setSaved] = useState(loadSaved)
  const [view, setView] = useState(null)
  const [info, setInfo] = useState(null)
  const [quizzes, setQuizzes] = useState(null)
  const [offset, setOffset] = useState(0)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [typed, setTyped] = useState('')
  const [pageError, setPageError] = useState('')
  const [ranking, setRanking] = useState(null)
  const [period, setPeriod] = useState('week')
  const timedOutFor = useRef(-1)
  const token = saved?.token
  const lastAction = useRef(null)

  const accept = useCallback((data) => {
    setOffset(data.serverNow - Date.now())
    setView(data)
  }, [])

  // Load what the page needs: a saved battle, a shared link's details, or the list of quizzes.
  useEffect(() => {
    let cancelled = false
    if (token) {
      callQuiz('battle', { op: 'state', token })
        .then((d) => !cancelled && accept(d))
        .catch((e) => {
          if (cancelled) return
          if (e.status === 401 || e.status === 404) {
            saveSaved(null)
            setSaved(null)
          } else setPageError(e.message)
        })
    } else if (linkCode) {
      callQuiz('battle', { op: 'info', code: linkCode.toUpperCase() }).then((d) => !cancelled && setInfo(d)).catch((e) => !cancelled && setPageError(e.message))
    } else {
      callQuiz('battle', { op: 'list' }).then((d) => !cancelled && setQuizzes(d.quizzes)).catch((e) => !cancelled && setPageError(e.message))
      callQuiz('battle', { op: 'ranking', period, tag: deviceTag() }).then((d) => !cancelled && setRanking(d)).catch(() => {})
    }
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, linkCode, accept, period])

  const state = view?.state
  const ticking = state === 'question' || state === 'open' || state === 'reveal'
  useEffect(() => {
    if (!ticking) return undefined
    const timer = setInterval(() => setNowMs(Date.now()), 250)
    return () => clearInterval(timer)
  }, [ticking])

  // Keep in step with the server: a duel about once a second, a sent challenge every few seconds.
  const pollMs = !view ? 0 : view.mode === 'duel' && ['open', 'question', 'reveal'].includes(state) ? 1000 : state === 'waiting' ? 4000 : 0
  useEffect(() => {
    if (!token || !pollMs) return undefined
    const timer = setInterval(() => {
      if (document.hidden) return
      callQuiz('battle', { op: 'state', token }).then(accept).catch(() => {})
    }, pollMs)
    return () => clearInterval(timer)
  }, [token, pollMs, accept])

  const clock = nowMs + offset
  const isDuel = view?.mode === 'duel'
  const startMs = view?.question ? new Date(isDuel ? view.startsAt : view.startedAt).getTime() : 0
  const untilStart = isDuel && state === 'question' ? startMs - clock : 0
  const active = state === 'question' && !(isDuel && view.myAnswered) && !(!isDuel && view.result)
  const remaining = active && untilStart <= 0 ? secondsRemaining({ startedAtMs: startMs, timeLimitSeconds: view.question.timeLimitSeconds, nowMs: clock }) : null

  // A challenge question that ran out of time: ask the server, which records a miss and sends the result.
  useEffect(() => {
    if (isDuel || remaining !== 0 || !token || timedOutFor.current === view?.index) return undefined
    timedOutFor.current = view.index
    const timer = setTimeout(() => callQuiz('battle', { op: 'state', token }).then(accept).catch(() => {}), 1700)
    return () => clearTimeout(timer)
  }, [remaining, token, view, isDuel, accept])

  function begin(data) {
    const next = { token: data.token, code: data.code }
    saveSaved(next)
    setSaved(next)
    setTyped('')
    timedOutFor.current = -1
    accept(data)
    if (!linkCode || linkCode.toUpperCase() !== data.code) navigate(`/battle/${data.code}`, { replace: true })
  }

  async function run(body, then) {
    setBusy(true)
    setError('')
    try {
      then(await callQuiz('battle', body))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  function create({ quizId, mode, vsBot, botSkill, nickname, avatarId }) {
    lastAction.current = { quizId, mode, vsBot, botSkill, nickname, avatarId }
    run({ op: 'create', quizId, mode, vsBot, botSkill, nickname, avatarId, tag: deviceTag() }, begin)
  }
  function take(nickname, avatarId) {
    run({ op: 'join', code: linkCode.toUpperCase(), nickname, avatarId, tag: deviceTag() }, begin)
  }
  function answer(payload) {
    run({ op: 'answer', token, ...payload }, (data) => {
      setTyped('')
      if (isDuel) setView((v) => ({ ...v, myAnswered: true }))
      else setView((v) => ({ ...v, result: data.result, me: { ...v.me, score: data.score } }))
    })
  }
  // Walk away: tell the server (best effort), forget the battle and go back to the start.
  async function leave() {
    setBusy(true)
    try {
      if (token) await callQuiz('battle', { op: 'leave', token })
    } catch {
      // already over, or offline: leaving locally is still right
    } finally {
      saveSaved(null)
      setSaved(null)
      setView(null)
      setInfo(null)
      setBusy(false)
      navigate('/battle', { replace: true })
    }
  }
  function rematch() {
    const last = lastAction.current ?? { quizId: view.quizId, mode: view.mode, vsBot: view.opponent?.isBot, botSkill: 'average', nickname: view.me.nickname, avatarId: view.me.avatarId }
    saveSaved(null)
    setSaved(null)
    setView(null)
    create(last)
  }

  const theme = view?.theme ?? info?.theme ?? null
  let body

  if (pageError && !view) {
    body = (
      <Shell>
        <div className="mt-24 flex flex-col items-center gap-3 text-center">
          <span className="material-symbols-outlined text-5xl text-ink-muted" aria-hidden="true">error</span>
          <h1 className="text-2xl font-bold">Battles are not available</h1>
          <p className="text-ink-muted">{pageError}</p>
          <Link to="/battle" className="font-semibold text-orange-500">Try again</Link>
        </div>
      </Shell>
    )
  } else if (!view) {
    if (token) body = <Shell><p className="mt-24 text-center text-xl text-ink-muted">Loading…</p></Shell>
    else if (linkCode) body = info ? <Landing info={info} onTake={take} busy={busy} error={error} /> : <Shell><p className="mt-24 text-center text-xl text-ink-muted">Loading…</p></Shell>
    else if (quizzes) {
      body = (
        <Hub
          quizzes={quizzes}
          presetQuiz={search.get('quiz')}
          onCreate={create}
          busy={busy}
          error={error}
          onJoinCode={(c) => navigate(`/battle/${c}`)}
          ranking={ranking}
          period={period}
          onPeriod={setPeriod}
        />
      )
    } else body = <Shell><p className="mt-24 text-center text-xl text-ink-muted">Loading…</p></Shell>
  } else if (state === 'cancelled') {
    body = (
      <Shell>
        <div className="mt-20 flex flex-col items-center gap-3 text-center">
          <h1 className="text-3xl font-bold">This battle ended</h1>
          <p className="text-ink-muted">Nobody joined, or both players left.</p>
          <Link to="/battle" className="font-semibold text-orange-500">Start another</Link>
        </div>
      </Shell>
    )
  } else if (state === 'finished') {
    body = <FinalBoard view={view} onRematch={rematch} busy={busy} />
  } else if (state === 'open') {
    body = (
      <Shell>
        <Heading kicker="Live duel" title="Waiting for your opponent">
          <p className="text-ink-muted">Send them the link, or have them type the code at nammeshub.com.ng/battle. The duel starts as soon as they join.</p>
        </Heading>
        <ShareBox code={view.code} />
        <p className="text-center text-ink-muted"><span className="animate-pulse">Waiting…</span></p>
        <LeaveButton label="Cancel this duel" onLeave={leave} busy={busy} />
      </Shell>
    )
  } else if (state === 'waiting') {
    const bothDone = view.opponent && !view.opponent.waiting
    body = (
      <Shell>
        <section className="qz-pop rounded-3xl qz-deep p-6 text-center text-white shadow-xl">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-orange-100/80">Your score to beat</p>
          <p className="mt-1 text-6xl font-bold">{formatScore(view.me.score)}</p>
          <p className="mt-2 text-lg">{bothDone ? 'Working out who won…' : view.opponent ? `${view.opponent.nickname} is playing now…` : 'Now send the challenge to a friend.'}</p>
        </section>
        <ShareBox code={view.code} />
        <p className="text-center text-sm text-ink-muted">Come back to this page later to see who won. The link works for 7 days.</p>
        <LeaveButton label={view.opponent ? 'Back to battles' : 'Cancel this challenge'} confirm={view.opponent ? null : 'The link will stop working.'} onLeave={leave} busy={busy} />
      </Shell>
    )
  } else if (isDuel && state === 'reveal') {
    const r = view.reveal
    const label = r.mine.correctText ?? (r.mine.correctIndex !== null ? view.question.options[r.mine.correctIndex] : null)
    body = (
      <Shell tone={r.mine.correct ? 'good' : 'bad'}>
        <div className="mt-4 flex flex-col items-center gap-4 text-center">
          <div className="qz-pop h-28 w-28 rounded-full bg-white/20 p-2"><Character id={view.me.avatarId ?? 0} mood={r.mine.correct ? 'dance' : 'sad'} /></div>
          <h1 className="text-4xl font-bold">{r.mine.correct ? 'Correct!' : r.mine.timedOut ? "Time's up" : 'Not quite'}</h1>
          {r.mine.correct && <p className="rounded-full bg-white px-6 py-2 text-3xl font-bold text-green-700">+{formatScore(r.mine.pointsAwarded)}</p>}
          {label && <p className="w-full rounded-2xl bg-white/15 p-3 text-xl font-bold">Answer: <MathText>{label}</MathText></p>}
          <p className="rounded-full bg-black/20 px-5 py-2 font-semibold">
            {view.opponent.nickname}: {r.theirs.answered ? (r.theirs.correct ? `right, +${formatScore(r.theirs.pointsAwarded)}` : 'wrong') : 'no answer'}
          </p>
          <div className="w-full rounded-2xl bg-black/20 p-3 text-left"><VersusBar me={view.me} opponent={view.opponent} /></div>
          <p className="text-sm text-white/80">Next question coming up…</p>
          <LeaveButton tone="light" label="Leave duel" confirm={view.opponent.isBot ? 'Leave this duel?' : 'Leave? Your opponent wins.'} onLeave={leave} busy={busy} />
        </div>
      </Shell>
    )
  } else if (isDuel && untilStart > 0) {
    body = (
      <Shell>
        <div className="mt-16 flex flex-col items-center gap-4 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-orange-500">{view.index === 0 ? 'Duel starting' : `Question ${view.index + 1}`}</p>
          <p className="qz-pop text-9xl font-bold" key={Math.ceil(untilStart / 1000)}>{Math.max(1, Math.ceil(untilStart / 1000))}</p>
          <div className="w-full"><VersusBar me={view.me} opponent={view.opponent} /></div>
          <LeaveButton label="Leave duel" confirm={view.opponent.isBot ? 'Leave this duel?' : 'Leave? Your opponent wins.'} onLeave={leave} busy={busy} />
        </div>
      </Shell>
    )
  } else if (!isDuel && view.result) {
    const { result, question } = view
    const label = result.correctText ?? (result.correctIndex !== null ? question.options[result.correctIndex] : null)
    const last = view.index + 1 >= view.total
    body = (
      <Shell tone={result.correct ? 'good' : 'bad'}>
        <div className="mt-6 flex flex-col items-center gap-4 text-center">
          <div className="qz-pop h-36 w-36 rounded-full bg-white/20 p-3"><Character id={view.me.avatarId ?? 0} mood={result.correct ? 'dance' : 'sad'} /></div>
          <h1 className="text-5xl font-bold">{result.correct ? 'Correct!' : result.timedOut ? "Time's up" : 'Not quite'}</h1>
          {result.correct && <p className="rounded-full bg-white px-6 py-2 text-4xl font-bold text-green-700">+{formatScore(result.pointsAwarded)}</p>}
          {!result.correct && label && (
            <div className="w-full rounded-2xl bg-white/15 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/80">The answer was</p>
              <p className="mt-1 break-words text-2xl font-bold"><MathText>{label}</MathText></p>
            </div>
          )}
          <p className="rounded-full bg-black/20 px-5 py-2 text-lg font-semibold">{formatScore(view.me.score)} pts · question {view.index + 1} of {view.total}</p>
          {error && <p role="alert" className="text-sm">{error}</p>}
          <LeaveButton tone="light" label="Quit this challenge" confirm="Quit? Your progress is lost." onLeave={leave} busy={busy} />
          <button
            type="button"
            disabled={busy}
            onClick={() => run({ op: 'next', token }, (d) => { setTyped(''); timedOutFor.current = -1; accept(d) })}
            className={`${bigButton} w-full bg-white text-ink-900`}
          >
            {last ? 'See my results' : 'Next question'}
          </button>
        </div>
      </Shell>
    )
  } else {
    const { question } = view
    const waitingForThem = isDuel && view.myAnswered
    body = (
      <Shell>
        {isDuel && <VersusBar me={view.me} opponent={view.opponent} />}
        {isDuel && view.opponent.presence === 'away' && <p role="status" className="rounded-2xl bg-orange-500/15 px-4 py-2 text-center text-sm font-semibold text-orange-600">{view.opponent.nickname} seems to have dropped out. You win if they do not come back soon.</p>}
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-orange-500 px-4 py-2 text-sm font-bold text-white">Q{view.index + 1} of {view.total}</span>
          {!isDuel && <span className="font-bold tabular-nums">{formatScore(view.me.score)} pts</span>}
          <CountdownRing seconds={remaining ?? question.timeLimitSeconds} total={question.timeLimitSeconds} size={52} stroke={6} />
        </div>
        {question.multiplier === 2 && <span className="mx-auto rounded-full bg-orange-500 px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-white">Double points</span>}
        {question.imageUrl && <img src={question.imageUrl} alt={question.imageAlt} className="mx-auto max-h-40 w-auto max-w-full rounded-2xl border border-hairline bg-white object-contain p-1" />}
        <p className="text-center text-lg font-bold leading-snug"><MathText>{question.text}</MathText></p>
        {waitingForThem ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <span className="h-24 w-24"><Character id={view.me.avatarId ?? 0} mood="wave" /></span>
            <p className="text-xl font-bold">Locked in!</p>
            <p className="text-ink-muted">{view.opponentAnswered ? 'Revealing…' : `Waiting for ${view.opponent.nickname}…`}</p>
          </div>
        ) : (
          <QuestionPanel question={question} disabled={busy || remaining === 0} onAnswer={answer} typed={typed} setTyped={setTyped} />
        )}
        {error && <p role="alert" className="text-center text-sm text-ink-muted">{error}</p>}
        <LeaveButton label={isDuel ? 'Leave duel' : 'Quit this challenge'} confirm={isDuel ? (view.opponent.isBot ? 'Leave this duel?' : 'Leave? Your opponent wins.') : 'Quit? Your progress is lost.'} onLeave={leave} busy={busy} />
      </Shell>
    )
  }

  return <QuizThemeScope theme={theme}>{body}</QuizThemeScope>
}
