import React from 'react'
import { C, FONT } from '../theme'

const Instagram: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="5" stroke={C.white} strokeWidth={1.9} />
    <circle cx="12" cy="12" r="4.1" stroke={C.white} strokeWidth={1.9} />
    <circle cx="17.2" cy="6.8" r="1.3" fill={C.white} />
  </svg>
)

const YouTube: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="2.5" y="5.5" width="19" height="13" rx="4" fill={C.white} />
    <path d="M10.4 9.3v5.4l4.6-2.7-4.6-2.7Z" fill={C.orange} />
  </svg>
)

const LinkedIn: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="4" fill={C.white} />
    <path d="M7.4 10.2v7M7.4 7.4v.1M11 17.2v-7M11 13.2c0-1.7 1-2.9 2.7-2.9 1.6 0 2.4 1 2.4 2.8v4.1" stroke={C.green} strokeWidth={1.9} strokeLinecap="round" />
  </svg>
)

const ITEMS = [
  { label: '@unilag_nammes', bg: '#c13584', icon: <Instagram size={30} /> },
  { label: '@nammesunilag', bg: C.orange, icon: <YouTube size={30} /> },
  { label: 'nammes-unilag', bg: C.green, icon: <LinkedIn size={30} /> },
]

export const SocialRow: React.FC<{ portrait: boolean }> = ({ portrait }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: portrait ? 'column' : 'row',
      alignItems: 'center',
      gap: portrait ? 22 : 46,
    }}
  >
    {ITEMS.map((item) => (
      <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: portrait ? 56 : 48,
            height: portrait ? 56 : 48,
            borderRadius: 12,
            backgroundColor: item.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {item.icon}
        </div>
        <div
          style={{
            fontFamily: FONT.sans,
            fontWeight: 600,
            fontSize: portrait ? 38 : 34,
            color: C.white,
            whiteSpace: 'nowrap',
          }}
        >
          {item.label}
        </div>
      </div>
    ))}
  </div>
)
