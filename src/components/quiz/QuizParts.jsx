import { memo, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { brandingUrl } from '../../data/quizBranding'
import { quizSound } from '../../lib/quizSound'
import { avatarStyle, initialOf } from '../../data/quiz'
import QuizThemeToggle from './QuizThemeToggle'
import Character from './Character'
import { useQuizTheme } from './QuizTheme'

// Small building blocks shared by the host (projector) and player (phone) quiz screens.

const SHAPES = [
  <path key="t" d="M12 3 22 20H2z" />,
  <path key="d" d="M12 2 22 12 12 22 2 12z" />,
  <circle key="c" cx="12" cy="12" r="10" />,
  <rect key="s" x="3" y="3" width="18" height="18" rx="2" />,
]

// White answer shape (triangle, diamond, circle, square) so the game never depends on colour alone.
export function AnswerShape({ index, className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 24 24" className={`fill-white ${className}`} aria-hidden="true">
      {SHAPES[index]}
    </svg>
  )
}

// A player's character (avatarId 0-49). Older games without a character fall back to a coloured initial.
// Memoised: the projector screens re-render several times a second, and redrawing the SVG each time made animations stutter.
export const Avatar = memo(function Avatar({ name, avatarId, mood = 'idle', className = 'h-10 w-10 text-lg' }) {
  if (avatarId !== undefined && avatarId !== null) {
    return (
      <span className={`inline-block shrink-0 ${className}`}>
        <Character id={avatarId} mood={mood} />
      </span>
    )
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ${avatarStyle(name).bg} ${className}`}
      aria-hidden="true"
    >
      {initialOf(name)}
    </span>
  )
})

// The NAMMES mark, or the event's own logo when one was uploaded in the studio.
export function BrandMark({ className = 'h-9 w-9' }) {
  const { logo } = useQuizTheme()
  return <img src={logo ? brandingUrl(logo) : '/logo-small.png'} alt="" className={`rounded-lg object-contain ${className}`} />
}

// "Presented with" logos for the projector (never on phones). More than four rotate in groups of four.
// Sponsor logos, on the lobby and the final screen. The tile is h-24 with an 80px logo, which is roughly a sixth of the
// projector's height: big enough to read across a room, and four of them plus the gaps still fit a 960px lobby.
export function SponsorStrip({ placement, className = '' }) {
  const { sponsors, showSponsors } = useQuizTheme()
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(sponsors.length / 4))
  useEffect(() => {
    if (pages < 2) return undefined
    const timer = setInterval(() => setPage((p) => (p + 1) % pages), 6000)
    return () => clearInterval(timer)
  }, [pages])
  if (sponsors.length === 0 || !showSponsors[placement]) return null
  const shown = sponsors.slice((page % pages) * 4, (page % pages) * 4 + 4)
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`} aria-label="Sponsors">
      <span className="text-xs font-bold uppercase tracking-[0.18em] text-ink-muted">Presented with</span>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {shown.map((s) => (
          <span key={s.path} className="flex h-24 items-center rounded-xl bg-white px-5 shadow-sm ring-1 ring-black/5">
            <img src={brandingUrl(s.path)} alt={s.name} className="max-h-20 w-auto max-w-[16rem] object-contain" />
          </span>
        ))}
      </div>
    </div>
  )
}

// A round countdown. Turns red and pulses when time is nearly up.
export function CountdownRing({ seconds, total, size = 96, stroke = 9 }) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const fraction = total > 0 ? Math.min(1, Math.max(0, seconds / total)) : 0
  const urgent = seconds <= 5
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center ${urgent && seconds > 0 ? 'qz-urgent' : ''}`}
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`${seconds} seconds left`}
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90" width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-hairline" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          className={`transition-[stroke-dashoffset] duration-300 ease-linear ${urgent ? 'stroke-red-600' : 'stroke-orange-500'}`}
        />
      </svg>
      <span
        className={`absolute font-bold leading-none ${urgent ? 'text-red-600' : 'text-ink-900'}`}
        style={{ fontSize: size * 0.4 }}
      >
        {seconds}
      </span>
    </div>
  )
}

const GLYPHS = ['π', 'Σ', '∫', '√', 'Δ', 'λ', 'θ', '∞', '≈', '±']
const SPARKLES = ['✦', '✧', '★', '✶']

// Faint symbols scattered behind the page. Positions come from the index so it renders the same every time.
function GlyphField({ glyphs, count = 14, opacity, scale }) {
  const items = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        glyph: glyphs[i % glyphs.length],
        left: (i * 37 + 8) % 92,
        top: (i * 53 + 5) % 90,
        size: (28 + ((i * 17) % 44)) * scale,
        rotate: ((i * 41) % 50) - 25,
      })),
    [glyphs, count, scale],
  )
  return items.map((item, i) => (
    <span
      key={i}
      className="absolute select-none font-bold text-brand"
      style={{ left: `${item.left}%`, top: `${item.top}%`, fontSize: item.size, opacity, transform: `rotate(${item.rotate}deg)` }}
    >
      {item.glyph}
    </span>
  ))
}

const WAVE = 'M0 40Q90 0 180 40T360 40T540 40T720 40V80H0z'

// The page background chosen in the studio: a soft two-colour glow plus one pattern or the admin's own picture, kept
// faint so text always stays clear. This layer sits at `-z-10`, so every element that mounts it has to open its own
// stacking context (`isolate`). Without that the negative z-index escapes to the root, paints underneath the wrapper's own
// `bg-paper` and is never seen — which is how every live screen hid its backdrop while the studio preview looked fine,
// because a scaled frame happens to create a stacking context as a side effect. quizBackdrop.test.js fails the build if
// a screen is wired up without it.
//
// `surface` decides whether an uploaded picture is drawn. Phones pass nothing and so get 'phone', which means forgetting
// the prop can only ever leave the picture off the projector, never push it onto fifty players' screens.
export function QuizBackdrop({ surface = 'phone' }) {
  const { pattern, image, backdropOpacity, backdropScale, backdropBlur, backdropDim, backdropFit } = useQuizTheme()
  const photo = surface === 'projector' && pattern === 'image' && image ? brandingUrl(image) : null
  const opacity = backdropOpacity / 100
  const scale = backdropScale / 100
  // A blurred layer fades to nothing at its own edge, so it is grown by the blur radius to keep the corners filled.
  const softened = { filter: backdropBlur > 0 ? `blur(${backdropBlur}px)` : undefined, inset: backdropBlur > 0 ? `-${backdropBlur}px` : 0 }
  // A picture has to reach every corner, so its zoom starts at 1 and only ever crops in further. Letting the size slider
  // scale it below 1 would shrink the whole picture away from the edges and leave the page showing through.
  const photoZoom = Math.max(1, scale)
  const fit = { cover: 'object-cover', contain: 'object-contain', stretch: 'object-fill' }[backdropFit] ?? 'object-cover'

  return (
    <div
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      aria-hidden="true"
      style={{
        backgroundImage:
          'radial-gradient(60rem 40rem at 0% -10%, color-mix(in srgb, var(--qz-glow-a, #ff5a1f) 14%, transparent), transparent 70%), radial-gradient(50rem 36rem at 100% 0%, color-mix(in srgb, var(--qz-glow-b, #0b2417) 12%, transparent), transparent 70%)',
      }}
    >
      {photo ? (
        <div className="absolute overflow-hidden" style={softened}>
          <img src={photo} alt="" className={`h-full w-full ${fit}`} style={{ opacity, transform: `scale(${photoZoom})` }} />
        </div>
      ) : (
        <div className="absolute overflow-hidden" style={softened}>
          {pattern === 'math' && <GlyphField glyphs={GLYPHS} opacity={opacity} scale={scale} />}
          {pattern === 'stars' && <GlyphField glyphs={SPARKLES} count={18} opacity={opacity} scale={scale} />}
          {pattern === 'dots' && (
            <div
              className="absolute inset-0 text-brand"
              style={{ opacity, backgroundImage: 'radial-gradient(currentColor 1.6px, transparent 1.8px)', backgroundSize: `${26 * scale}px ${26 * scale}px` }}
            />
          )}
          {pattern === 'grid' && (
            <div
              className="absolute inset-0 text-brand"
              style={{
                opacity,
                backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
                backgroundSize: `${44 * scale}px ${44 * scale}px`,
              }}
            />
          )}
          {pattern === 'waves' && (
            <svg className="absolute inset-x-0 bottom-0 w-full text-brand" viewBox="0 0 720 80" preserveAspectRatio="none" style={{ opacity, height: `${14 * scale}rem` }}>
              <path d={WAVE} fill="currentColor" />
              <path d={WAVE} fill="currentColor" transform="translate(-140 14)" />
            </svg>
          )}
        </div>
      )}
      {/* A picture is a picture: this washes it back towards the page colour so a photo can never swallow the text. */}
      {photo && backdropDim > 0 && <div className="absolute inset-0 bg-paper" style={{ opacity: backdropDim / 100 }} />}
    </div>
  )
}

const CONFETTI_COLORS = ['text-red-600', 'text-blue-600', 'text-amber-500', 'text-green-600', 'text-orange-500']
const CONFETTI_GLYPHS = {
  math: [...GLYPHS, '★', '✦'],
  stars: ['★', '✦', '✧', '✶', '✷'],
  petals: ['❀', '✿', '❁', '✾', '❃'],
}

// Symbols raining down for the winners, in the style chosen in the studio (or none).
export function Confetti({ count = 36 }) {
  const { confetti } = useQuizTheme()
  const glyphs = CONFETTI_GLYPHS[confetti]
  const pieces = useMemo(
    () =>
      glyphs
        ? Array.from({ length: count }, (_, i) => ({
            glyph: glyphs[i % glyphs.length],
            left: (i * 29 + 3) % 100,
            size: 16 + ((i * 13) % 22),
            delay: ((i * 7) % 30) / 10,
            duration: 4 + ((i * 11) % 30) / 10,
            color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          }))
        : [],
    [count, glyphs],
  )
  if (!glyphs) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className={`qz-fall absolute top-0 font-bold ${p.color}`}
          style={{ left: `${p.left}%`, fontSize: p.size, animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s` }}
        >
          {p.glyph}
        </span>
      ))}
    </div>
  )
}

