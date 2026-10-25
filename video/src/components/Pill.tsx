import React from 'react'
import { spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, FONT } from '../theme'
import type { PillSpec, Tone } from '../beats'
import { float } from '../motion'

const TONES: Record<Tone, { bg: string; fg: string }> = {
  orange: { bg: C.orange, fg: C.white },
  green: { bg: C.green, fg: C.white },
  yellow: { bg: C.yellow, fg: C.ink },
}

interface PillProps {
  tone: Tone
  children: React.ReactNode
  delay?: number
  size?: number
  scale?: number
  /** Offsets the idle bounce so a stack never moves in lockstep. */
  phase?: number
}

export const Pill: React.FC<PillProps> = ({ tone, children, delay = 0, size = 38, scale = 1, phase = 0 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const p = spring({
    frame: frame - delay,
    fps,
    config: { damping: 12, mass: 0.55, stiffness: 170 },
  })
  const tint = TONES[tone]
  const idle = float(frame, 3, 96, phase) * p

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tint.bg,
        color: tint.fg,
        fontFamily: FONT.sans,
        fontWeight: 800,
        fontSize: size * scale,
        lineHeight: 1,
        padding: `${Math.round(size * 0.4)}px ${Math.round(size * 0.85)}px`,
        borderRadius: 999,
        whiteSpace: 'nowrap',
        boxShadow: '0 10px 24px rgba(0,0,0,0.22)',
        transform: `scale(${0.6 + 0.4 * p}) translateY(${(1 - p) * 4 + idle}px)`,
        opacity: p,
      }}
    >
      {children}
    </div>
  )
}

interface StackProps {
  pills: readonly PillSpec[]
  x: number
  y: number
  width: number
  align: 'left' | 'center'
  size: number
  activeIndex?: number
}

/** Pills sit in one column either beside the frame or under it, never both. */
export const PillStack: React.FC<StackProps> = ({ pills, x, y, width, align, size, activeIndex }) => {
  const frame = useCurrentFrame()
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        display: 'flex',
        flexDirection: 'column',
        gap: Math.round(size * 0.55),
        alignItems: align === 'center' ? 'center' : 'flex-start',
      }}
    >
      {pills.map((pill, i) => {
        const pulse =
          activeIndex === undefined
            ? 1
            : activeIndex === i
              ? 1 + 0.07 * Math.sin(Math.min(1, Math.max(0, (frame - pill.at) / 8)) * Math.PI) +
                0.02 * Math.sin((frame / 18) * Math.PI * 2)
              : 0.93
        return (
          <Pill
            key={`${pill.label}-${i}`}
            tone={pill.tone}
            delay={pill.at}
            size={size}
            scale={pulse}
            phase={i * 1.1}
          >
            {pill.label}
          </Pill>
        )
      })}
    </div>
  )
}
