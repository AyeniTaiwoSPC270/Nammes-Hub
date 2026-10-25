import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'
import { C } from '../theme'
import { breathe, float } from '../motion'

export type BackdropVariant = 'dark' | 'cream'

/**
 * The two backdrops the whole cut is built from. They drift rather than sit
 * still: a dot field that slides diagonally and blobs on long sine paths. The
 * movement is deliberately slower than the cuts, so the wallpaper reads as
 * depth and never pulls the eye off the copy.
 */
export const Backdrop: React.FC<{ variant: BackdropVariant }> = ({ variant }) => {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const portrait = height > width
  const dark = variant === 'dark'
  const pitch = Math.round(portrait ? 46 : 44)

  const dotX = (frame * 0.32) % pitch
  const dotY = (frame * 0.2) % pitch
  const blob = (amplitude: number, period: number, phase: number) => float(frame, amplitude, period, phase)
  const swell = (amount: number, period: number, phase: number) => breathe(frame, amount, period, phase)

  return (
    <AbsoluteFill style={{ backgroundColor: dark ? C.dark : C.cream, overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(circle, ${
            dark ? 'rgba(255,255,255,0.055)' : 'rgba(12,23,16,0.075)'
          } 1.5px, transparent 1.6px)`,
          backgroundSize: `${pitch}px ${pitch}px`,
          backgroundPosition: `${dotX}px ${dotY}px`,
        }}
      />

      {dark ? (
        <>
          <div
            style={{
              position: 'absolute',
              width: width * 0.66,
              height: width * 0.66,
              left: -width * 0.12 + blob(width * 0.012, 260, 0),
              top: height - width * 0.42 + blob(width * 0.009, 310, 1.4),
              borderRadius: '50%',
              backgroundColor: C.greenDeep,
              opacity: 0.85,
              transform: `scale(${swell(0.02, 300, 0.6)})`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: width * 0.58,
              height: width * 0.58,
              right: -width * 0.13 + blob(width * 0.01, 280, 2.1),
              top: -width * 0.17 + blob(width * 0.008, 340, 0.3),
              borderRadius: '50%',
              backgroundColor: C.brown,
              opacity: 0.9,
              transform: `scale(${swell(0.025, 260, 1.8)})`,
            }}
          />
        </>
      ) : (
        <>
          <div
            style={{
              position: 'absolute',
              width: width * 0.64,
              height: width * 0.64,
              right: -width * 0.16 + blob(width * 0.012, 250, 0.9),
              top: -width * 0.2 + blob(width * 0.01, 300, 2.4),
              borderRadius: '50%',
              backgroundColor: C.peach,
              transform: `scale(${swell(0.02, 280, 1.1)})`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: width * 0.6,
              height: width * 0.6,
              left: -width * 0.2 + blob(width * 0.014, 320, 1.7),
              top: height - width * 0.34 + blob(width * 0.009, 270, 0.2),
              borderRadius: '50%',
              backgroundColor: C.sage,
              transform: `scale(${swell(0.022, 310, 2.2)})`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: width * 0.42,
              height: width * 0.42,
              left: width * 0.08 + blob(width * 0.008, 230, 2.8),
              top: height - width * 0.22 + blob(width * 0.006, 290, 0.7),
              borderRadius: '50%',
              backgroundColor: '#f1f7f3',
              opacity: 0.9,
              transform: `scale(${swell(0.03, 240, 0.4)})`,
            }}
          />
        </>
      )}
    </AbsoluteFill>
  )
}

/** Kept next to Backdrop so a scene that needs a bare colour matches exactly. */
export const backdropColor = (variant: BackdropVariant) =>
  variant === 'dark' ? C.dark : C.cream
