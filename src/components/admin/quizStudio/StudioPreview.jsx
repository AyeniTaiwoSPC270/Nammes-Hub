import { useEffect, useRef, useState } from 'react'
import { OPTION_STYLES } from '../../../data/quiz'
import { QuizThemeScope } from '../../quiz/QuizTheme'
import { AnswerShape, Avatar, BrandMark, Confetti, CountdownRing, QuizBackdrop, SponsorStrip } from '../../quiz/QuizParts'

// Mock-ups of the real quiz screens, drawn at their real size and scaled down to fit, so the studio shows what the
// projector and the phones will look like with the look being designed. Sample names and scores only.

const PLAYERS = [
  { name: 'Ada_Pi', id: 3, score: 4480 },
  { name: 'Bayo_Sigma', id: 7, score: 4148 },
  { name: 'Chidi_Euler', id: 14, score: 3674 },
  { name: 'Emeka_Sine', id: 22, score: 2984 },
  { name: 'Funmi_Theta', id: 41, score: 1618 },
]
const OPTIONS = ['Eigenvalues', 'Derivatives', 'Matrices', 'Integrals']
const CODE = ['4', '8', '2', '9', '1', '3']

export const PROJECTOR_SCREENS = { lobby: 'Lobby', question: 'Question', leaderboard: 'Leaderboard', podium: 'Finish' }
export const PHONE_SCREENS = { lobby: 'Lobby', question: 'Question', result: 'Result' }

function Frame({ width, height, maxWidth, children }) {
  const ref = useRef(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [width])
  return (
    <div ref={ref} className="mx-auto w-full" style={{ maxWidth: maxWidth ?? width, height: height * scale }}>
      <div
        className="relative overflow-hidden rounded-2xl border border-hairline bg-paper text-ink-900 shadow-md"
        style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}
      >
        {children}
      </div>
    </div>
  )
}

function MiniBar({ title }) {
  return (
    <div className="flex items-center gap-3 border-b border-hairline bg-paper/85 px-8 py-3">
      <BrandMark />
      <div className="leading-tight">
        <div className="text-sm font-bold uppercase tracking-[0.12em]">NAMMES Live Quiz</div>
        <div className="text-xs text-ink-muted">{title}</div>
      </div>
    </div>
  )
}

function ProjectorLobby({ theme, title }) {
  return (
    <div className="grid grid-cols-[1fr_280px] gap-5 p-6">
      <section className="qz-deep flex flex-col justify-between rounded-3xl p-8 text-white shadow-xl" style={{ minHeight: 380 }}>
        <div>
          {theme.headline && <h2 className="mb-3 text-4xl font-bold leading-tight">{theme.headline}</h2>}
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange-100/80">Join the game</p>
          <p className="mt-1 text-xl font-semibold">
            Go to <span className="text-orange-100">nammeshub.com.ng/play</span> and enter
          </p>
          {theme.tagline && <p className="mt-2 text-lg text-white/80">{theme.tagline}</p>}
        </div>
        <div className="flex items-center gap-2">
          {CODE.map((d, i) => (
            <span key={i} className="contents">
              {i === 3 && <span className="mx-1 text-3xl font-bold text-white/40">·</span>}
              <span className="flex h-20 w-14 items-center justify-center rounded-2xl bg-white/12 text-5xl font-bold ring-1 ring-white/20">{d}</span>
            </span>
          ))}
        </div>
        <p className="text-sm text-white/70">{title || 'Your quiz'}</p>
      </section>
      <section className="rounded-3xl border border-hairline bg-surface p-4 shadow-md">
        <p className="text-sm font-bold uppercase tracking-[0.1em] text-ink-muted">Players 12 / 50</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[3, 7, 14, 22, 41, 9, 30, 18, 26].map((id) => (
            <Avatar key={id} avatarId={id} name="" className="h-16 w-16" />
          ))}
        </div>
      </section>
    </div>
  )
}

function ProjectorLobbySponsors() {
  return <SponsorStrip placement="lobby" className="col-span-2 -mt-2" />
}

function ProjectorQuestion() {
  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-orange-500 px-4 py-2 text-sm font-bold text-white">Question 2 of 10</span>
        <CountdownRing seconds={14} total={20} size={76} stroke={8} />
      </div>
      <h2 className="text-center text-3xl font-bold">Which topic finds the special scalars of a matrix?</h2>
      <div className="grid grid-cols-2 gap-3">
        {OPTIONS.map((text, i) => (
          <div key={text} className={`flex items-center gap-3 rounded-2xl px-5 py-5 text-xl font-bold text-white ${OPTION_STYLES[i].bg}`}>
            <AnswerShape index={i} className="h-8 w-8" />
            {text}
          </div>
        ))}
      </div>
    </div>
  )
}

