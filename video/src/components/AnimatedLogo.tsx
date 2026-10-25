import React from 'react'
import { Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, FONT } from '../theme'
import { breathe, fadeIn, float, pop } from '../motion'

interface Props {
  crestHeight: number
  wordmarkSize: number
  taglineSize: number
  /** Local frame each element starts. */
  delay?: number
  tagline?: string
  align?: 'center' | 'left'
}

/**
 * The crest is always public/logo.png — never redrawn or retyped. The wordmark
 * beside it is Playfair, matching the reference lockup.
 */
export const AnimatedLogo: React.FC<Props> = ({
  crestHeight,
  wordmarkSize,
  taglineSize,
  delay = 0,
  tagline = 'Everything. One address.',
  align = 'center',
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const crest = pop(frame, fps, delay, 16)
  const word = fadeIn(frame, delay + 8, 12)
  const tag = fadeIn(frame, delay + 18, 12)
  // One ring, on the landing only: a second one would read as a loading state.
  const ring = interpolate(frame - delay, [2, 34], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: align === 'center' ? 'center' : 'flex-start',
        textAlign: align,
      }}
    >
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
        {ring > 0 && ring < 1 ? (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: crestHeight * 1.9,
              height: crestHeight * 1.9,
              marginLeft: -crestHeight * 0.95,
              marginTop: -crestHeight * 0.95,
              borderRadius: '50%',
              border: `2px solid rgba(244,196,48,${0.4 * (1 - ring)})`,
              transform: `scale(${0.72 + ring * 0.55})`,
            }}
          />
        ) : null}
        <Img
          src={staticFile('logo.png')}
          style={{
            height: crestHeight,
            width: 'auto',
            transform: `scale(${(0.86 + 0.14 * crest) * breathe(frame, 0.012, 150, delay)}) translateY(${float(frame, 4, 170, delay)}px)`,
            opacity: crest,
          }}
        />
      </div>
      <div
        style={{
          marginTop: Math.round(crestHeight * 0.3),
          fontFamily: FONT.serif,
          fontWeight: 700,
          fontSize: wordmarkSize,
          lineHeight: 1,
          color: C.white,
          letterSpacing: -1,
          opacity: word,
          transform: `translateY(${(1 - word) * 12 + float(frame, 3, 150, delay + 0.8)}px)`,
          whiteSpace: 'nowrap',
        }}
      >
        NAMMES Hub
      </div>
      <div
        style={{
          marginTop: Math.round(wordmarkSize * 0.3),
          fontFamily: FONT.sans,
          fontWeight: 800,
          fontSize: taglineSize,
          color: C.yellow,
          opacity: tag,
          whiteSpace: 'nowrap',
          transform: `translateY(${float(frame, 2.5, 120, delay + 1.6)}px)`,
        }}
      >
        {tagline}
      </div>
    </div>
  )
}
