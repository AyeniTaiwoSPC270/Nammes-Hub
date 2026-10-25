import React from 'react'
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion'
import type { Beat } from '../beats'
import { Backdrop } from '../components/Backdrop'
import { BrowserFrame } from '../components/BrowserFrame'
import { Caption } from '../components/Caption'
import { Pill } from '../components/Pill'
import { camera, sweep } from '../motion'
import { frameBox, useLayout } from '../theme'

export const DashboardBeat: React.FC<{ beat: Beat }> = ({ beat }) => {
  const frame = useCurrentFrame()
  const { portrait } = useLayout()
  const box = frameBox(portrait, 'meet')
  const shine = sweep(frame, 14, 46)
  const second = sweep(frame, 92, 44)

  return (
    <AbsoluteFill>
      <Backdrop variant="dark" />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: portrait ? 296 : 30,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Pill tone="orange" delay={6} size={portrait ? 50 : 38}>
          The excos run it all
        </Pill>
      </div>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: camera(frame, {
            duration: beat.durationInFrames,
            zoomFrom: 1.01,
            zoomTo: 1.075,
            driftX: -10,
            driftY: -8,
          }),
          transformOrigin: `${box.x + box.w / 2}px ${box.y + box.h / 2}px`,
        }}
      >
        <BrowserFrame x={box.x} y={box.y} src="" url="nammeshub.com.ng/admin" width={box.w} height={box.h} scale={portrait ? 1.1 : 1}>
          <Img
            src={staticFile('screens/dashboard.png')}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
          />
          <AbsoluteFill
            style={{
              background: 'linear-gradient(115deg, rgba(255,255,255,0) 42%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0) 58%)',
              transform: `translateX(${shine * 200 - 100}%)`,
              opacity: 0.5,
            }}
          />
          <AbsoluteFill
            style={{
              background: 'linear-gradient(115deg, rgba(255,255,255,0) 44%, rgba(255,255,255,0.34) 50%, rgba(255,255,255,0) 56%)',
              transform: `translateX(${second * 200 - 100}%)`,
              opacity: 0.35,
            }}
          />
        </BrowserFrame>
      </div>

      <Caption line1={beat.line1} highlight={beat.highlight} duration={beat.durationInFrames} />
    </AbsoluteFill>
  )
}
