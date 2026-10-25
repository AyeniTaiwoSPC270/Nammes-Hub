import React from 'react'
import { spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { C } from '../theme'
import { SITE, SiteHeader, Breadcrumb, Chip } from './SiteChrome'

const BLOCKS = [
  ['CHM-CM 101', '8:00 – 10:00', 'GET 101', '10:00 – 12:00', 'MTH 101', '2:00 – 4:00'],
  ['PHY-CM 101', '8:00 – 10:00', 'GET 103', '12:00 – 2:00', '—', ''],
  ['CHM-CM 101', '10:00 – 12:00', 'PHY-CM 103', '12:00 – 2:00', '—', ''],
  ['MTH 101', '8:00 – 10:00', 'GET 101', '10:00 – 12:00', 'GET 103', '2:00 – 4:00'],
  ['PHY-CM 103', '10:00 – 12:00', 'CHM-CM 101', '12:00 – 2:00', '—', ''],
]

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

const TINTS = [
  { bg: C.sage, fg: C.green },
  { bg: C.peach, fg: C.orange },
  { bg: '#fdf3d8', fg: '#8a5b00' },
  { bg: '#eef1f5', fg: '#31404d' },
]

export const TimetableScreen: React.FC<{ start?: number }> = ({ start = 0 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <SiteHeader active="Academics" />
      <div style={{ position: 'absolute', left: 64, top: 182 }}>
        <Breadcrumb parts={['Timetable', '100 Level']} />
      </div>
      <div style={{ position: 'absolute', left: 64, top: 226, fontSize: 56, fontWeight: 700, letterSpacing: -0.8 }}>
        100 Level Timetable
      </div>

      <div
        style={{
          position: 'absolute',
          left: 64,
          top: 322,
          width: 1792,
          height: 92,
          borderRadius: 16,
          border: `1.5px solid ${SITE.line}`,
          backgroundColor: SITE.card,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '0 22px',
        }}
      >
        <Chip tone="dark">First Semester</Chip>
        <Chip>Second Semester</Chip>
        <div style={{ width: 0 }} />
        <Chip tone="sage">Class Timetable</Chip>
        <Chip>Exam Timetable</Chip>
        <div style={{ flex: 1 }} />
        <Chip tone="dark">All</Chip>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day) => (
          <div key={day} style={{ fontSize: 26, color: SITE.muted, width: 62, textAlign: 'center' }}>
            {day}
          </div>
        ))}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 64,
          top: 440,
          width: 1792,
          borderRadius: 16,
          border: `1.5px solid ${SITE.line}`,
          backgroundColor: SITE.card,
          padding: '18px 24px',
        }}
      >
        {BLOCKS.map((row, rowIndex) => (
          <div key={row[0]} style={{ display: 'flex', alignItems: 'center', gap: 26, height: 96 }}>
            <div style={{ width: 92, fontSize: 27, fontWeight: 600, color: SITE.muted }}>{DAYS[rowIndex]}</div>
            {[0, 1, 2].map((slot) => {
              const label = row[slot * 2]
              const time = row[slot * 2 + 1]
              const index = rowIndex * 3 + slot
              const p = spring({ frame: frame - (start + index * 2), fps, config: { damping: 16, mass: 0.5 } })
              if (label === '—' || !label) {
                return <div key={slot} style={{ flex: 1, height: 62, borderRadius: 10, backgroundColor: '#f6f4f2' }} />
              }
              const tint = TINTS[(rowIndex + slot) % TINTS.length]
              return (
                <div
                  key={slot}
                  style={{
                    flex: 1,
                    height: 62,
                    borderRadius: 10,
                    backgroundColor: tint.bg,
                    color: tint.fg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 22px',
                    fontSize: 26,
                    fontWeight: 600,
                    opacity: p,
                    transform: `translateY(${(1 - p) * 8}px)`,
                  }}
                >
                  <span>{label}</span>
                  <span style={{ opacity: 0.75, fontWeight: 500 }}>{time}</span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
