import React from 'react'
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion'
import type { Beat } from '../beats'
import { Backdrop } from '../components/Backdrop'
import { breathe, fadeIn, float } from '../motion'
import { C, FONT, useLayout } from '../theme'

export const BuiltBeat: React.FC<{ beat: Beat }> = ({ beat }) => {
  const frame = useCurrentFrame()
  const { portrait } = useLayout()
  const crest = fadeIn(frame, 2, 16)
  const headline = fadeIn(frame, 8, 18)
  const subline = fadeIn(frame, 18, 16)

  return (
    <AbsoluteFill>
      <Backdrop variant="dark" />

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: portrait ? '20%' : '6%',
          display: 'flex',
          justifyContent: 'center',
          opacity: crest * 0.7,
          transform: `translateY(${float(frame, 10, 140)}px) scale(${breathe(frame, 0.014, 150)})`,
        }}
      >
        <Img src={staticFile('logo.png')} style={{ height: portrait ? 380 : 330, width: 'auto' }} />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: portrait ? '52%' : '47%',
          textAlign: 'center',
          transform: `translateY(-50%) translateY(${float(frame, 5, 160, 1.2)}px)`,
          opacity: headline,
        }}
      >
        <div
          style={{
            fontFamily: FONT.serif,
            fontWeight: 700,
            fontSize: portrait ? 96 : 104,
            color: C.white,
            lineHeight: 1.1,
            letterSpacing: -1.5,
            transform: `scale(${breathe(frame, 0.008, 170, 0.5)})`,
          }}
        >
          Built for the chapter.
        </div>
        <div
          style={{
            fontFamily: FONT.sans,
            fontWeight: 800,
            fontSize: portrait ? 52 : 48,
            color: C.yellow,
            marginTop: 18,
            opacity: subline,
            transform: `translateY(${(1 - subline) * 10 + float(frame, 4, 120, 2.4)}px)`,
          }}
        >
          By the chapter.
        </div>
      </div>
    </AbsoluteFill>
  )
}
