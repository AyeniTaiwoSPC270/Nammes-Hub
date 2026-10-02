import React from 'react'
import { AbsoluteFill, Easing, Img, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, FONT_BODY, FONT_HEAD, SHADOW, SHADOW_SOFT } from '../brand'
import { useLayout } from '../layout'

/* ------------------------------------------------------------------ motion helpers */

export const BOUNCY = { damping: 11, stiffness: 140, mass: 0.7 }
export const SNAPPY = { damping: 16, stiffness: 200, mass: 0.6 }
export const SOFT = { damping: 20, stiffness: 90, mass: 0.9 }

export function useSpr(delay = 0, config: Partial<typeof BOUNCY> = BOUNCY) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({ frame: frame - delay, fps, config })
}

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

export const ease = Easing.bezier(0.22, 1, 0.36, 1)

// Linear 0..1 progress between two frames, eased.
export function useProgress(from: number, to: number) {
  const frame = useCurrentFrame()
  return interpolate(frame, [from, to], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease })
}

/* ------------------------------------------------------------------ backgrounds */

export const Bg: React.FC<{ tone: 'dark' | 'paper' }> = ({ tone }) => {
  const frame = useCurrentFrame()
  const drift = Math.sin(frame / 50) * 18
  if (tone === 'dark') {
    return (
      <AbsoluteFill style={{ background: `linear-gradient(160deg, ${C.green950} 0%, ${C.green900} 100%)` }}>
        <div
          style={{
            position: 'absolute', inset: 0, opacity: 0.35,
            backgroundImage: `radial-gradient(${C.green700} 2px, transparent 2.5px)`,
            backgroundSize: '64px 64px', backgroundPosition: `${drift}px ${drift}px`,
          }}
        />
        <div style={{ position: 'absolute', right: -240 + drift, top: -260, width: 760, height: 760, borderRadius: '50%', background: C.orange, opacity: 0.16 }} />
        <div style={{ position: 'absolute', left: -300, bottom: -340 - drift, width: 820, height: 820, borderRadius: '50%', background: C.green800, opacity: 0.6 }} />
      </AbsoluteFill>
    )
  }
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <div
        style={{
          position: 'absolute', inset: 0, opacity: 0.6,
          backgroundImage: `radial-gradient(${C.green100} 2px, transparent 2.5px)`,
          backgroundSize: '64px 64px', backgroundPosition: `${drift}px ${drift}px`,
        }}
      />
      <div style={{ position: 'absolute', right: -200, top: -220, width: 620, height: 620, borderRadius: '50%', background: C.orangeTint }} />
      <div style={{ position: 'absolute', left: -240, bottom: -260 - drift, width: 640, height: 640, borderRadius: '50%', background: C.green100 }} />
    </AbsoluteFill>
  )
}

// A beat = one idea on screen: its own background plus a quick orange wipe that makes cuts feel punchy.
export const Beat: React.FC<{ tone: 'dark' | 'paper'; children: React.ReactNode; wipe?: boolean }> = ({ tone, children, wipe = true }) => {
  const frame = useCurrentFrame()
  const x = interpolate(frame, [0, 9], [0, 105], { extrapolateRight: 'clamp', easing: Easing.bezier(0.7, 0, 0.3, 1) })
  return (
    <AbsoluteFill>
      <Bg tone={tone} />
      {children}
      {wipe && frame < 10 && (
        <AbsoluteFill style={{ transform: `translateX(${x}%)`, background: C.orange }}>
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 26, background: C.gold }} />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  )
}

/* ------------------------------------------------------------------ entrances */

type From = 'scale' | 'up' | 'down' | 'left' | 'right'

