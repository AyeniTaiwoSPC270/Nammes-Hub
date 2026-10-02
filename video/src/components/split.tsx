import React from 'react'
import { useLayout } from '../layout'
import { Stage } from './ui'

export const clampOpts = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

// Browser frames in the "screenshot" scenes are all BW px wide. SC converts screenshot pixels (1280 wide) to frame pixels.
export const BW = 1000
export const SC = BW / 1280
export const CHROME = Math.round(BW * 0.034)

// Source pixel (in the 1280-wide screenshot) -> position inside the frame container (for placing the cursor).
export const at = (x: number, y: number) => ({ x: x * SC, y: CHROME + y * SC })

// Device frame on one side, callouts on the other (landscape); stacked in portrait.
// In landscape the frame is scaled up (LANDSCAPE_ZOOM) so screenshot text stays readable on a 1080p canvas.
export const LANDSCAPE_ZOOM = 1.18

export const Split: React.FC<{ frame: React.ReactNode; side: React.ReactNode; frameH: number; frameW?: number }> = ({ frame, side, frameH, frameW = BW }) => {
  const L = useLayout()
  const z = L.portrait ? 1 : LANDSCAPE_ZOOM
  return (
    <Stage style={{ display: 'flex', flexDirection: L.portrait ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: L.portrait ? 44 : 70 }}>
      <div style={{ position: 'relative', width: frameW * z, height: frameH * z, flexShrink: 0 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: frameW, height: frameH, transform: `scale(${z})`, transformOrigin: '0 0' }}>{frame}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: L.portrait ? 'row' : 'column', flexWrap: 'wrap', justifyContent: 'center', gap: L.portrait ? 20 : 26, maxWidth: L.portrait ? L.sw / 1.3 : 520, zoom: L.portrait ? 1.3 : 1 }}>{side}</div>
    </Stage>
  )
}

export const Skel: React.FC<{ w: number | string; h?: number; tone?: string }> = ({ w, h = 14, tone = '#e7e2e0' }) => <div style={{ width: w, height: h, borderRadius: h / 2, background: tone }} />
