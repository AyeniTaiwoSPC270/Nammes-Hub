import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, FONT_BODY } from '../brand'
import { captionAt } from '../captions'
import { useLayout } from '../layout'

// Burned-in captions for muted viewing (WhatsApp, Reels). Bold, high contrast, two lines at most.
export const Captions: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const L = useLayout()
  const cap = captionAt(frame)
  if (!cap) return null
  const local = frame - cap.start
  const s = spring({ frame: local, fps, config: { damping: 14, stiffness: 220, mass: 0.5 } })
  const out = interpolate(frame, [cap.end - 3, cap.end], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const size = L.portrait ? 64 : 60
  const maxWidth = L.portrait ? L.w - 120 : 1500
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: L.h - L.capBottom, height: L.capHeight, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', pointerEvents: 'none' }}>
      <div
        style={{
          maxWidth, textAlign: 'center', fontFamily: FONT_BODY, fontWeight: 800, fontSize: size, lineHeight: 1.15, color: C.white,
          background: 'rgba(4,22,12,0.92)', padding: `${size * 0.22}px ${size * 0.5}px`, borderRadius: size * 0.42,
          border: `4px solid ${C.gold}`, boxShadow: '0 10px 30px rgba(0,0,0,0.35)', textShadow: '0 2px 0 rgba(0,0,0,0.4)',
          opacity: out * Math.min(1, s * 1.5), transform: `translateY(${(1 - s) * 26}px) scale(${0.94 + 0.06 * s})`,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}
      >
        {cap.text}
      </div>
    </div>
  )
}
