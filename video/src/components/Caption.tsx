import React from 'react'
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, FONT, useLayout } from '../theme'
import { float } from '../motion'

interface Props {
  line1: string
  line2?: string
  /** Substring painted yellow. Absent means the whole caption is white. */
  highlight?: string
  /** Sequence length, used for the exit fade. */
  duration: number
  /** Skip the entrance/exit animations (used inside a crossfade wrapper). */
  instant?: boolean
  /** Stay on screen to the last frame (the endcard must not fade out). */
  hold?: boolean
  /** Override the ratio's default size when the copy would wrap past two lines. */
  size?: number
}

function withHighlight(text: string, highlight: string | undefined, glow: number): React.ReactNode {
  if (!highlight) return text
  const at = text.toLowerCase().indexOf(highlight.toLowerCase())
  if (at === -1) return text
  return (
    <>
      {text.slice(0, at)}
      <span
        style={{
          color: C.yellow,
          // The yellow words breathe by a few percent: enough that a caption
          // held for four seconds still reads as alive, not as a still card.
          textShadow: `0 0 ${4 + glow * 6}px rgba(244,196,48,${0.1 + glow * 0.12})`,
        }}
      >
        {text.slice(at, at + highlight.length)}
      </span>
      {text.slice(at + highlight.length)}
    </>
  )
}

/**
 * The caption is the script, not a subtitle: one per beat, two lines maximum.
 * It rises in on the beat, floats while it holds, and fades out over the last
 * 6 frames of its sequence.
 */
export const Caption: React.FC<Props> = ({ line1, line2, highlight, duration, instant, hold, size }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const { captionBottom, captionSize: ratioSize, captionMaxWidth, u } = useLayout()
  const captionSize = size ?? ratioSize

  const entrance = instant
    ? 1
    : interpolate(frame, [0, 8], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
  const exit = instant || hold
    ? 1
    : interpolate(frame, [duration - 6, duration], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
  const highlightInLine1 = highlight && line1.toLowerCase().includes(highlight.toLowerCase())
  const highlightInLine2 = highlight && (line2 ?? '').toLowerCase().includes(highlight.toLowerCase())
  const resolvedHighlight = highlightInLine1 || highlightInLine2 ? highlight : undefined
  const glow = Math.sin((frame / 26) * Math.PI * 2) * 0.5 + 0.5
  const idle = float(frame, 2.5, 104) * entrance

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: captionBottom,
        display: 'flex',
        justifyContent: 'center',
        paddingLeft: 24 * u,
        paddingRight: 24 * u,
        opacity: entrance * exit,
        transform: `translateY(${(1 - entrance) * 8 * u + idle}px) scale(${0.92 + 0.08 * entrance})`,
      }}
    >
      <div
        style={{
          maxWidth: captionMaxWidth,
          backgroundColor: C.ink,
          border: `${Math.max(2, Math.round(2 * u))}px solid ${C.yellow}`,
          borderRadius: Math.round(16 * u),
          padding: `${Math.round(captionSize * 0.3)}px ${Math.round(captionSize * 0.62)}px`,
          boxShadow: '0 12px 30px rgba(0,0,0,0.28)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: FONT.sans,
            fontWeight: 800,
            fontSize: captionSize,
            lineHeight: 1.16,
            color: C.white,
            letterSpacing: -0.2,
          }}
        >
          {withHighlight(line1, resolvedHighlight, glow)}
        </div>
        {line2 ? (
          <div
            style={{
              fontFamily: FONT.sans,
              fontWeight: 800,
              fontSize: captionSize,
              lineHeight: 1.16,
              color: C.white,
              letterSpacing: -0.2,
            }}
          >
            {withHighlight(line2, resolvedHighlight, glow)}
          </div>
        ) : null}
      </div>
    </div>
  )
}
