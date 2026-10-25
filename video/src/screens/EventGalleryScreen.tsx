import React from 'react'
import { Img, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, FONT } from '../theme'
import { SITE } from './SiteChrome'

/**
 * The lightbox over the event's own poster. There are no event photographs in
 * the repo, and a grid of invented tiles reads as a broken gallery, so the shot
 * after the click is the poster at full size — the one picture the event really
 * has.
 */
export const EventLightbox: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = spring({ frame, fps, config: { damping: 16, mass: 0.7 } })

  return (
    <>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(8,18,12,0.94)', opacity: enter }} />
      <div
        style={{
          position: 'absolute',
          left: 170,
          top: 62,
          width: 1580,
          borderRadius: 20,
          backgroundColor: SITE.card,
          padding: 26,
          opacity: enter,
          transform: `translateY(${(1 - enter) * 30}px) scale(${0.96 + 0.04 * enter})`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontFamily: FONT.sans, fontSize: 30, fontWeight: 700, color: SITE.ink }}>
            Materials Horizon 3.0
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 24, color: SITE.muted, marginRight: 28 }}>1 of 25</div>
          <div style={{ fontSize: 34, color: SITE.muted, lineHeight: 1 }}>×</div>
        </div>

        <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', height: 700, backgroundColor: '#f1ece6' }}>
          <Img
            src={staticFile('gallery/poster.webp')}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 18%' }}
          />
          {[
            { glyph: '‹', side: 'left' as const },
            { glyph: '›', side: 'right' as const },
          ].map((arrow) => (
            <div
              key={arrow.side}
              style={{
                position: 'absolute',
                [arrow.side]: 22,
                top: '46%',
                width: 62,
                height: 62,
                borderRadius: '50%',
                backgroundColor: 'rgba(12,23,16,0.55)',
                color: C.white,
                fontSize: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {arrow.glyph}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', marginTop: 18, paddingLeft: 6 }}>
          <div style={{ fontFamily: FONT.sans, fontSize: 25, color: SITE.muted }}>
            Annual conference · Department of Metallurgical and Materials Engineering
          </div>
        </div>
      </div>
    </>
  )
}