export const Pop: React.FC<{
  delay?: number
  from?: From
  dist?: number
  rotate?: number
  config?: Partial<typeof BOUNCY>
  style?: React.CSSProperties
  children: React.ReactNode
}> = ({ delay = 0, from = 'scale', dist = 120, rotate = 0, config = BOUNCY, style, children }) => {
  const s = useSpr(delay, config)
  const frame = useCurrentFrame()
  const op = interpolate(frame - delay, [0, 5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  let t = ''
  if (from === 'scale') t = `scale(${0.4 + 0.6 * s})`
  if (from === 'up') t = `translateY(${(1 - s) * dist}px) scale(${0.9 + 0.1 * s})`
  if (from === 'down') t = `translateY(${(1 - s) * -dist}px) scale(${0.9 + 0.1 * s})`
  if (from === 'left') t = `translateX(${(1 - s) * -dist}px)`
  if (from === 'right') t = `translateX(${(1 - s) * dist}px)`
  return <div style={{ opacity: op, transform: `${t} rotate(${rotate * s}deg)`, ...style }}>{children}</div>
}

// Text that springs in word by word.
export const Words: React.FC<{
  text: string
  size: number
  color?: string
  delay?: number
  stagger?: number
  head?: boolean
  weight?: number
  align?: 'left' | 'center'
  maxWidth?: number
  lineHeight?: number
  highlight?: string[]
  highlightColor?: string
}> = ({ text, size, color = C.white, delay = 0, stagger = 3, head = true, weight = 800, align = 'left', maxWidth, lineHeight = 1.08, highlight = [], highlightColor = C.orange }) => {
  const words = text.split(' ')
  return (
    <div
      style={{
        fontFamily: head ? FONT_HEAD : FONT_BODY, fontWeight: weight, fontSize: size, color, lineHeight,
        textAlign: align, maxWidth, display: 'flex', flexWrap: 'wrap', justifyContent: align === 'center' ? 'center' : 'flex-start',
        columnGap: size * 0.26, letterSpacing: head ? '-0.01em' : 0,
      }}
    >
      {words.map((w, i) => (
        <Pop key={i} from="up" dist={size * 0.7} delay={delay + i * stagger} config={BOUNCY}>
          <span style={{ color: highlight.includes(w.replace(/[.,!?]/g, '')) ? highlightColor : undefined }}>{w}</span>
        </Pop>
      ))}
    </div>
  )
}

export const Stamp: React.FC<{
  text: string
  delay?: number
  size: number
  color?: string
  bg?: string
  rotate?: number
  head?: boolean
}> = ({ text, delay = 0, size, color = C.white, bg = C.orange, rotate = -4, head = true }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame: frame - delay, fps, config: { damping: 9, stiffness: 240, mass: 0.6 } })
  const since = Math.max(0, frame - delay)
  const shake = since < 10 ? Math.sin(since * 3.1) * (10 - since) * 1.4 : 0
  const op = interpolate(frame - delay, [0, 2], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <div
      style={{
        opacity: op, transform: `translate(${shake}px, ${shake * 0.5}px) scale(${3 - 2 * s}) rotate(${rotate}deg)`,
        background: bg, color, fontFamily: head ? FONT_HEAD : FONT_BODY, fontWeight: 900, fontSize: size,
        padding: `${size * 0.16}px ${size * 0.4}px`, borderRadius: size * 0.22, boxShadow: SHADOW, lineHeight: 1.1,
        textAlign: 'center', display: 'inline-block',
      }}
    >
      {text}
    </div>
  )
}

// Wrap anything to give it a decaying screen shake starting at `start`.
export const Shake: React.FC<{ start: number; amount?: number; children: React.ReactNode }> = ({ start, amount = 14, children }) => {
  const frame = useCurrentFrame()
  const since = frame - start
  const k = since >= 0 && since < 14 ? (14 - since) / 14 : 0
  const dx = Math.sin(since * 2.9) * amount * k
  const dy = Math.cos(since * 3.7) * amount * 0.7 * k
  return <AbsoluteFill style={{ transform: `translate(${dx}px, ${dy}px)` }}>{children}</AbsoluteFill>
}

/* ------------------------------------------------------------------ surfaces */