// Speaker button and volume for the host. Browsers keep sound off until someone clicks, so it starts as "Turn on sound".
export function SoundControl() {
  const prefs = useSyncExternalStore(quizSound.subscribe, quizSound.getSnapshot)
  if (!quizSound.isSupported()) return null
  if (!prefs.unlocked) {
    return (
      <button
        type="button"
        onClick={() => quizSound.unlock()}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-hairline bg-surface px-4 py-2 text-sm font-bold text-ink-900 hover:bg-surface-low"
      >
        <span className="material-symbols-outlined" aria-hidden="true">volume_up</span>
        Turn on sound
      </button>
    )
  }
  return (
    <div className="flex items-center gap-2 rounded-full border border-hairline bg-surface py-1 pl-1 pr-3">
      <button
        type="button"
        onClick={() => quizSound.setMuted(!prefs.muted)}
        aria-label={prefs.muted ? 'Unmute' : 'Mute'}
        aria-pressed={prefs.muted}
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-ink-900 hover:bg-surface-low"
      >
        <span className="material-symbols-outlined" aria-hidden="true">{prefs.muted ? 'volume_off' : 'volume_up'}</span>
      </button>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={prefs.volume}
        onChange={(e) => quizSound.setVolume(Number(e.target.value))}
        aria-label="Volume"
        className="hidden w-24 accent-orange-500 sm:block"
      />
    </div>
  )
}

// Slim top bar for both screens. The theme switch lives here so it never covers anything.
export function QuizTopBar({ title, children, compact = false }) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-hairline bg-paper/85 px-4 py-3 backdrop-blur sm:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <BrandMark />
        <div className={`min-w-0 leading-tight ${compact ? 'hidden' : ''}`}>
          <div className="text-sm font-bold uppercase tracking-[0.12em] text-ink-900">NAMMES Live Quiz</div>
          {title && <div className="truncate text-xs text-ink-muted">{title}</div>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {children}
        <QuizThemeToggle />
      </div>
    </header>
  )
}
