import React from 'react'
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion'
import type { Beat } from '../beats'
import { Backdrop } from '../components/Backdrop'
import { BrowserFrame } from '../components/BrowserFrame'
import { Caption } from '../components/Caption'
import { PillStack } from '../components/Pill'
import { Cursor } from '../components/Cursor'
import { EventLightbox } from '../screens/EventGalleryScreen'
import { MockScreen } from '../screens/SiteChrome'
import { camera } from '../motion'
import { frameBox, pillColumn, useLayout } from '../theme'

export const EventsBeat: React.FC<{ beat: Beat }> = ({ beat }) => {
  const frame = useCurrentFrame()
  const { portrait } = useLayout()
  const box = frameBox(portrait)
  const column = pillColumn(portrait, box.y + box.h)
  const cutAt = beat.cuts?.[1] ?? beat.durationInFrames
  const lightbox = frame >= cutAt
  const sinceCut = lightbox ? frame - cutAt : frame
  const shotLength = lightbox ? beat.durationInFrames - cutAt : cutAt

  return (
    <AbsoluteFill>
      <Backdrop variant="dark" />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: camera(sinceCut, {
            duration: shotLength,
            zoomFrom: lightbox ? 1.06 : 1.01,
            zoomTo: lightbox ? 1.12 : 1.07,
            driftX: lightbox ? -8 : -14,
            driftY: lightbox ? -6 : -4,
          }),
          transformOrigin: `${box.x + box.w / 2}px ${box.y + box.h / 2}px`,
        }}
      >
        <BrowserFrame
          x={box.x}
          y={box.y}
          src=""
          url="nammeshub.com.ng/events/materials-horizon-3.0"
          width={box.w}
          height={box.h}
          scale={portrait ? 1.1 : 1}
        >
          {lightbox ? (
            <MockScreen width={box.w}>
              <EventLightbox />
            </MockScreen>
          ) : (
            <Img
              src={staticFile('screens/event-detail.webp')}
              style={{
                width: '100%',
                height: '100%',
                // Portrait fits the page width instead of cropping it: the poster
                // is the subject and a cover crop cuts it mid-word.
                objectFit: portrait ? 'contain' : 'cover',
                objectPosition: 'top center',
                backgroundColor: '#fff',
              }}
            />
          )}
          {!lightbox ? (
            <Cursor
              from={{ x: box.w * 0.74, y: box.h * 0.88 }}
              to={{ x: box.w * 0.5, y: box.h * 0.62 }}
              clickAt={cutAt - 26}
              moveAt={cutAt - 60}
              size={Math.round(box.w * 0.045)}
              clickScale={1.4}
            />
          ) : null}
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