function ProjectorBoard() {
  return (
    <div className="flex flex-col gap-3 p-6">
      <h2 className="text-3xl font-bold">Leaderboard</h2>
      {PLAYERS.map((p, i) => (
        <div key={p.name} className="flex items-center gap-4 rounded-2xl border border-hairline bg-surface px-4 py-2 shadow-sm">
          <span className="w-8 text-center text-2xl font-bold text-orange-500">{i + 1}</span>
          <Avatar avatarId={p.id} name={p.name} mood={i === 0 ? 'happy' : 'idle'} className="h-12 w-12" />
          <span className="flex-1 text-xl font-semibold">{p.name}</span>
          <span className="text-2xl font-bold tabular-nums">{p.score.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

function ProjectorPodium() {
  const podium = [
    { p: PLAYERS[1], h: 120, cls: 'qz-deep' },
    { p: PLAYERS[0], h: 170, cls: 'bg-gradient-to-b from-orange-500 to-orange-600' },
    { p: PLAYERS[2], h: 90, cls: 'bg-surface-low border border-hairline' },
  ]
  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <h2 className="text-3xl font-bold">And the winner is…</h2>
      <div className="flex items-end gap-4">
        {podium.map(({ p, h, cls }, i) => (
          <div key={p.name} className="flex flex-col items-center gap-1">
            <Avatar avatarId={p.id} name={p.name} mood="dance" className="h-24 w-24" />
            <span className="text-lg font-bold">{p.name}</span>
            <div className={`flex w-36 items-start justify-center rounded-t-2xl pt-3 text-4xl font-bold text-white ${cls}`} style={{ height: h }}>
              {i === 0 ? 2 : i === 1 ? 1 : 3}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PhoneLobby({ theme }) {
  return (
    <div className="flex flex-col items-center gap-3 px-5 pt-6 text-center">
      <Avatar avatarId={3} name="Ada_Pi" mood="wave" className="h-32 w-32" />
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-500">You&apos;re in</p>
      <h2 className="-mt-2 text-3xl font-bold">Ada_Pi</h2>
      {theme.headline && <p className="-mt-1 text-base font-semibold text-ink-muted">{theme.headline}</p>}
      <div className="w-full rounded-3xl border border-hairline bg-surface p-4 shadow-md">
        <p className="text-lg font-bold">Look for your name on the big screen</p>
        <p className="text-sm text-ink-muted">12 of 50 players in the lobby</p>
      </div>
      <div className="flex w-full items-start gap-3 rounded-2xl bg-orange-500/12 p-3 text-left text-sm">
        <span className="material-symbols-outlined text-orange-500" aria-hidden="true">bolt</span>
        <p><span className="font-bold">Speed counts.</span> The faster you answer correctly, the more points you earn.</p>
      </div>
    </div>
  )
}

function PhoneQuestion() {
  return (
    <div className="flex h-[calc(100%-56px)] flex-col gap-3 p-4">
      <p className="text-center text-sm font-bold uppercase tracking-[0.1em] text-ink-muted">Question 2 of 10</p>
      <div className="grid flex-1 grid-cols-2 gap-3">
        {OPTIONS.map((text, i) => (
          <div key={text} className={`flex flex-col items-center justify-center gap-2 rounded-2xl p-2 text-center text-base font-bold text-white ${OPTION_STYLES[i].bg}`}>
            <AnswerShape index={i} className="h-10 w-10" />
            {text}
          </div>
        ))}
      </div>
    </div>
  )
}

function PhoneResult() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <section className="qz-deep rounded-3xl p-5 text-center text-white shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-100/80">Your position</p>
        <Avatar avatarId={3} name="Ada_Pi" mood="happy" className="mx-auto mt-1 h-28 w-28" />
        <p className="text-5xl font-bold">#1</p>
        <p className="mt-1 text-xl font-semibold">4,480 points</p>
      </section>
      <button type="button" tabIndex={-1} className="flex min-h-12 items-center justify-center rounded-2xl bg-orange-500 px-6 text-lg font-bold text-white">
        Play again
      </button>
    </div>
  )
}

export default function StudioPreview({ theme, surface, screen, title }) {
  const projector = surface === 'projector'
  return (
    <QuizThemeScope theme={theme} className="block">
      <Frame width={projector ? 960 : 300} height={projector ? 540 : 600} maxWidth={projector ? 960 : 300}>
        <QuizBackdrop />
        <MiniBar title={title} />
        {projector ? (
          <>
            {screen === 'lobby' && (
              <>
                <ProjectorLobby theme={theme} title={title} />
                <div className="px-6"><ProjectorLobbySponsors /></div>
              </>
            )}
            {screen === 'question' && <ProjectorQuestion />}
            {screen === 'leaderboard' && <ProjectorBoard />}
            {screen === 'podium' && (
              <>
                <ProjectorPodium />
                <SponsorStrip placement="finish" className="pb-2" />
              </>
            )}
          </>
        ) : (
          <>
            {screen === 'lobby' && <PhoneLobby theme={theme} />}
            {screen === 'question' && <PhoneQuestion />}
            {screen === 'result' && <PhoneResult />}
          </>
        )}
        {/* The frame is transformed, so the fixed-position confetti falls inside it instead of over the whole window. */}
        {projector && screen === 'podium' && <Confetti count={24} />}
      </Frame>
    </QuizThemeScope>
  )
}
