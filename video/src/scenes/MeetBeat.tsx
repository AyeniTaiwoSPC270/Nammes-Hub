import React from 'react'
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame } from 'remotion'
import type { Beat } from '../beats'
import { Backdrop } from '../components/Backdrop'
import { BrowserFrame } from '../components/BrowserFrame'
import { Caption } from '../components/Caption'
import { Pill } from '../components/Pill'
import { Cursor } from '../components/Cursor'
import { camera } from '../motion'
import { frameBox, useLayout } from '../theme'

export const MeetBeat: React.FC<{ beat: Beat }> = ({ beat }) => {
  const frame = useCurrentFrame()
  const { portrait } = useLayout()
  const box = frameBox(portrait, 'meet')
  const entrance = interpolate(frame, [2, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  // The page scrolls inside a fixed frame, so the shot reads as a visit rather
  // than a picture of the home page. It holds at the top for the first second:
  // any crop before the header has been read looks like a broken screenshot.
  // Portrait shows the page at 1.65x, so the same percentage would scroll past
  // the nav entirely; it gets a shorter travel.
  const scroll = interpolate(frame, [30, beat.durationInFrames], [0, portrait ? 12 : 26], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

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
        <Pill tone="orange" delay={8} size={portrait ? 50 : 38}>
          Meet the Hub
        </Pill>
      </div>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: entrance,
          transform: `${camera(frame, {
            duration: beat.durationInFrames,
            zoomFrom: 0.985,
            zoomTo: 1.05,
            driftX: -12,
            driftY: -6,
          })} translateY(${(1 - entrance) * 14}px)`,
          transformOrigin: `${box.x + box.w / 2}px ${box.y + box.h / 2}px`,
        }}
      >
        <BrowserFrame
          x={box.x}
          y={box.y}
          src=""
          url="nammeshub.com.ng"
          width={box.w}
          height={box.h}
          scale={portrait ? 1.1 : 1}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url("${staticFile('screens/home.png')}")`,
              // Portrait shows the left third of the page at 1.65x: at 994px wide
              // the whole 1920 capture shrinks the nav to an unreadable hairline.
              backgroundSize: portrait ? '165% auto' : 'cover',
              backgroundPosition: portrait ? `left ${scroll}%` : `center ${scroll}%`,
            }}
          />
          <Cursor
            from={{ x: box.w * 0.62, y: box.h * 0.72 }}
            to={{ x: box.w * 0.335, y: box.h * 0.075 }}
            clickAt={72}
            moveAt={34}
            size={Math.round(box.w * 0.045)}
            clickScale={1.4}
          />
        </BrowserFrame>
      </div>

      <Caption
        line1={beat.line1}
        highlight={beat.highlight}
        duration={beat.durationInFrames}
      />
    </AbsoluteFill>
  )
}
