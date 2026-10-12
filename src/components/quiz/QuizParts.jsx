import { memo, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { brandingUrl } from '../../data/quizBranding'
import { quizSound } from '../../lib/quizSound'
import { avatarStyle, initialOf } from '../../data/quiz'
import QuizThemeToggle from './QuizThemeToggle'
import Character from './Character'
import { useQuizTheme } from './QuizTheme'
// The backdrop's characters come from the same table the result card draws its maths from, rather than a second list
// kept in step by hand. The card now reads both tables with a full branch for each, so this line is proof the two
// renderers agree: a divergent table is caught by the guard tests in quizTheme.test.js.
import { PATTERN_GLYPHS, PATTERN_GEOMETRY } from '../../../api/_lib/quizTheme.js'
// The characters' moves live in this stylesheet, not in Character.jsx: the result card renders that same component
// to an SVG string on the server, and Node cannot parse a stylesheet. Anything that renders a Character and wants
// its animations imports this file, or imports characters.css itself.
import './characters.css'

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

// One deterministic scatter, shared by every drawn pattern so they all land in the same places at the same count.
// Positions come from the index rather than from a random number: a backdrop that rearranged itself on every reload
// would read as a bug, and a card and a screen showing the same theme put the marks in the same spots. Only the spots
// match — each renderer scales the size against its own canvas, so the marks are recognisably the same, not identical.
//
// Positions are percentages of the backdrop and sizes are in pixels, because that is what each can express without
// measuring the screen: a percentage positions, a pixel size. An SVG with no viewBox treats its numbers as pixels, so
// feeding it the percentage set left a hexagon pattern in a 350x350px box in the corner of every projector.
function scatter(count, cell, mark) {
  return Array.from({ length: count }, (_, i) => ({
    left: (i * cell + 8) % 92,
    top: (i * (cell * 1.4) + 5) % 90,
    size: mark + ((i * 13) % 12),
    rotate: ((i * 41) % 50) - 25,
  }))
}

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

const DOTS = PATTERN_GEOMETRY.dots
const GRID = PATTERN_GEOMETRY.grid
const WAVES = PATTERN_GEOMETRY.waves
const STRIPES = PATTERN_GEOMETRY.stripes
const HEX = PATTERN_GEOMETRY.hexagons
const RINGS = PATTERN_GEOMETRY.rings
const PARTY = PATTERN_GEOMETRY.party

function hexPoints(cx, cy, r) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`
  }).join(' ')
}

// Each mark sits in its own square, sized in pixels and positioned by percentage. The square is what keeps the shape
// itself correct: the SVG fills it and, with the default meet, scales the shape to fit rather than stretching it to a
// screen of some other aspect.
function ShapeField({ shape, count, cell, children }) {
  const items = useMemo(() => scatter(count, cell, shape.mark), [count, cell, shape.mark])
  return (
    <div className="absolute inset-0 text-brand" aria-hidden="true">
      {items.map((item, i) => (
        <div
          key={i}
          className="absolute"
          style={{ left: `${item.left}%`, top: `${item.top}%`, width: item.size, height: item.size, opacity: shape.opacity }}
        >
          {children(item, i)}
        </div>
      ))}
    </div>
  )
}

function HexagonField({ opacity, scale }) {
  return (
    <ShapeField shape={{ ...HEX, opacity }} count={HEX.count} cell={HEX.cell}>
      {(item, i) => (
        <svg viewBox="0 0 100 100" className="h-full w-full" fill="none" stroke="currentColor" strokeWidth={7} style={{ transform: `rotate(${item.rotate * 0.5}deg) scale(${scale})` }}>
          <polygon points={hexPoints(50, 50, 44)} />
        </svg>
      )}
    </ShapeField>
  )
}

function RingField({ opacity, scale }) {
  return (
    <ShapeField shape={{ ...RINGS, opacity }} count={RINGS.count} cell={RINGS.cell}>
      {() => (
        <svg viewBox="0 0 100 100" className="h-full w-full" fill="none" stroke="currentColor" strokeWidth={5} style={{ transform: `scale(${scale})` }}>
          {[0, 1, 2].map((r) => (
            <circle key={r} cx={50} cy={50} r={16 + r * 12} />
          ))}
        </svg>
      )}
    </ShapeField>
  )
}

// Balloons, hats, streamers and loose confetti, cycling in that order so every scatter shows all four rather than thirty
// balloons. Drawn as shapes because the card has no emoji font; see the note on PATTERN_GEOMETRY.party.
function PartyField({ opacity, scale }) {
  return (
    <ShapeField shape={{ ...PARTY, opacity }} count={PARTY.count} cell={PARTY.cell}>
      {(item, i) => {
        const r = 14 + (item.size % 6)
        const w = 60 + (item.size % 14)
        const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 7 }
        if (i % 4 === 0) {
          return (
            <svg viewBox="0 0 100 100" className="h-full w-full text-brand" style={{ transform: `rotate(${item.rotate * 0.4}deg) scale(${scale})` }} aria-hidden="true">
              <ellipse cx={50} cy={42} rx={r} ry={r * 1.2} {...common} />
              <path d={`M50 ${42 + r * 1.2}c12 16 -12 22 0 36`} {...common} />
            </svg>
          )
        }
        if (i % 4 === 1) {
          return (
            <svg viewBox="0 0 100 100" className="h-full w-full text-brand" style={{ transform: `rotate(${item.rotate}deg) scale(${scale})` }} aria-hidden="true">
              <polygon points="18,82 50,14 82,82" {...common} />
              <line x1={14} y1={82} x2={86} y2={82} stroke="currentColor" strokeWidth={7} />
            </svg>
          )
        }
        if (i % 4 === 2) {
          return (
            <svg viewBox="0 0 100 100" className="h-full w-full text-brand" style={{ transform: `scale(${scale})` }} aria-hidden="true">
              <path d={`M20 20c14 -20 14 20 0 34s-14 20 0 34s14 20 0 34`} {...common} />
            </svg>
          )
        }
        return (
          <svg viewBox="0 0 100 100" className="h-full w-full text-brand" style={{ transform: `rotate(${item.rotate}deg) scale(${scale})` }} aria-hidden="true">
            <rect x={50 - w / 6} y={26} width={w / 3} height={48} fill="currentColor" stroke="none" />
          </svg>
        )
      }}
    </ShapeField>
  )
}

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
          {pattern === 'math' && <GlyphField glyphs={PATTERN_GLYPHS.math} opacity={opacity} scale={scale} />}
          {pattern === 'notes' && <GlyphField glyphs={PATTERN_GLYPHS.notes} count={16} opacity={opacity} scale={scale} />}
          {pattern === 'stars' && <GlyphField glyphs={PATTERN_GLYPHS.stars} count={18} opacity={opacity} scale={scale} />}
          {pattern === 'dots' && (
            <div
              className="absolute inset-0 text-brand"
              style={{ opacity, backgroundImage: `radial-gradient(currentColor ${DOTS.dot}px, transparent ${DOTS.gap}px)`, backgroundSize: `${DOTS.cell * scale}px ${DOTS.cell * scale}px` }}
            />
          )}
          {pattern === 'grid' && (
            <div
              className="absolute inset-0 text-brand"
              style={{
                opacity,
                backgroundImage: `linear-gradient(currentColor ${GRID.stroke}px, transparent ${GRID.stroke}px), linear-gradient(90deg, currentColor ${GRID.stroke}px, transparent ${GRID.stroke}px)`,
                backgroundSize: `${GRID.cell * scale}px ${GRID.cell * scale}px`,
              }}
            />
          )}
          {pattern === 'waves' && (
            <svg className="absolute inset-x-0 bottom-0 w-full text-brand" viewBox={WAVES.viewBox} preserveAspectRatio="none" style={{ opacity, height: `${WAVES.band * scale}rem` }}>
              <path d={WAVES.path} fill="currentColor" />
              <path d={WAVES.path} fill="currentColor" transform={`translate(${WAVES.shift.x} ${WAVES.shift.y})`} />
            </svg>
          )}
          {pattern === 'stripes' && (
            <div
              className="absolute inset-0 text-brand"
              style={{
                opacity,
                backgroundImage: `repeating-linear-gradient(${STRIPES.angle}deg, currentColor 0, currentColor ${STRIPES.width * scale}px, transparent ${STRIPES.width * scale}px, transparent ${(STRIPES.width + STRIPES.gap) * scale}px)`,
              }}
            />
          )}
          {pattern === 'hexagons' && <HexagonField opacity={opacity} scale={scale} />}
          {pattern === 'rings' && <RingField opacity={opacity} scale={scale} />}
          {pattern === 'party' && <PartyField opacity={opacity} scale={scale} />}
        </div>
      )}
      {/* A picture is a picture: this washes it back towards the page colour so a photo can never swallow the text. */}
      {photo && backdropDim > 0 && <div className="absolute inset-0 bg-paper" style={{ opacity: backdropDim / 100 }} />}
    </div>
  )
}

const CONFETTI_COLORS = ['text-red-600', 'text-blue-600', 'text-amber-500', 'text-green-600', 'text-orange-500']
const CONFETTI_GLYPHS = {
  math: [...PATTERN_GLYPHS.math, '★', '✦'],
  stars: ['★', '✦', '✧', '✶', '✷'],
  petals: ['❀', '✿', '❁', '✾', '❃'],
  emoji: ['🎉', '🎊', '🥳', '🙌', '🎈'],
  letters: ['A', 'B', 'C', 'D'],
  money: ['💰', '🪙', '💵', '💸', '🤑'],
  notes: [...PATTERN_GLYPHS.notes, '🎶'],
  hearts: ['♥', '❤', '💕', '💖', '💗'],
}

// Coloured paper is the one style with no character in it: real confetti is a rectangle of colour spinning, and a
// glyph standing in for one would read as another emoji style. It gets a piece with a shape instead — see the renderer
// below, which is the only thing that has to know about it.
const CONFETTI_SHAPED = new Set(['paper'])

// Symbols raining down for the winners, in the style chosen in the studio (or none).
export function Confetti({ count = 36 }) {
  const { confetti } = useQuizTheme()
  const glyphs = CONFETTI_GLYPHS[confetti]
  const shaped = CONFETTI_SHAPED.has(confetti)
  const pieces = useMemo(
    () =>
      glyphs || shaped
        ? Array.from({ length: count }, (_, i) => ({
            glyph: glyphs ? glyphs[i % glyphs.length] : null,
            left: (i * 29 + 3) % 100,
            size: 16 + ((i * 13) % 22),
            delay: ((i * 7) % 30) / 10,
            duration: 4 + ((i * 11) % 30) / 10,
            spin: ((i * 23) % 60) - 30,
            color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          }))
        : [],
    [count, glyphs, shaped],
  )
  if (!glyphs && !shaped) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className={`qz-fall absolute top-0 font-bold ${p.color}`}
          style={{ left: `${p.left}%`, fontSize: p.size, animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s` }}
        >
          {p.glyph ?? <i className="block" style={{ width: p.size * 0.8, height: p.size * 1.4, background: 'currentColor', transform: `rotate(${p.spin}deg)` }} />}
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
