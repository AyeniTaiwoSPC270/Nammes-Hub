import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Link, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabaseClient'
import { hostAction, hostOp, OPTION_STYLES, secondsRemaining, elapsedAtPauseMs, rankPlayers, formatScore, autoSecondsLeft, AUTO_ADVANCE_MS, FULL_LOBBY_COUNTDOWN_MS } from '../data/quiz'
import { isChoiceType, normaliseText } from '../../api/_lib/quizGrading.js'
import { rankTeams, teamStyle } from '../data/quizTeams'
import MathText from '../components/quiz/MathText'
import { useCountUp } from '../lib/useCountUp'
import { useProjectorFit } from '../lib/projectorFit'
import { AnswerShape, Avatar, CountdownRing, Confetti, QuizBackdrop, QuizTopBar, SoundControl, SponsorStrip } from '../components/quiz/QuizParts'
import { quizSound, tickSound, stateSound, revealSting } from '../lib/quizSound'
import { sanitizeTheme } from '../../api/_lib/quizTheme.js'
import { QuizThemeScope, useQuizTheme } from '../components/quiz/QuizTheme'

// Projector screen for a live quiz. The host's browser only ever asks the server to move the game on
// (/api/quiz?action=advance); everything else here is reading. Spec: docs/superpowers/specs/2026-09-30-live-quiz-design.md

const POLL_MS = 2500

