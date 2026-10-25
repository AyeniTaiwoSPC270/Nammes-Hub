import React from 'react'
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { C } from '../theme'

interface Props {
  /** Start and end positions in canvas pixels. */
  from: { x: number; y: number }
  to: { x: number; y: number }
  /** Local frame the pointer arrives and clicks. */
  clickAt: number
  /** Local frame the pointer starts moving. */
  moveAt?: number
  size?: number
  clickScale?: number
}

/**
 * A percentage-free cursor: scenes pass canvas pixels so the same component can
 * point at a button inside a scaled screenshot at either canvas size.
 */
export const Cursor: React.FC<Props> = ({ from, to, clickAt, moveAt = 0, size = 54, clickScale = 1 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const p = interpolate(frame, [moveAt, clickAt], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  // Ease out so the pointer decelerates into the target rather than sliding.
  const eased = 1 - Math.pow(1 - p, 3)
  const x = from.x + (to.x - from.x) * eased
  const y = from.y + (to.y - from.y) * eased
  const since = frame - clickAt
  const ring = since >= 0 ? Math.min(1, since / 16) : 0
  const clickNudge = since >= 0 && since < 4 ? 0.9 : 1

  return (
    <>
      {since >= 0
        ? [0, 6].map((offset) => {
            const r = Math.max(0, Math.min(1, (since - offset) / 18))
            if (r <= 0 || r >= 1) return null
            return (
              <div
                key={offset}
                style={{
                  position: 'absolute',
                  left: x - 46 * clickScale,
                  top: y - 46 * clickScale,
                  width: 92 * clickScale,
                  height: 92 * clickScale,
                  borderRadius: '50%',
                  border: `${Math.round(3 * clickScale)}px solid ${C.orange}`,
                  opacity: (1 - r) * 0.55,
                  transform: `scale(${0.35 + r * 1.1})`,
                }}
              />
            )
          })
        : null}

      <svg
        width={size}
        height={size * 1.25}
        viewBox="0 0 40 50"
        style={{
          position: 'absolute',
          left: x,
          top: y,
          transform: `scale(${(1 - ring * 0.06) * clickNudge})`,
          transformOrigin: 'top left',
          filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.3))',
        }}
      >
        <path
          d="M4 2 L4 38 L13 29 L20 45 L27 42 L20 26 L32 26 Z"
          fill={C.white}
          stroke={C.ink}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
      </svg>
    </>
  )
}
