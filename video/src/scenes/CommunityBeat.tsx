import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import type { Beat } from '../beats'
import { Backdrop } from '../components/Backdrop'
import { BrowserFrame } from '../components/BrowserFrame'
import { Caption } from '../components/Caption'
import { PillStack } from '../components/Pill'
import { NewsScreen } from '../screens/NewsScreen'
import { FormsScreen } from '../screens/FormsScreen'
import { AwardsScreen } from '../screens/AwardsScreen'
import { MockScreen } from '../screens/SiteChrome'
import { camera } from '../motion'
import { frameBox, pillColumn, useLayout } from '../theme'

export const CommunityBeat: React.FC<{ beat: Beat }> = ({ beat }) => {
  const frame = useCurrentFrame()
  const { portrait } = useLayout()
  const box = frameBox(portrait)
  const column = pillColumn(portrait, box.y + box.h)
  const cuts = beat.cuts ?? [0]
  const cut = cuts.reduce((latest, mark, index) => (frame >= mark ? index : latest), 0)
  const sinceCut = frame - cuts[cut]
  const shotLength = (cuts[cut + 1] ?? beat.durationInFrames) - cuts[cut]
  const flash = interpolate(sinceCut, [0, 1, 3], [0, 0.15, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const drift = [0, -10, 8, -6][cut]

  return (
    <AbsoluteFill>
      <Backdrop variant="cream" />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: camera(sinceCut, {
            duration: shotLength,
            zoomFrom: cut === 1 ? 1.0 : 1.02,
            zoomTo: cut === 2 ? 1.085 : 1.06,
            driftX: drift,
            driftY: -8,
          }),
          transformOrigin: `${box.x + box.w / 2}px ${box.y + box.h / 2}px`,
        }}
      >
        <BrowserFrame x={box.x} y={box.y} src="" url="nammeshub.com.ng" width={box.w} height={box.h} scale={portrait ? 1.1 : 1}>
          <MockScreen width={box.w}>
            {cut === 0 ? <NewsScreen start={cuts[0]} /> : null}
            {cut === 1 ? <FormsScreen /> : null}
            {cut === 2 ? <AwardsScreen start={cuts[2]} /> : null}
          </MockScreen>
          <AbsoluteFill style={{ backgroundColor: 'white', opacity: flash }} />
        </BrowserFrame>
      </div>
      <PillStack
        pills={beat.pills}
        x={column.x}
        y={column.y}
        width={column.width}
        align={column.align}
        size={portrait ? (beat.pills.length > 2 ? 44 : 50) : 38}
        activeIndex={cut}
      />
      <Caption line1={beat.line1} highlight={beat.highlight} duration={beat.durationInFrames} />
    </AbsoluteFill>
  )
}