function Stage({ title, chip, footer, children }) {
  // Projector screens should not need scrolling, so they shrink to fit the window.
  const mainRef = useRef(null)
  useProjectorFit(mainRef, { baseMaxWidth: 1400 })
  return (
    <div className="relative flex min-h-screen flex-col bg-paper text-ink-900">
      <QuizBackdrop />
      <QuizTopBar title={title}>
        {chip}
        <SoundControl />
      </QuizTopBar>
      <main ref={mainRef} className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 px-4 py-6 sm:px-8">{children}</main>
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
function AutoAdvance({ auto, noun = 'auto-advance' }) {
  return (
    <button
      type="button"
      onClick={auto.toggle}
      className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-hairline bg-surface px-4 py-2 text-sm font-bold text-ink-900 hover:bg-surface-low"
    >
      <span className="material-symbols-outlined" aria-hidden="true">{auto.on ? 'pause' : 'play_arrow'}</span>
      {auto.on ? `Pause ${noun}` : `Resume ${noun}`}
    </button>
  )
}

function withCountdown(label, auto) {
  return auto.on ? `${label} (${auto.secondsLeft}s)` : label
}

// The question as the audience reads it: optional picture, then the text (with maths if it has any).
function QuestionHeading({ question, size = 'large' }) {
  const big = size === 'large'
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4">
      {question.multiplier === 2 && (
        <span className="qz-pop rounded-full bg-orange-500 px-5 py-1.5 text-lg font-bold uppercase tracking-[0.12em] text-white shadow-md">Double points</span>
      )}
      {question.imageUrl && (
        <img
          src={question.imageUrl}
          alt={question.imageAlt}
          className={`w-auto max-w-full rounded-2xl border border-hairline bg-white object-contain shadow-md ${big ? 'max-h-[34vh]' : 'max-h-[26vh]'}`}
        />
      )}
      <h1 className={`qz-rise px-2 text-center font-bold leading-tight ${big ? 'text-3xl sm:text-5xl' : 'text-2xl sm:text-4xl'}`}>
        <MathText>{question.text}</MathText>
      </h1>
    </div>
  )
}

// Small round icon button used by the host controls.
function ControlButton({ icon, label, onClick, disabled, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={[
        'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold',
        active ? 'border-orange-500 bg-orange-500 text-white' : 'border-hairline bg-surface text-ink-900 hover:bg-surface-low',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      ].join(' ')}
    >
      <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
      {label}
    </button>
  )
}

function Lobby({ session, title, players, questionCount, onStart, busy, maxPlayers, fullLeft, auto, locked, onToggleLock, onKick, onRename, teams }) {
  const [menuFor, setMenuFor] = useState(null)
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams])
  // In a team game players are listed team by team, each with a coloured tag.
  const orderedPlayers = useMemo(
    () => (teams.length ? [...players].sort((a, b) => (teamById.get(a.team_id)?.position ?? 99) - (teamById.get(b.team_id)?.position ?? 99)) : players),
    [players, teams, teamById],
  )
  const [qr, setQr] = useState('')
  const joinUrl = `${window.location.origin}/play?code=${session.join_code}`
  const digits = session.join_code.split('')
  const theme = useQuizTheme()
  const isFull = fullLeft !== null
  const fillPercent = Math.min(100, Math.round((players.length / maxPlayers) * 100))

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
          <div className="flex flex-wrap items-center gap-3">
            <ControlButton icon={locked ? 'lock' : 'lock_open'} label={locked ? 'Unlock lobby' : 'Lock lobby'} onClick={onToggleLock} active={locked} />
            {isFull ? (
              <AutoAdvance auto={auto} noun="auto-start" />
            ) : (
              <span className="text-ink-muted">
                {locked ? 'The lobby is locked: nobody new can join.' : players.length === 0 ? 'Players will appear here as they join.' : 'Everyone in? Start when you are ready.'}
              </span>
            )}
          </div>
          <ActionButton onClick={onStart} disabled={busy || players.length === 0} icon="play_arrow">
            {players.length === 0
              ? 'Waiting for players…'
              : isFull
                ? withCountdown('Start now', { on: auto.on, secondsLeft: fullLeft })
                : `Start game (${players.length})`}
          </ActionButton>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="qz-rise flex flex-col justify-between gap-8 rounded-3xl qz-deep p-8 text-white shadow-xl sm:p-10">
          <div>
            {theme.headline && <h2 className="mb-4 text-3xl font-bold leading-tight sm:text-5xl">{theme.headline}</h2>}
            <p className="text-lg font-semibold uppercase tracking-[0.14em] text-orange-100/80">Join the game</p>
            <p className="mt-1 text-2xl font-semibold sm:text-3xl">
              Go to <span className="text-orange-100">{window.location.host}/play</span> and enter
            </p>
            {theme.tagline && <p className="mt-3 text-xl text-white/80">{theme.tagline}</p>}
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
      <SponsorStrip placement="lobby" />

      <section className="rounded-3xl border border-hairline bg-surface p-6 shadow-md sm:p-8">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">Players</h2>
          <span className="flex h-9 min-w-9 items-center justify-center rounded-full bg-orange-500 px-3 text-lg font-bold text-white">
            {players.length} / {maxPlayers}
          </span>
          <div className="ml-2 hidden h-3 flex-1 overflow-hidden rounded-full bg-hairline/60 sm:block" aria-hidden="true">
            <div className="h-full rounded-full bg-orange-500 transition-[width] duration-500" style={{ width: `${fillPercent}%` }} />
          </div>
        </div>
        {isFull && (
          <div role="status" className="qz-pop mt-4 flex items-center gap-4 rounded-2xl bg-orange-500 p-4 text-white shadow-md">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/20 text-3xl font-bold">{auto.on ? fullLeft : '⏸'}</span>
            <div>
              <p className="text-xl font-bold">Lobby full!</p>
              <p className="text-white/90">
                {auto.on ? `The game starts in ${fullLeft} second${fullLeft === 1 ? '' : 's'}, or press Start now.` : 'Auto-start is paused. Press Start now when you are ready.'}
              </p>
            </div>
          </div>
        )}
        {teams.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Teams">
            {teams.map((t) => (
              <li key={t.id} className={`rounded-full px-3 py-1 text-sm font-bold ${teamStyle(t.color).soft} ${teamStyle(t.color).text}`}>
                {t.name} · {players.filter((p) => p.team_id === t.id).length}
              </li>
            ))}
          </ul>
        )}
        {players.length === 0 ? (
          <p className="mt-6 flex items-center gap-3 text-lg text-ink-muted">
            <span className="qz-float inline-block text-3xl" aria-hidden="true">π</span>
            Waiting for the first player to join…
          </p>
        ) : (
          <div className="mt-5 flex flex-wrap gap-3">
            {orderedPlayers.map((p) => (
              <span key={p.id} className="qz-pop relative inline-flex items-center gap-2 rounded-full border border-hairline bg-paper py-1 pl-1.5 pr-2 text-lg font-semibold">
                <Avatar name={p.nickname} avatarId={p.avatar_id} className="h-12 w-12" />
                {p.nickname}
                {teamById.get(p.team_id) && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold text-white ${teamStyle(teamById.get(p.team_id).color).bg}`}>{teamById.get(p.team_id).name}</span>
                )}
                <button
                  type="button"
                  onClick={() => setMenuFor(menuFor === p.id ? null : p.id)}
                  aria-label={`Manage ${p.nickname}`}
                  aria-expanded={menuFor === p.id}
                  className="ml-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-ink-muted hover:bg-surface-low hover:text-ink-900"
                >
                  <span className="material-symbols-outlined text-xl" aria-hidden="true">edit</span>
                </button>
                {menuFor === p.id && (
                  <span role="menu" className="absolute left-0 top-full z-20 mt-2 flex min-w-56 flex-col rounded-2xl border border-hairline bg-surface p-2 text-base shadow-xl">
                    <button role="menuitem" type="button" className="cursor-pointer rounded-xl px-3 py-2 text-left hover:bg-surface-low" onClick={() => { setMenuFor(null); onRename(p) }}>
                      Rename to &quot;Player ###&quot;
                    </button>
                    <button role="menuitem" type="button" className="cursor-pointer rounded-xl px-3 py-2 text-left hover:bg-surface-low" onClick={() => { setMenuFor(null); onKick(p, false) }}>
                      Remove from game
                    </button>
                    <button role="menuitem" type="button" className="cursor-pointer rounded-xl px-3 py-2 text-left text-red-600 hover:bg-surface-low" onClick={() => { setMenuFor(null); onKick(p, true) }}>
                      Remove and block this name
                    </button>
                  </span>
                )}
              </span>
            ))}
          </div>
        )}
      </section>
    </Stage>
  )
}

// What the audience needs to know about a question row (the host reads the full row, including the answer).
function toView(question) {
  return {
    text: question.text,
    imageUrl: question.image_path ? supabase.storage.from('quiz-images').getPublicUrl(question.image_path).data.publicUrl : null,
    imageAlt: question.image_alt ?? '',
    multiplier: question.points_multiplier ?? 1,
  }
}

function AnswerTiles({ question, children }) {
  return (
    <div className="grid flex-1 gap-4 sm:grid-cols-2">
      {question.options.map((option, i) => children(option, i))}
    </div>
  )
}

// Skipping throws the question away, so it asks twice.
function SkipButton({ onSkip, disabled }) {
  const [sure, setSure] = useState(false)
  useEffect(() => {
    if (!sure) return undefined
    const timer = setTimeout(() => setSure(false), 3000)
    return () => clearTimeout(timer)
  }, [sure])
  return (
    <ControlButton
      icon="skip_next"
      label={sure ? 'Sure? Skip it' : 'Skip'}
      active={sure}
      disabled={disabled}
      onClick={() => {
        if (sure) {
          setSure(false)
          onSkip()
        } else setSure(true)
      }}
    />
  )
}

function QuestionScreen({ title, question, index, total, remaining, answered, playerCount, onEnd, busy, paused, onTogglePause, onExtend, canExtend, onSkip }) {
  const share = playerCount > 0 ? Math.round((answered / playerCount) * 100) : 0
  const type = question.type ?? 'multiple'
  return (
    <Stage
      title={title}
      chip={<Chip tone="accent">Question {index + 1} of {total}</Chip>}
      footer={
        <>
          <div className="flex flex-wrap items-center gap-2">
            <ControlButton icon={paused ? 'play_arrow' : 'pause'} label={paused ? 'Resume' : 'Pause'} onClick={onTogglePause} active={paused} disabled={busy} />
            <ControlButton icon="more_time" label="+10 s" onClick={onExtend} disabled={busy || !canExtend} />
            <SkipButton onSkip={onSkip} disabled={busy} />
            <span className="hidden text-ink-muted xl:inline">Space ends the question · P pauses · + adds time</span>
          </div>
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

      {paused && (
        <div role="status" className="qz-pop mx-auto flex items-center gap-3 rounded-2xl bg-orange-500 px-6 py-3 text-xl font-bold text-white shadow-md">
          <span className="material-symbols-outlined" aria-hidden="true">pause</span>
          Paused. The clock is stopped.
        </div>
      )}

      <QuestionHeading question={toView(question)} />

      {isChoiceType(type) ? (
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
              <span className="text-2xl font-bold leading-snug sm:text-4xl"><MathText>{option}</MathText></span>
            </div>
          )}
        </AnswerTiles>
      ) : (
        <div className="qz-rise mx-auto flex w-full max-w-3xl items-center gap-5 rounded-3xl border-2 border-dashed border-orange-500 bg-surface p-8 shadow-md">
          <span className="material-symbols-outlined text-6xl text-orange-500" aria-hidden="true">text_fields</span>
          <div>
            <p className="text-3xl font-bold">Type your answer on your phone</p>
            <p className="mt-1 text-xl text-ink-muted">{type === 'numeric' ? 'Numbers only. No units.' : 'Spelling counts, capital letters do not.'}</p>
          </div>
        </div>
      )}
    </Stage>
  )
}

// The typed answers people gave, grouped the way the server matches them, most common first.
function typedGroups(answers) {
  const groups = new Map()
  for (const a of answers) {
    if (!a.answer_text) continue
    const key = normaliseText(a.answer_text) || a.answer_text.trim()
    const entry = groups.get(key) ?? { text: a.answer_text.trim(), count: 0, correct: false }
    entry.count += 1
    if (a.correct === true) entry.correct = true
    groups.set(key, entry)
  }
  return [...groups.values()].sort((x, y) => y.count - x.count).slice(0, 6)
}

function RevealScreen({ title, question, index, total, counts, answers, playersById, questionStartedAt, playerCount, onNext, busy, isLast, auto }) {
  const type = question.type ?? 'multiple'
  const choice = isChoiceType(type)
  const scored = type !== 'poll'
  const max = Math.max(1, ...counts)
  const rightCount = answers.filter((a) => a.correct === true).length
  const percentCorrect = answers.length > 0 ? Math.round((rightCount / answers.length) * 100) : 0
  const startMs = new Date(questionStartedAt).getTime()
  const fastest = answers
    .filter((a) => a.correct === true)
    .map((a) => ({ ...a, ms: new Date(a.answered_at).getTime() - startMs }))
    .filter((a) => Number.isFinite(a.ms))
    .sort((a, b) => a.ms - b.ms)[0]
  const fastestName = fastest ? playersById.get(fastest.player_id)?.nickname : null
  const topVote = Math.max(...counts, 0)
  const groups = useMemo(() => (choice ? [] : typedGroups(answers)), [choice, answers])
  const shownAnswer = type === 'numeric' ? String(Number(question.numeric_answer)) : (question.accepted_answers ?? [])[0]

  const stats = scored
    ? [
        { icon: 'target', label: 'Got it right', value: `${percentCorrect}%` },
        { icon: 'bolt', label: 'Fastest correct', value: fastestName ? `${fastestName} · ${(fastest.ms / 1000).toFixed(1)}s` : '—' },
        { icon: 'groups', label: 'Answered', value: `${answers.length} of ${playerCount}` },
      ]
    : [
        { icon: 'groups', label: 'Voted', value: `${answers.length} of ${playerCount}` },
        { icon: 'how_to_vote', label: 'Most popular', value: topVote > 0 ? question.options[counts.indexOf(topVote)] : '—' },
      ]

  return (
    <Stage
      title={title}
      chip={<Chip>Question {index + 1} of {total} · {scored ? "Time's up" : 'Poll results'}</Chip>}
      footer={
        <>
          <AutoAdvance auto={auto} />
          <ActionButton onClick={onNext} disabled={busy} icon="arrow_forward">{withCountdown(isLast ? 'Final standings' : 'Leaderboard', auto)}</ActionButton>
        </>
      }
    >
      <QuestionHeading question={toView(question)} size="small" />

      {choice ? (
        <AnswerTiles question={question}>
          {(option, i) => {
            const correct = scored && i === question.correct_index
            const popular = !scored && counts[i] === topVote && topVote > 0
            return (
              <div
                key={i}
                className={[
                  'flex flex-col justify-between gap-4 rounded-3xl p-6 text-white shadow-lg transition-all',
                  OPTION_STYLES[i].bg,
                  correct || popular ? 'qz-pop scale-[1.02] ring-8 ring-ink-900' : scored ? 'opacity-40' : '',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-4 text-2xl font-bold sm:text-3xl">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-black/20">
                      {correct ? <span className="material-symbols-outlined text-4xl" aria-hidden="true">check</span> : <AnswerShape index={i} className="h-8 w-8" />}
                    </span>
                    <MathText>{option}</MathText>
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
      ) : (
        <div className="mx-auto grid w-full max-w-5xl gap-4 lg:grid-cols-2">
          <div className="qz-pop flex flex-col justify-center gap-2 rounded-3xl bg-green-700 p-8 text-white shadow-lg">
            <p className="flex items-center gap-2 text-lg font-bold uppercase tracking-[0.12em] text-white/80">
              <span className="material-symbols-outlined" aria-hidden="true">check</span>
              Correct answer
            </p>
            <p className="break-words text-5xl font-bold sm:text-6xl">{shownAnswer}</p>
            {type === 'numeric' && Number(question.numeric_tolerance) > 0 && <p className="text-lg text-white/80">Anything within ±{Number(question.numeric_tolerance)} counted.</p>}
            {type === 'text' && (question.accepted_answers ?? []).length > 1 && (
              <p className="text-lg text-white/80">Also accepted: {(question.accepted_answers ?? []).slice(1).join(', ')}</p>
            )}
          </div>
          <div className="rounded-3xl border border-hairline bg-surface p-6 shadow-md">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.1em] text-ink-muted">What people typed</p>
            {groups.length === 0 ? (
              <p className="text-lg text-ink-muted">Nobody answered.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {groups.map((g) => (
                  <li key={g.text} className={`flex items-center gap-3 rounded-xl px-4 py-2 text-xl font-semibold ${g.correct ? 'bg-green-600/15 text-green-600' : 'bg-surface-low'}`}>
                    <span className="material-symbols-outlined" aria-hidden="true">{g.correct ? 'check_circle' : 'close'}</span>
                    <span className="min-w-0 flex-1 truncate">{g.text}</span>
                    <span className="tabular-nums">{g.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
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

// The leaderboard replays the round: rows start in last round's order with last round's scores, the scores count up,
// then the rows slide into their new places. Risers spring up and their characters jump; fallers sink and look sad.
const ROW_H = 88
const ROW_GAP = 12
const PITCH = ROW_H + ROW_GAP
const SHOWN = 5
const COUNT_DELAY_MS = 450
const COUNT_MS = 900
const REORDER_AFTER_MS = 1500
const REORDER_MS = 850

function ScoreCounter({ from, to, className }) {
  const value = useCountUp(from, to, { durationMs: COUNT_MS, delayMs: COUNT_DELAY_MS })
  return <span className={className}>{formatScore(value)}</span>
}

function AnimatedBoard({ players, gains }) {
  const streaks = useMemo(() => new Map(players.map((p) => [p.id, p.streak ?? 0])), [players])
  const [phase, setPhase] = useState('before')
  useEffect(() => {
    const timer = setTimeout(() => setPhase('after'), REORDER_AFTER_MS)
    return () => clearTimeout(timer)
  }, [])

  const rows = useMemo(() => {
    const now = rankPlayers(players)
    const before = rankPlayers(players.map((p) => ({ ...p, total_score: p.total_score - (gains.get(p.id) ?? 0) })))
    const beforeIndex = new Map(before.map((p, i) => [p.id, i]))
    const beforeRank = new Map(before.map((p) => [p.id, p.rank]))
    return now.map((p, i) => ({
      ...p,
      index: i,
      beforeIndex: beforeIndex.get(p.id) ?? i,
      beforeRank: beforeRank.get(p.id) ?? p.rank,
      gain: gains.get(p.id) ?? 0,
    }))
  }, [players, gains])

  const visible = rows.filter((r) => r.index < SHOWN || r.beforeIndex < SHOWN)
  const height = Math.max(1, Math.min(SHOWN, rows.length)) * PITCH - ROW_GAP
  const after = phase === 'after'

  return (
    <ol className="relative mx-auto w-full max-w-4xl" style={{ height }}>
      {visible.map((p) => {
        const position = after ? p.index : p.beforeIndex
        const rank = after ? p.rank : p.beforeRank
        const moved = p.beforeRank - p.rank
        const rising = after && moved > 0
        const falling = after && moved < 0
        const mood = rank === 1 && after ? 'dance' : rising ? 'happy' : falling ? 'sad' : 'idle'
        return (
          <li
            key={p.id}
            className="absolute inset-x-0 top-0"
            style={{
              height: ROW_H,
              transform: `translateY(${position * PITCH}px)`,
              opacity: position < SHOWN ? 1 : 0,
              zIndex: rising ? 2 : 1,
              transition: `transform ${REORDER_MS}ms ${rising ? 'cubic-bezier(0.2, 1.25, 0.35, 1)' : 'cubic-bezier(0.4, 0, 0.2, 1)'}, opacity 400ms ease`,
            }}
          >
            <div
              className={[
                'qz-rise flex h-full items-center gap-3 rounded-2xl border px-4 shadow-sm transition-colors duration-500 sm:gap-4 sm:px-5',
                rank === 1 ? 'border-orange-500 bg-orange-500/10' : rising ? 'border-green-600 bg-green-600/10' : falling ? 'border-red-600/60 bg-surface' : 'border-hairline bg-surface',
              ].join(' ')}
              style={{ animationDelay: `${Math.min(p.beforeIndex, SHOWN) * 70}ms` }}
            >
              <span className="w-12 shrink-0 text-center text-3xl font-bold" aria-label={`Rank ${rank}`}>{MEDALS[rank - 1] ?? rank}</span>
              <Avatar name={p.nickname} avatarId={p.avatar_id} mood={mood} className="h-14 w-14 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-2xl font-bold sm:text-3xl">{p.nickname}</span>
              {(streaks.get(p.id) ?? 0) >= 3 && (
                <span className="qz-pop hidden items-center gap-1 rounded-full bg-orange-500/15 px-3 py-1 text-lg font-bold text-orange-500 sm:flex" aria-label={`${streaks.get(p.id)} in a row`}>
                  <span aria-hidden="true">🔥</span>
                  {streaks.get(p.id)}
                </span>
              )}
              {after && moved !== 0 && (
                <span
                  className={`qz-pop hidden items-center text-lg font-bold sm:flex ${moved > 0 ? 'text-green-600' : 'text-red-600'}`}
                  aria-label={moved > 0 ? `Up ${moved}` : `Down ${-moved}`}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">{moved > 0 ? 'arrow_upward' : 'arrow_downward'}</span>
                  {Math.abs(moved)}
                </span>
              )}
              {p.gain > 0 && (
                <span className="qz-pop rounded-full bg-green-600/15 px-3 py-1 text-lg font-bold text-green-600" style={{ animationDelay: `${COUNT_DELAY_MS - 150}ms` }}>
                  +{formatScore(p.gain)}
                </span>
              )}
              <ScoreCounter from={p.total_score - p.gain} to={p.total_score} className="w-28 shrink-0 text-right text-3xl font-bold tabular-nums sm:w-36 sm:text-4xl" />
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// Team scores: a bar per team, longest first. Teams with nobody on them are left out.
function TeamStandings({ teams, players, scoring, big = false }) {
  const ranked = useMemo(() => rankTeams({ teams, players, scoring }), [teams, players, scoring])
  const top = Math.max(1, ...ranked.map((t) => t.score))
  if (ranked.length === 0) return null
  return (
    <section className={`mx-auto w-full rounded-3xl border border-hairline bg-surface p-5 shadow-md ${big ? 'max-w-4xl' : 'max-w-4xl'}`} aria-label="Team standings">
      <h2 className="mb-3 text-lg font-bold uppercase tracking-[0.12em] text-ink-muted">Teams · {scoring === 'total' ? 'total score' : 'average score'}</h2>
      <ol className="flex flex-col gap-3">
        {ranked.map((t) => {
          const style = teamStyle(t.color)
          return (
            <li key={t.id} className="flex items-center gap-3">
              <span className="w-8 shrink-0 text-center text-2xl font-bold">{MEDALS[t.rank - 1] ?? t.rank}</span>
              <Avatar name={t.name} avatarId={t.avatarId} className={big ? 'h-14 w-14 shrink-0' : 'h-11 w-11 shrink-0'} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className={`truncate font-bold ${big ? 'text-3xl' : 'text-xl'}`}>{t.name}</span>
                  <span className={`shrink-0 font-bold tabular-nums ${big ? 'text-3xl' : 'text-xl'}`}>{formatScore(t.score)}</span>
                </div>
                <div className="mt-1 h-3 overflow-hidden rounded-full bg-hairline/60">
                  <div className={`h-full rounded-full transition-[width] duration-700 ${style.bg}`} style={{ width: `${(t.score / top) * 100}%` }} />
                </div>
                <div className="mt-0.5 text-xs text-ink-muted">{t.members} player{t.members === 1 ? '' : 's'}</div>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function LeaderboardScreen({ title, index, total, players, gains, question, onNext, busy, isLast, auto, teams, scoring }) {
  // If the round's points arrive a moment after the screen opens (for example after a page reload), start the replay again.
  const replayKey = [...gains.values()].join(',')
  const type = question?.type ?? 'multiple'
  const answerLabel = !question || type === 'poll'
    ? null
    : isChoiceType(type)
      ? question.options[question.correct_index]
      : type === 'numeric'
        ? String(Number(question.numeric_answer))
        : (question.accepted_answers ?? [])[0]

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
      {teams.length > 0 && <TeamStandings teams={teams} players={players} scoring={scoring} />}
      <AnimatedBoard key={replayKey} players={players} gains={gains} />
      {answerLabel && (
        <p className="mx-auto max-w-4xl text-center text-ink-muted">
          The answer to that one was <span className="font-bold text-ink-900"><MathText>{answerLabel}</MathText></span>.
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
  { place: 2, height: 'h-44 sm:h-56', block: 'qz-deep text-white', delay: 600 },
  { place: 1, height: 'h-60 sm:h-80', block: 'bg-gradient-to-b from-orange-500 to-orange-600 text-white', delay: 1000 },
  { place: 3, height: 'h-32 sm:h-40', block: 'border border-hairline bg-surface text-ink-900', delay: 200 },
]

function FinishedScreen({ title, players, teams, scoring }) {
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
      {teams.length > 0 && <TeamStandings teams={teams} players={players} scoring={scoring} big />}

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

      <SponsorStrip placement="finish" />

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
  const [teams, setTeams] = useState([])
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
  // When this screen first saw the lobby fill up; the 10-second auto-start counts from here.
  const fullRef = useRef({ key: '', ms: 0 })
  // The latest game row and "a move is in flight" flag, read by advance(). Timers and live updates call advance() later
  // than the render that created them, so it must not rely on the values captured at that render.
  const sessionRef = useRef(null)
  const busyRef = useRef(false)

  const applySession = useCallback((row, live) => {
    sessionRef.current = row
    setSession(row)
    if (row.full_at && fullRef.current.key !== row.full_at) {
      fullRef.current = { key: row.full_at, ms: live ? Date.now() : new Date(row.full_at).getTime() }
    }
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
    const { data } = await supabase.from('quiz_players').select('id, nickname, total_score, avatar_id, streak, team_id').eq('session_id', sessionId)
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
        if (data.team_mode) {
          const { data: teamRows } = await supabase.from('quiz_teams').select('*').eq('session_id', sessionId).order('position')
          if (!cancelled && teamRows) setTeams(teamRows)
        }
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
        .select('player_id, chosen_index, points_awarded, answered_at, answer_text, correct')
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

  // Refresh everyone's totals as soon as the reveal shows, so the leaderboard that follows starts from settled scores.
  useEffect(() => {
    if (state === 'reveal') loadPlayers()
  }, [state, loadPlayers])

  useEffect(() => {
    const lobbyFull = state === 'lobby' && Boolean(session?.full_at)
    if (state !== 'question' && state !== 'reveal' && state !== 'leaderboard' && !lobbyFull) return undefined
    const timer = setInterval(() => setNowMs(Date.now()), 250)
    return () => clearInterval(timer)
  }, [state, session?.full_at])

  // After the reveal and after the leaderboard the game moves on by itself, so the host does not have to keep
  // clicking. The last leaderboard finishes the game. The server ignores a repeat, so a click at the same moment is harmless.
  useEffect(() => {
    if (!autoOn || (state !== 'reveal' && state !== 'leaderboard')) return undefined
    const timer = setTimeout(() => advance(), AUTO_ADVANCE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOn, state, session?.current_question_index])

  // A full lobby starts by itself after 10 seconds (the host can press Start sooner, or pause this).
  useEffect(() => {
    if (!autoOn || state !== 'lobby' || !session?.full_at) return undefined
    const wait = Math.max(0, FULL_LOBBY_COUNTDOWN_MS - (Date.now() - fullRef.current.ms))
    const timer = setTimeout(() => advance(), wait)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOn, state, session?.full_at])

  async function advance() {
    const current = sessionRef.current
    if (busyRef.current || !current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    try {
      const { session: next } = await hostAction('advance', {
        sessionId,
        expectedState: current.state,
        expectedIndex: current.current_question_index,
      })
      applySession(next, true)
    } catch (e) {
      if (e.status === 409 && e.data?.session) applySession(e.data.session, true)
      else setError(e.message)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const paused = Boolean(session?.paused_at)
  // Host controls (kick, lock, pause, extra time, skip, rename). They share the "one move at a time" guard with advance().
  async function runOp(op, extra = {}, onStep = false) {
    const current = sessionRef.current
    if (busyRef.current || !current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    try {
      const body = onStep ? { expectedState: current.state, expectedIndex: current.current_question_index, ...extra } : extra
      const result = await hostOp(op, sessionId, body)
      if (result.session) applySession(result.session, true)
      if (op === 'kick' || op === 'rename') loadPlayers()
    } catch (e) {
      if (e.status === 409 && e.data?.session) applySession(e.data.session, true)
      else setError(e.message)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const playerCountRef = useRef(0)
  playerCountRef.current = players.length

  // Keyboard shortcuts for the person at the laptop: Space moves on, P pauses, L locks the lobby, + adds time.
  useEffect(() => {
    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target
      if (target && (/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(target.tagName) || target.isContentEditable)) return
      const current = sessionRef.current
      if (!current) return
      const key = e.key.toLowerCase()
      if (key === ' ') {
        e.preventDefault()
        if (current.state === 'lobby' && playerCountRef.current === 0) return
        advance()
      } else if (key === 'p' && current.state === 'question') runOp(current.paused_at ? 'resume' : 'pause', {}, true)
      else if (key === 'l' && current.state === 'lobby') runOp(current.locked ? 'unlock' : 'lock')
      else if ((key === '+' || key === '=') && current.state === 'question') runOp('extend', {}, true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const remaining = question
    ? secondsRemaining({
        startedAtMs: startedRef.current.ms,
        timeLimitSeconds: question.time_limit_seconds,
        nowMs,
        bonusMs: session.time_bonus_ms ?? 0,
        pausedMs: session.paused_total_ms ?? 0,
        frozenElapsedMs: elapsedAtPauseMs(session),
      })
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

  // ---- Sound: music in the lobby and during questions, a tick at the end, stings at each step ----
  const soundCfg = sanitizeTheme(session?.theme).sound
  const soundPrefs = useSyncExternalStore(quizSound.subscribe, quizSound.getSnapshot)
  const rightShare = answers.length > 0 ? Math.round((answers.filter((a) => a.correct === true).length / answers.length) * 100) : 0
  const rightShareRef = useRef(0)
  rightShareRef.current = rightShare
  const questionType = question?.type ?? 'multiple'
  const prevStateRef = useRef(null)

  useEffect(() => {
    // Any click on the page counts as the "allow sound" click the browser needs.
    const unlock = () => quizSound.unlock()
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      quizSound.stopMusic()
    }
  }, [])

  useEffect(() => {
    const playing = soundCfg.music !== 'off' && (state === 'lobby' || state === 'question') && !paused
    if (playing) quizSound.startMusic(soundCfg.music, { quiet: state === 'question' })
    else quizSound.stopMusic()
  }, [soundCfg.music, state, paused, soundPrefs.unlocked])

  useEffect(() => {
    const prev = prevStateRef.current
    prevStateRef.current = state ?? null
    if (!soundCfg.effects || !state) return undefined
    const name = stateSound(prev, state)
    if (name) quizSound.play(name)
    if (state === 'reveal' && prev === 'question' && questionType !== 'poll') {
      const timer = setTimeout(() => quizSound.play(revealSting(rightShareRef.current)), 650)
      return () => clearTimeout(timer)
    }
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  useEffect(() => {
    if (state !== 'question' || paused || !soundCfg.effects) return
    const name = tickSound(remaining)
    if (name) quizSound.play(name)
  }, [remaining, state, paused, soundCfg.effects])

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
    const fullLeft = session.full_at
      ? autoSecondsLeft({ enteredMs: fullRef.current.ms, nowMs, totalMs: FULL_LOBBY_COUNTDOWN_MS })
      : null
    screen = (
      <Lobby
        session={session}
        title={quizTitle}
        players={players}
        questionCount={questions.length}
        onStart={advance}
        busy={busy}
        maxPlayers={session.max_players}
        fullLeft={fullLeft}
        auto={auto}
        teams={teams}
        locked={Boolean(session.locked)}
        onToggleLock={() => runOp(session.locked ? 'unlock' : 'lock')}
        onKick={(player, block) => runOp('kick', { playerId: player.id, block })}
        onRename={(player) => runOp('rename', { playerId: player.id })}
      />
    )
  } else if (session.state === 'question' && question) {
    screen = (
      <QuestionScreen
        {...shared}
        question={question}
        remaining={remaining}
        answered={answers.length}
        playerCount={players.length}
        onEnd={advance}
        paused={paused}
        onTogglePause={() => runOp(paused ? 'resume' : 'pause', {}, true)}
        onExtend={() => runOp('extend', {}, true)}
        canExtend={(session.time_bonus_ms ?? 0) < 60000}
        onSkip={() => runOp('skip', {}, true)}
      />
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
    screen = <LeaderboardScreen {...shared} players={players} gains={gains} question={question} onNext={advance} isLast={isLast} auto={auto} teams={teams} scoring={session.team_scoring} />
  } else {
    screen = <FinishedScreen title={quizTitle} players={players} teams={teams} scoring={session.team_scoring} />
  }

  return (
    <QuizThemeScope theme={session.theme}>
      {screen}
      {error && (
        <div role="alert" className="fixed bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-2xl bg-danger px-5 py-3 text-white shadow-lg">
          {error}
        </div>
      )}
    </QuizThemeScope>
  )
}
