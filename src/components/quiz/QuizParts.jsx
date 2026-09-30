import { useMemo } from 'react'
import { avatarStyle, initialOf } from '../../data/quiz'
import QuizThemeToggle from './QuizThemeToggle'
import Character from './Character'

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
export function Avatar({ name, avatarId, mood = 'idle', className = 'h-10 w-10 text-lg' }) {
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
}

export function BrandMark({ className = 'h-9 w-9' }) {
  return <img src="/logo-small.png" alt="" className={`rounded-lg object-contain ${className}`} />
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

// Very faint maths symbols behind the page: a nod to the department without hurting legibility.
export function MathBackdrop() {
  const items = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        glyph: GLYPHS[i % GLYPHS.length],
        left: (i * 37 + 8) % 92,
        top: (i * 53 + 5) % 90,
        size: 28 + ((i * 17) % 44),
        rotate: ((i * 41) % 50) - 25,
      })),
    [],
  )
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {items.map((item, i) => (
        <span
          key={i}
          className="absolute select-none font-bold text-brand opacity-[0.05]"
          style={{ left: `${item.left}%`, top: `${item.top}%`, fontSize: item.size, transform: `rotate(${item.rotate}deg)` }}
        >
          {item.glyph}
        </span>
      ))}
    </div>
  )
}

const CONFETTI_COLORS = ['text-red-600', 'text-blue-600', 'text-amber-500', 'text-green-600', 'text-orange-500']

// Maths symbols raining down for the winners. Positions come from the index so it renders the same every time.
export function Confetti({ count = 36 }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        glyph: [...GLYPHS, '★', '✦'][i % (GLYPHS.length + 2)],
        left: (i * 29 + 3) % 100,
        size: 16 + ((i * 13) % 22),
        delay: ((i * 7) % 30) / 10,
        duration: 4 + ((i * 11) % 30) / 10,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      })),
    [count],
  )
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
