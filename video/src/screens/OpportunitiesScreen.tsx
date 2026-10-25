import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { C } from '../theme'
import { Chip, Hero, SITE, SiteHeader } from './SiteChrome'

const ROWS = [
  { deadline: '12 Nov', type: 'Internship', title: 'Graduate Trainee Programme', org: 'Dangote Cement' },
  { deadline: '28 Nov', type: 'Scholarship', title: 'MTN Foundation Scholarship', org: 'MTN Nigeria' },
  { deadline: '09 Dec', type: 'Research', title: 'Materials Research Assistantship', org: 'University of Lagos' },
]

export const OpportunitiesScreen: React.FC<{ start?: number }> = ({ start = 0 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const sweep = interpolate(frame, [start + 24, start + 48], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <SiteHeader active="Community" />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 126 }}>
        <Hero title="Opportunities" subtitle="Explore current engineering roles, internships, and research positions." />
      </div>

      <div style={{ position: 'absolute', left: 64, top: 470, fontSize: 44, fontWeight: 700, letterSpacing: -0.6 }}>
        Current listings
      </div>
      <div style={{ position: 'absolute', left: 64, top: 530, fontSize: 28, color: SITE.muted }}>
        Sorted by soonest deadline first.
      </div>

      <div
        style={{
          position: 'absolute',
          left: 64,
          top: 596,
          width: 1792,
          borderRadius: 14,
          border: `1.5px solid ${SITE.line}`,
          backgroundColor: SITE.card,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            backgroundColor: SITE.soft,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 1.2,
            color: SITE.muted,
          }}
        >
          <div style={{ width: 260, paddingLeft: 32 }}>DEADLINE</div>
          <div style={{ width: 300 }}>TYPE</div>
          <div>TITLE &amp; ORG</div>
        </div>

        {ROWS.map((row, index) => {
          const p = spring({ frame: frame - (start + 6 + index * 6), fps, config: { damping: 17, mass: 0.6 } })
          const highlight = index === 0 ? sweep : 0
          return (
            <div
              key={row.title}
              style={{
                position: 'relative',
                height: 108,
                display: 'flex',
                alignItems: 'center',
                borderTop: `1.5px solid ${SITE.line}`,
                opacity: p,
                transform: `translateY(${(1 - p) * 10}px)`,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${highlight * 100}%`,
                  backgroundColor: 'rgba(244,196,48,0.16)',
                }}
              />
              <div style={{ width: 260, paddingLeft: 32, fontSize: 30, fontWeight: 700, color: SITE.orange }}>
                {row.deadline}
              </div>
              <div style={{ width: 300 }}>
                <Chip tone={index === 0 ? 'sage' : 'line'}>{row.type}</Chip>
              </div>
              <div>
                <div style={{ fontSize: 32, fontWeight: 600 }}>{row.title}</div>
                <div style={{ fontSize: 25, color: SITE.muted, marginTop: 2 }}>{row.org}</div>
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ fontSize: 27, fontWeight: 600, color: C.green, paddingRight: 32 }}>View →</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
