import React from 'react'
import { spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { C } from '../theme'
import { Chip, Hero, SITE, SiteHeader, TrophyIcon } from './SiteChrome'

const CATEGORIES = [
  { title: 'Best Graduating Student', detail: 'Highest final CGPA in the 2025/26 session', tint: C.sage },
  { title: 'Most Innovative Project', detail: 'Voted by the department academic staff', tint: C.peach },
  { title: 'Exco of the Session', detail: 'Recognising service to the chapter', tint: '#fdf3d8' },
]

export const AwardsScreen: React.FC<{ start?: number }> = ({ start = 0 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <SiteHeader active="Community" />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 126 }}>
        <Hero title="Annual Awards" subtitle="Nominate, vote, and celebrate the outstanding members of the department." />
      </div>

      <div style={{ position: 'absolute', left: 64, top: 466, fontSize: 44, fontWeight: 700, letterSpacing: -0.6 }}>
        2025/2026 categories
      </div>
      <div style={{ position: 'absolute', left: 64, top: 526, fontSize: 28, color: SITE.muted }}>
        Nominations close 30 November.
      </div>

      <div style={{ position: 'absolute', left: 64, top: 600, display: 'flex', gap: 26 }}>
        {CATEGORIES.map((category, index) => {
          const p = spring({ frame: frame - (start + index * 5), fps, config: { damping: 18, mass: 0.6 } })
          return (
            <div
              key={category.title}
              style={{
                width: 580,
                height: 380,
                borderRadius: 14,
                border: `1.5px solid ${SITE.line}`,
                backgroundColor: SITE.card,
                padding: '34px 32px',
                opacity: p,
                transform: `translateY(${(1 - p) * 14}px)`,
              }}
            >
              <div
                style={{
                  width: 92,
                  height: 92,
                  borderRadius: 18,
                  backgroundColor: category.tint,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TrophyIcon size={54} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: SITE.orange, marginTop: 24, letterSpacing: 0.4 }}>
                AWARD CATEGORY
              </div>
              <div style={{ fontSize: 38, fontWeight: 700, lineHeight: 1.2, marginTop: 8 }}>{category.title}</div>
              <div style={{ fontSize: 26, color: SITE.muted, marginTop: 10 }}>{category.detail}</div>
              <div style={{ marginTop: 24 }}>
                <Chip tone="orange">Nominate</Chip>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
