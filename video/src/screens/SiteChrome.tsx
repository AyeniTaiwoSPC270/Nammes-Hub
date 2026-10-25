import React from 'react'
import { Img, staticFile } from 'remotion'
import { C, FONT } from '../theme'

/**
 * Mock screens are drawn at the same pixel scale as the 1920px captures
 * (a 1280 CSS viewport at 1.5x), then scaled to the frame. That way a real
 * screenshot and a rebuilt screen sit in the same frame without a visible
 * change in type size.
 */
export const MOCK_W = 1920
export const MOCK_H = 1100

export const SITE = {
  ink: '#0e1a12',
  muted: 'rgba(14,26,18,0.6)',
  line: 'rgba(14,26,18,0.12)',
  page: '#fcf9f8',
  card: '#ffffff',
  soft: '#f4f1ef',
  hero: '#0b3b1f',
  orange: C.orange,
  green: C.green,
  sage: C.sage,
  peach: C.peach,
}

export const MockScreen: React.FC<{ width: number; children: React.ReactNode }> = ({ width, children }) => {
  const scale = width / MOCK_W
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: MOCK_W,
        height: MOCK_H,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        backgroundColor: SITE.page,
        color: SITE.ink,
        fontFamily: FONT.sans,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  )
}

export const Chevron: React.FC<{ size?: number; color?: string }> = ({ size = 22, color = SITE.muted }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
    <path d="M9 5l7 7-7 7" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const MoonIcon: React.FC = () => (
  <svg width={30} height={30} viewBox="0 0 24 24" fill="none">
    <path
      d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"
      stroke={SITE.ink}
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
  </svg>
)

export const SiteHeader: React.FC<{ active: string }> = ({ active }) => {
  const items = ['General', 'Academics', 'Community', 'Practice', 'Support']
  return (
    <div
      style={{
        height: 126,
        display: 'flex',
        alignItems: 'center',
        padding: '0 64px',
        backgroundColor: SITE.card,
        borderBottom: `1.5px solid ${SITE.line}`,
        gap: 18,
      }}
    >
      <Img src={staticFile('logo.png')} style={{ height: 58, width: 'auto' }} />
      <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: -0.6, color: SITE.ink }}>NAMMES Hub</div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 46 }}>
        {items.map((item) => {
          const on = item === active
          return (
            <div
              key={item}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                fontSize: 31,
                fontWeight: on ? 700 : 500,
                color: on ? SITE.ink : SITE.muted,
                height: 126,
                borderBottom: on ? `4px solid ${SITE.green}` : '4px solid transparent',
                paddingTop: 2,
              }}
            >
              {item}
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
              </svg>
            </div>
          )
        })}
      </div>
      <div style={{ flex: 0.22 }} />
      <div
        style={{
          backgroundColor: SITE.green,
          color: C.white,
          fontSize: 29,
          fontWeight: 700,
          padding: '16px 32px',
          borderRadius: 12,
        }}
      >
        Sign in
      </div>
      <div
        style={{
          width: 58,
          height: 58,
          borderRadius: 14,
          border: `1.5px solid ${SITE.line}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: 12,
        }}
      >
        <MoonIcon />
      </div>
    </div>
  )
}

export const Hero: React.FC<{ title: string; subtitle: string; height?: number }> = ({
  title,
  subtitle,
  height = 300,
}) => (
  <div
    style={{
      height,
      backgroundColor: SITE.hero,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
    }}
  >
    <div style={{ fontSize: 64, fontWeight: 700, color: C.white, letterSpacing: -1 }}>{title}</div>
    <div style={{ fontSize: 33, color: 'rgba(255,255,255,0.85)' }}>{subtitle}</div>
  </div>
)

export const Breadcrumb: React.FC<{ parts: string[] }> = ({ parts }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 27, color: SITE.muted }}>
    {parts.map((part, index) => (
      <React.Fragment key={part}>
        <span style={{ color: index === parts.length - 1 ? SITE.ink : SITE.muted, fontWeight: index === parts.length - 1 ? 600 : 500 }}>
          {part}
        </span>
        {index < parts.length - 1 ? <Chevron size={20} /> : null}
      </React.Fragment>
    ))}
  </div>
)

export const Chip: React.FC<{
  children: React.ReactNode
  tone?: 'line' | 'dark' | 'sage' | 'orange' | 'yellow' | 'peach'
}> = ({ children, tone = 'line' }) => {
  const tones = {
    line: { bg: 'transparent', fg: SITE.ink, border: `1.5px solid ${SITE.line}` },
    dark: { bg: SITE.green, fg: C.white, border: '1.5px solid transparent' },
    sage: { bg: SITE.sage, fg: SITE.green, border: '1.5px solid transparent' },
    orange: { bg: SITE.orange, fg: C.white, border: '1.5px solid transparent' },
    yellow: { bg: C.yellow, fg: SITE.ink, border: '1.5px solid transparent' },
    peach: { bg: SITE.peach, fg: SITE.orange, border: '1.5px solid transparent' },
  }[tone]
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        backgroundColor: tones.bg,
        color: tones.fg,
        border: tones.border,
        borderRadius: 999,
        fontSize: 25,
        fontWeight: 600,
        padding: '10px 26px',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </div>
  )
}

export const CameraIcon: React.FC<{ size?: number; color?: string }> = ({ size = 60, color = C.white }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="6" width="18" height="14" rx="3" stroke={color} strokeWidth={1.7} />
    <path d="M8 6l1.4-2h5.2L16 6" stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
    <circle cx="12" cy="13" r="4" stroke={color} strokeWidth={1.7} />
  </svg>
)

export const TrophyIcon: React.FC<{ size?: number; color?: string }> = ({ size = 52, color = SITE.green }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" stroke={color} strokeWidth={1.8} />
    <path d="M8 5H5v2a3 3 0 0 0 3 3M16 5h3v2a3 3 0 0 1-3 3M12 13v4M8 20h8" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
  </svg>
)
