import React from 'react'
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import type { Beat } from '../beats'
import { Backdrop } from '../components/Backdrop'
import { Caption } from '../components/Caption'
import { breathe, fadeIn, float, rise } from '../motion'
import { C, FONT, useLayout } from '../theme'
import { SocialRow } from '../components/SocialRow'

export const EndCard: React.FC<{ beat: Beat }> = ({ beat }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const { portrait } = useLayout()

  const crest = rise(frame, fps, 0, 12)
  const word = rise(frame, fps, 6, 12)
  const domain = rise(frame, fps, 12, 10)
  const cta = rise(frame, fps, 18, 10)
  const socials = fadeIn(frame, 26, 12)
  const pulse = breathe(frame, 0.016, 70, 1.1)

  return (
    <AbsoluteFill>
      <Backdrop variant="dark" />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: portrait ? 230 : 62,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Img
          src={staticFile('logo.png')}
          style={{
            height: portrait ? 210 : 120,
            width: 'auto',
            ...crest,
            transform: `${crest.transform} scale(${breathe(frame, 0.02, 130)}) translateY(${float(frame, 5, 150)}px)`,
          }}
        />
        <div
          style={{
            fontFamily: FONT.serif,
            fontWeight: 700,
            fontSize: portrait ? 96 : 88,
            color: C.white,
            lineHeight: 1,
            marginTop: portrait ? 34 : 26,
            whiteSpace: 'nowrap',
            ...word,
          }}
        >
          NAMMES Hub
        </div>
        <div
          style={{
            fontFamily: FONT.sans,
            fontWeight: 800,
            fontSize: portrait ? 50 : 46,
            color: C.yellow,
            marginTop: 14,
            ...domain,
          }}
        >
          nammeshub.com.ng
        </div>
        <div
          style={{
            marginTop: portrait ? 40 : 30,
            backgroundColor: C.orange,
            color: C.white,
            fontFamily: FONT.sans,
            fontWeight: 800,
            fontSize: portrait ? 36 : 34,
            padding: portrait ? '20px 42px' : '16px 38px',
            borderRadius: 999,
            whiteSpace: 'nowrap',
            boxShadow: `0 14px 30px rgba(0,0,0,0.3), 0 0 ${Math.round(18 + (pulse - 1) * 500)}px rgba(255,90,31,0.3)`,
            ...cta,
            transform: `${cta.transform} scale(${pulse})`,
          }}
        >
          Download the Handbook in the footer
        </div>
        <div style={{ marginTop: portrait ? 54 : 40, opacity: socials, transform: `translateY(${float(frame, 4, 140, 0.6)}px)` }}>
          <SocialRow portrait={portrait} />
        </div>
      </div>

      <Caption
        line1={beat.line1}
        line2={beat.line2}
        highlight={beat.highlight}
        duration={beat.durationInFrames}
        size={portrait ? 52 : 54}
        hold
      />
    </AbsoluteFill>
  )
}
