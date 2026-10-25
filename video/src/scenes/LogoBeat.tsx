import React from 'react'
import { AbsoluteFill, useVideoConfig } from 'remotion'
import type { Beat } from '../beats'
import { AnimatedLogo } from '../components/AnimatedLogo'
import { Backdrop } from '../components/Backdrop'
import { useLayout } from '../theme'

export const LogoBeat: React.FC<{ beat: Beat }> = ({ beat }) => {
  const { portrait } = useLayout()
  const { height } = useVideoConfig()

  return (
    <AbsoluteFill>
      <Backdrop variant="dark" />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: portrait ? height * 0.34 : height * 0.4,
          display: 'flex',
          justifyContent: 'center',
          transform: 'translateY(-50%)',
        }}
      >
        <AnimatedLogo
          crestHeight={portrait ? 260 : 232}
          wordmarkSize={portrait ? 130 : 132}
          taglineSize={portrait ? 58 : 56}
          delay={6}
        />
      </div>
    </AbsoluteFill>
  )
}
