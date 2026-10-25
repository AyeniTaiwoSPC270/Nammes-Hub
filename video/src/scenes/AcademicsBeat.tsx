import React from 'react'
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion'
import type { Beat } from '../beats'
import { Backdrop } from '../components/Backdrop'
import { BrowserFrame } from '../components/BrowserFrame'
import { Caption } from '../components/Caption'
import { PillStack } from '../components/Pill'
import { Cursor } from '../components/Cursor'
import { CgpaScreen } from '../screens/CgpaScreen'
import { TimetableScreen } from '../screens/TimetableScreen'
import { MockScreen } from '../screens/SiteChrome'
import { camera } from '../motion'
import { frameBox, pillColumn, useLayout } from '../theme'

const PageShot: React.FC<{ src: string }> = ({ src }) => (
  <Img
    src={staticFile(src)}
    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}
  />
)

export const AcademicsBeat: React.FC<{ beat: Beat }> = ({ beat }) => {
  const frame = useCurrentFrame()
  const { portrait } = useLayout()
  const box = frameBox(portrait)
  const column = pillColumn(portrait, box.y + box.h)
  const cuts = beat.cuts ?? [0]
  const cut = cuts.reduce((latest, mark, index) => (frame >= mark ? index : latest), 0)
  const sinceCut = frame - cuts[cut]
  const shotLength = (cuts[cut + 1] ?? beat.durationInFrames) - cuts[cut]

  const pillSize = portrait ? (beat.pills.length > 2 ? 44 : 50) : 38
  const pills = (
    <PillStack
      pills={beat.pills}
      x={column.x}
      y={column.y}
      width={column.width}
      align={column.align}
      size={pillSize}
      activeIndex={beat.scene === 'academics-montage' ? cut : undefined}
    />
  )

  const shot = (children: React.ReactNode, zoomFrom: number, zoomTo: number) => (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        transform: camera(sinceCut, { duration: shotLength, zoomFrom, zoomTo, driftX: -10, driftY: -8 }),
        transformOrigin: `${box.x + box.w / 2}px ${box.y + box.h / 2}px`,
      }}
    >
      <BrowserFrame x={box.x} y={box.y} src="" url="nammeshub.com.ng" width={box.w} height={box.h} scale={portrait ? 1.1 : 1}>
        {children}
      </BrowserFrame>
    </div>
  )

  const shell = (children: React.ReactNode) => (
    <AbsoluteFill>
      <Backdrop variant="cream" />
      {children}
      <Caption line1={beat.line1} highlight={beat.highlight} duration={beat.durationInFrames} />
    </AbsoluteFill>
  )

  if (beat.scene === 'cgpa-in') {
    return shell(
      <>
        {shot(
          <MockScreen width={box.w}>
            <CgpaScreen start={0} cursor={{ from: { x: 1010, y: 790 }, to: { x: 818, y: 466 }, clickAt: 18 }} />
          </MockScreen>,
          1.0,
          1.055,
        )}
        {pills}
      </>,
    )
  }

  if (beat.scene === 'cgpa-out') {
    return shell(
      <>
        {shot(
          <MockScreen width={box.w}>
            <CgpaScreen
              settled
              reportAt={26}
              cursor={{ from: { x: 1140, y: 930 }, to: { x: 1420, y: 731 }, clickAt: 20 }}
            />
          </MockScreen>,
          1.04,
          1.09,
        )}
        {pills}
      </>,
    )
  }

  const flash = interpolate(sinceCut, [0, 1, 3], [0, 0.15, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  // A band of light travels down the list, so a screenshot of a page reads as
  // something being read rather than pasted in.
  const scan = interpolate(sinceCut, [8, 46], [-0.2, 1.15], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return shell(
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: camera(sinceCut, {
            duration: shotLength,
            zoomFrom: 1.02,
            zoomTo: cut === 2 ? 1.085 : 1.06,
            driftX: cut === 1 ? 8 : -10,
            driftY: -8,
          }),
          transformOrigin: `${box.x + box.w / 2}px ${box.y + box.h / 2}px`,
        }}
      >
        <BrowserFrame x={box.x} y={box.y} src="" url="nammeshub.com.ng" width={box.w} height={box.h} scale={portrait ? 1.1 : 1}>
          {cut === 0 ? <PageShot src="screens/outlines.png" /> : null}
          {cut === 1 ? (
            <MockScreen width={box.w}>
              <TimetableScreen start={cuts[1]} />
            </MockScreen>
          ) : null}
          {cut === 2 ? <PageShot src="screens/resources.png" /> : null}

          {cut !== 1 ? (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${scan * 100}%`,
                height: '26%',
                background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.42) 50%, rgba(255,255,255,0) 100%)',
              }}
            />
          ) : null}

          <Cursor
            from={{ x: box.w * 0.7, y: box.h * 0.82 }}
            to={{ x: box.w * (cut === 0 ? 0.32 : cut === 1 ? 0.55 : 0.4), y: box.h * (cut === 1 ? 0.48 : 0.36) }}
            clickAt={Math.min(shotLength - 16, 42)}
            moveAt={16}
            size={Math.round(box.w * 0.045)}
            clickScale={1.4}
          />
          <AbsoluteFill style={{ backgroundColor: 'white', opacity: flash }} />
        </BrowserFrame>
      </div>
      {pills}
    </>,
  )
}
