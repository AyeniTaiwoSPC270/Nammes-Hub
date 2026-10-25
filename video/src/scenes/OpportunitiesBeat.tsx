import React from 'react'
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import type { Beat } from '../beats'
import { Backdrop } from '../components/Backdrop'
import { BrowserFrame } from '../components/BrowserFrame'
import { Caption } from '../components/Caption'
import { PillStack } from '../components/Pill'
import { Cursor } from '../components/Cursor'
import { OpportunitiesScreen } from '../screens/OpportunitiesScreen'
import { MockScreen } from '../screens/SiteChrome'
import { camera } from '../motion'
import { frameBox, pillColumn, useLayout } from '../theme'

export const OpportunitiesBeat: React.FC<{ beat: Beat }> = ({ beat }) => {
  const frame = useCurrentFrame()
  const { portrait } = useLayout()
  const box = frameBox(portrait)
  const column = pillColumn(portrait, box.y + box.h)

  return (
    <AbsoluteFill>
      <Backdrop variant="dark" />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: camera(frame, {
            duration: beat.durationInFrames,
            zoomFrom: 1.01,
            zoomTo: 1.07,
            driftX: -12,
            driftY: -10,
          }),
          transformOrigin: `${box.x + box.w / 2}px ${box.y + box.h / 2}px`,
        }}
      >
        <BrowserFrame
          x={box.x}
          y={box.y}
          src=""
          url="nammeshub.com.ng/opportunities"
          width={box.w}
          height={box.h}
          scale={portrait ? 1.1 : 1}
        >
          <MockScreen width={box.w}>
            <OpportunitiesScreen start={0} />
          </MockScreen>
          <Cursor
            from={{ x: box.w * 0.86, y: box.h * 0.92 }}
            to={{ x: box.w * 0.48, y: box.h * 0.52 }}
            clickAt={74}
            moveAt={40}
            size={Math.round(box.w * 0.045)}
            clickScale={1.4}
          />
        </BrowserFrame>
      </div>
      <PillStack
        pills={beat.pills}
        x={column.x}
        y={column.y}
        width={column.width}
        align={column.align}
        size={portrait ? (beat.pills.length > 2 ? 44 : 50) : 38}
      />
      <Caption line1={beat.line1} highlight={beat.highlight} duration={beat.durationInFrames} />
    </AbsoluteFill>
  )
}
