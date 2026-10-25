import React from 'react'
import { spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { C } from '../theme'
import { Chip, Hero, SITE, SiteHeader } from './SiteChrome'

const STORIES = [
  {
    category: 'Academics',
    title: 'New 300 level outlines published',
    date: '12 October 2026',
    tint: C.sage,
    art: '#0c4a24',
  },
  {
    category: 'Industry',
    title: 'Materials Horizon 3.0: the new frontier',
    date: '28 September 2026',
    tint: C.peach,
    art: '#ff5a1f',
  },
  {
    category: 'Welfare',
    title: 'Exam timetable and study resources',
    date: '20 September 2026',
    tint: '#fdf3d8',
    art: '#f4c430',
  },
]

export const NewsScreen: React.FC<{ start?: number }> = ({ start = 0 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <SiteHeader active="Community" />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 126 }}>
        <Hero title="Department News" subtitle="News and announcements" />
      </div>

      <div style={{ position: 'absolute', left: 64, top: 466, display: 'flex', gap: 16 }}>
        <Chip tone="dark">All</Chip>
        {['Academics', 'Governance', 'Welfare', 'Industry'].map((category) => (
          <Chip key={category}>{category}</Chip>
        ))}
      </div>

      <div style={{ position: 'absolute', left: 64, top: 556, display: 'flex', gap: 26 }}>
        {STORIES.map((story, index) => {
          const p = spring({ frame: frame - (start + index * 5), fps, config: { damping: 18, mass: 0.6 } })
          return (
            <div
              key={story.title}
              style={{
                width: 580,
                borderRadius: 14,
                border: `1.5px solid ${SITE.line}`,
                backgroundColor: SITE.card,
                overflow: 'hidden',
                opacity: p,
                transform: `translateY(${(1 - p) * 14}px)`,
              }}
            >
              {/* No image: the live feed had none, and a letter in a circle reads
                  as a broken image. Two brand shapes on the card's tint instead. */}
              <div style={{ height: 214, backgroundColor: story.tint, position: 'relative', overflow: 'hidden' }}>
                <div
                  style={{
                    position: 'absolute',
                    width: 300,
                    height: 300,
                    borderRadius: '50%',
                    backgroundColor: story.art,
                    opacity: 0.14,
                    right: -70,
                    top: -110,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    width: 210,
                    height: 210,
                    borderRadius: '50%',
                    backgroundColor: story.art,
                    opacity: 0.1,
                    left: -50,
                    bottom: -80,
                  }}
                />
              </div>
              <div style={{ padding: '22px 26px 28px' }}>
                <div style={{ fontSize: 23, fontWeight: 700, color: SITE.orange, letterSpacing: 0.4 }}>
                  {story.category}
                </div>
                <div style={{ fontSize: 33, fontWeight: 700, lineHeight: 1.22, marginTop: 8, minHeight: 80 }}>
                  {story.title}
                </div>
                <div style={{ fontSize: 24, color: SITE.muted, marginTop: 10 }}>{story.date}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