export const Card: React.FC<{ style?: React.CSSProperties; children: React.ReactNode }> = ({ style, children }) => (
  <div style={{ background: C.white, borderRadius: 28, boxShadow: SHADOW, fontFamily: FONT_BODY, color: C.ink, ...style }}>{children}</div>
)

export const Pill: React.FC<{ bg?: string; color?: string; size?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ bg = C.orange, color = C.white, size = 30, style, children }) => (
  <div
    style={{
      display: 'inline-flex', alignItems: 'center', gap: size * 0.3, background: bg, color, fontFamily: FONT_BODY, fontWeight: 800,
      fontSize: size, padding: `${size * 0.3}px ${size * 0.75}px`, borderRadius: 999, boxShadow: SHADOW_SOFT, whiteSpace: 'nowrap', ...style,
    }}
  >
    {children}
  </div>
)

export const Logo: React.FC<{ size: number; small?: boolean }> = ({ size, small }) => (
  <Img src={staticFile(small ? 'logo-small.png' : 'logo.png')} style={{ width: size, height: 'auto', display: 'block' }} />
)

/* ------------------------------------------------------------------ device frames */

// Height of a BrowserFrame so scenes can centre it.
export const browserHeight = (width: number, viewH: number) => Math.round(width * 0.034) + (viewH * width) / 1280

// A browser window showing part of a real screenshot. Children are drawn in SCREENSHOT pixels (1280 wide) on top
// of the page and scroll with it, so overlays stay glued to the right spot.
export const BrowserFrame: React.FC<{
  width: number
  src?: string
  viewH: number
  scroll?: number
  url?: string
  zoom?: number
  children?: React.ReactNode
  style?: React.CSSProperties
}> = ({ width, src, viewH, scroll = 0, url = 'nammeshub.com.ng', zoom = 1, children, style }) => {
  const scale = width / 1280
  const chromeH = Math.round(width * 0.034)
  return (
    <div style={{ width, borderRadius: 20 * Math.max(scale, 0.6), overflow: 'hidden', boxShadow: SHADOW, background: C.white, border: '2px solid rgba(4,22,12,0.12)', ...style }}>
      <div style={{ height: chromeH, background: '#eceae9', display: 'flex', alignItems: 'center', gap: chromeH * 0.22, padding: `0 ${chromeH * 0.4}px` }}>
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
          <div key={c} style={{ width: chromeH * 0.3, height: chromeH * 0.3, borderRadius: '50%', background: c }} />
        ))}
        <div style={{ marginLeft: chromeH * 0.3, flex: 1, height: chromeH * 0.62, borderRadius: 999, background: C.white, display: 'flex', alignItems: 'center', padding: `0 ${chromeH * 0.4}px`, fontFamily: FONT_BODY, fontSize: chromeH * 0.4, color: '#555', fontWeight: 600 }}>
          {url}
        </div>
      </div>
      <div style={{ position: 'relative', width, height: viewH * scale, overflow: 'hidden', background: C.paper }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1280, transformOrigin: '0 0', transform: `scale(${scale * zoom}) translateY(${-scroll}px)` }}>
          {src && <Img src={staticFile(src)} style={{ width: 1280, display: 'block' }} />}
          {children}
        </div>
      </div>
    </div>
  )
}

export const phoneHeight = (width: number, viewH: number) => Math.round(((width - width * 0.07) / 800) * viewH + width * 0.07)

