import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, FONT } from '../theme'
import { Cursor } from '../components/Cursor'
import { SITE, SiteHeader } from './SiteChrome'

const ROWS = [
  { code: 'CHM-CM 101', units: 2, grade: 'A' },
  { code: 'GET 101', units: 1, grade: 'B' },
  { code: 'GET 103', units: 2, grade: 'A' },
  { code: 'MTH 101', units: 2, grade: 'B' },
  { code: 'PHY-CM 101', units: 2, grade: 'A' },
  { code: 'PHY-CM 103', units: 2, grade: 'C' },
]

const gradeTone = (grade: string) =>
  grade === 'A'
    ? { bg: C.sage, fg: C.green }
    : grade === 'B'
      ? { bg: C.peach, fg: C.orange }
      : { bg: '#f7e6dd', fg: '#ae3200' }

interface Props {
  start?: number
  /** Grades already entered and the total already at 4.36. */
  settled?: boolean
  /** Frame (local to the beat) the PDF chip slides out. */
  reportAt?: number
  cursor?: { from: { x: number; y: number }; to: { x: number; y: number }; clickAt: number }
}

export const CgpaScreen: React.FC<Props> = ({ start = 0, settled = false, reportAt, cursor }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const count = settled
    ? 4.36
    : interpolate(frame, [start + 16, start + 42], [0, 4.36], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
  const reportIn = reportAt === undefined
    ? 0
    : spring({ frame: frame - reportAt, fps, config: { damping: 16, mass: 0.6 } })

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <SiteHeader active="Academics" />

      <div style={{ position: 'absolute', left: 64, top: 186, fontSize: 26, letterSpacing: 1.6, fontWeight: 700, color: SITE.orange }}>
        CGPA CALCULATOR
      </div>
      <div style={{ position: 'absolute', left: 64, top: 222, fontSize: 58, fontWeight: 700, letterSpacing: -1 }}>
        100 Level · First Semester
      </div>
      <div style={{ position: 'absolute', left: 64, top: 296, fontSize: 28, color: SITE.muted }}>
        Enter a grade for each course and the CGPA updates as you type.
      </div>

      <div
        style={{
          position: 'absolute',
          left: 64,
          top: 360,
          width: 1118,
          border: `1.5px solid ${SITE.line}`,
          borderRadius: 16,
          overflow: 'hidden',
          backgroundColor: SITE.card,
        }}
      >
        <div
          style={{
            display: 'flex',
            height: 66,
            alignItems: 'center',
            backgroundColor: SITE.soft,
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: 1.2,
            color: SITE.muted,
          }}
        >
          <div style={{ width: 430, paddingLeft: 34 }}>COURSE CODE</div>
          <div style={{ width: 300 }}>UNITS</div>
          <div>GRADE</div>
        </div>
        {ROWS.map((row, index) => {
          const p = settled
            ? 1
            : spring({ frame: frame - (start + 12 + index * 4), fps, config: { damping: 14, mass: 0.5 } })
          const tone = gradeTone(row.grade)
          return (
            <div
              key={row.code}
              style={{
                display: 'flex',
                alignItems: 'center',
                height: 78,
                borderTop: `1.5px solid ${SITE.line}`,
                fontSize: 30,
                color: SITE.ink,
              }}
            >
              <div style={{ width: 430, paddingLeft: 34, fontWeight: 500, letterSpacing: 0.4 }}>{row.code}</div>
              <div style={{ width: 300, color: SITE.muted }}>{row.units}</div>
              <div style={{ width: 320 }}>
                <div
                  style={{
                    width: 58,
                    height: 54,
                    borderRadius: 10,
                    backgroundColor: tone.bg,
                    color: tone.fg,
                    fontWeight: 800,
                    fontSize: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: p,
                    transform: `scale(${0.6 + 0.4 * p})`,
                  }}
                >
                  {row.grade}
                </div>
              </div>
            </div>
          )
        })}
        <div
          style={{
            borderTop: `1.5px solid ${SITE.line}`,
            height: 58,
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 34,
            fontSize: 24,
            color: SITE.muted,
          }}
        >
          A = 5.0 · B = 4.0 · C = 3.0
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 1230,
          top: 360,
          width: 626,
          borderRadius: 18,
          backgroundColor: C.greenDeep,
          padding: '32px 38px 34px',
        }}
      >
        <div style={{ fontSize: 24, letterSpacing: 1.4, fontWeight: 700, color: C.yellow }}>CUMULATIVE GPA</div>
        <div style={{ fontSize: 122, fontWeight: 700, fontFamily: FONT.serif, color: C.yellow, lineHeight: 1.05, marginTop: 4 }}>
          {count.toFixed(2)}
        </div>
        <div style={{ fontSize: 25, color: 'rgba(255,255,255,0.78)' }}>11 units completed</div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 1230,
          top: 690,
          width: 380,
          height: 82,
          borderRadius: 12,
          backgroundColor: SITE.orange,
          color: C.white,
          fontSize: 31,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Download report
      </div>

      {reportAt !== undefined ? (
        <div
          style={{
            position: 'absolute',
            left: 1230,
            top: 796,
            width: 470,
            height: 78,
            borderRadius: 12,
            border: `1.5px solid ${SITE.line}`,
            backgroundColor: SITE.card,
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            paddingLeft: 20,
            opacity: reportIn,
            transform: `translateX(${(1 - reportIn) * 40}px)`,
          }}
        >
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 9,
              backgroundColor: '#ae3200',
              color: C.white,
              fontWeight: 800,
              fontSize: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            PDF
          </div>
          <div style={{ fontSize: 30, fontWeight: 600 }}>CGPA report</div>
        </div>
      ) : null}

      <div style={{ position: 'absolute', left: 64, top: 962, fontSize: 27, color: SITE.muted }}>
        Sign in and your grades are saved to your account.
      </div>

      {cursor ? (
        <Cursor
          from={cursor.from}
          to={cursor.to}
          clickAt={cursor.clickAt}
          size={64}
          clickScale={1.4}
          moveAt={cursor.clickAt - 18}
        />
      ) : null}
    </div>
  )
}