// A phone showing part of a real mobile screenshot (800 wide). Children are drawn in screenshot pixels.
export const PhoneFrame: React.FC<{
  width: number
  src?: string
  viewH: number
  scroll?: number
  children?: React.ReactNode
  bg?: string
  style?: React.CSSProperties
  // when there is no screenshot, children are laid out in a 800-wide canvas
}> = ({ width, src, viewH, scroll = 0, children, bg = C.paper, style }) => {
  const bezel = width * 0.035
  const scale = (width - bezel * 2) / 800
  return (
    <div style={{ width, padding: bezel, borderRadius: width * 0.14, background: '#111', boxShadow: SHADOW, position: 'relative', boxSizing: 'border-box', ...style }}>
      <div style={{ width: 800 * scale, height: viewH * scale, borderRadius: width * 0.105, overflow: 'hidden', position: 'relative', background: bg }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 800, transformOrigin: '0 0', transform: `scale(${scale}) translateY(${-scroll}px)` }}>
          {src && <Img src={staticFile(src)} style={{ width: 800, display: 'block' }} />}
          {children}
        </div>
      </div>
      <div style={{ position: 'absolute', top: bezel * 1.1, left: '50%', width: width * 0.22, height: width * 0.04, marginLeft: -width * 0.11, background: '#111', borderRadius: 999 }} />
    </div>
  )
}

/* ------------------------------------------------------------------ cursor */

type Key = { f: number; x: number; y: number }

export const Cursor: React.FC<{ keys: Key[]; taps?: number[]; scale?: number }> = ({ keys, taps = [], scale = 1 }) => {
  const frame = useCurrentFrame()
  const xs = keys.map((k) => k.f)
  const x = interpolate(frame, xs, keys.map((k) => k.x), { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease })
  const y = interpolate(frame, xs, keys.map((k) => k.y), { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease })
  const visible = interpolate(frame, [keys[0].f - 4, keys[0].f + 2], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const press = taps.some((t) => frame >= t && frame < t + 5) ? 0.82 : 1
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, opacity: visible, pointerEvents: 'none', zIndex: 50 }}>
      {taps.map((t, i) => {
        const p = (frame - t) / 14
        if (p < 0 || p > 1) return null
        return (
          <div key={i} style={{ position: 'absolute', left: x - 60 * scale * p - 10, top: y - 60 * scale * p - 10, width: 120 * scale * p + 20, height: 120 * scale * p + 20, borderRadius: '50%', border: `${6 * scale}px solid ${C.orange}`, opacity: 1 - p }} />
        )
      })}
      <svg width={54 * scale} height={64 * scale} viewBox="0 0 54 64" style={{ position: 'absolute', left: x, top: y, transform: `scale(${press})`, transformOrigin: '0 0', filter: 'drop-shadow(0 6px 8px rgba(0,0,0,0.35))' }}>
        <path d="M4 2 L4 48 L15 38 L23 58 L32 54 L24 35 L40 35 Z" fill={C.white} stroke={C.ink} strokeWidth="3" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

/* ------------------------------------------------------------------ celebration */

export const Confetti: React.FC<{ start?: number; count?: number; colors?: string[]; seed?: string }> = ({ start = 0, count = 90, colors = [C.gold, '#ffe38a', C.white, C.orange], seed = 'c' }) => {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const f = frame - start
  if (f < 0) return null
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      {Array.from({ length: count }).map((_, i) => {
        const r = (k: string) => random(`${seed}-${k}-${i}`)
        const x0 = r('x') * width
        const vy = 5 + r('vy') * 9
        const sway = Math.sin(f / (6 + r('s') * 10) + r('p') * 6) * (30 + r('w') * 60)
        const y = -80 + f * vy - r('d') * 500 + 0.12 * f * f * 0.2
        if (y > height + 60 || y < -100) return null
        const size = 14 + r('z') * 20
        return (
          <div key={i} style={{ position: 'absolute', left: x0 + sway, top: y, width: size, height: size * 0.5, background: colors[Math.floor(r('c') * colors.length)], transform: `rotate(${f * (4 + r('r') * 10)}deg)`, borderRadius: 3 }} />
        )
      })}
    </AbsoluteFill>
  )
}

/* ------------------------------------------------------------------ layout helper */

// Centre a block of a known size inside the stage.
export const Stage: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => {
  const L = useLayout()
  return <div style={{ position: 'absolute', left: L.x, top: L.y, width: L.sw, height: L.sh, ...style }}>{children}</div>
}

export { FONT_BODY, FONT_HEAD }
