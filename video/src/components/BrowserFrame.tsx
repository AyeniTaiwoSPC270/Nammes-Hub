import React from 'react'
import { Img, useVideoConfig } from 'remotion'
import { C } from '../theme'

interface Props {
  src?: string
  url: string
  x: number
  y: number
  width: number
  height: number
  /** Uniform scale applied to the chrome so 9:16 chrome is not hairline-thin. */
  scale?: number
  children?: React.ReactNode
}

/**
 * macOS chrome drawn in React, never baked into a screenshot: the screenshot is
 * live site content and has to be replaceable without redrawing the window.
 */
export const BrowserFrame: React.FC<Props> = ({ src, url, x, y, width, height, scale = 1, children }) => {
  const { width: canvasWidth, height: canvasHeight } = useVideoConfig()
  const u = (canvasHeight > canvasWidth ? canvasWidth / 1080 : canvasWidth / 1920) * scale
  const chrome = Math.round(52 * u)
  const radius = Math.round(16 * u)

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        borderRadius: radius,
        overflow: 'hidden',
        backgroundColor: '#f4f1ee',
        boxShadow: '0 26px 60px rgba(0,0,0,0.34)',
        border: `${Math.max(1, Math.round(u))}px solid rgba(12,23,16,0.14)`,
      }}
    >
      <div
        style={{
          height: chrome,
          display: 'flex',
          alignItems: 'center',
          gap: Math.round(10 * u),
          paddingLeft: Math.round(18 * u),
          paddingRight: Math.round(18 * u),
          backgroundColor: '#f4f1ee',
          borderBottom: `${Math.max(1, Math.round(u))}px solid rgba(12,23,16,0.1)`,
        }}
      >
        <div style={{ display: 'flex', gap: Math.round(8 * u) }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((dot) => (
            <div
              key={dot}
              style={{
                width: Math.round(13 * u),
                height: Math.round(13 * u),
                borderRadius: '50%',
                backgroundColor: dot,
              }}
            />
          ))}
        </div>
        <div
          style={{
            flex: 1,
            height: Math.round(30 * u),
            marginLeft: Math.round(10 * u),
            borderRadius: Math.round(8 * u),
            backgroundColor: C.white,
            display: 'flex',
            alignItems: 'center',
            paddingLeft: Math.round(14 * u),
            color: 'rgba(12,23,16,0.62)',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: Math.round(19 * u),
            letterSpacing: 0.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          {url}
        </div>
      </div>

      <div style={{ position: 'absolute', inset: `${chrome}px 0 0 0`, overflow: 'hidden', backgroundColor: C.white }}>
        {children ??
          (src ? (
            <Img
              src={src}
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}
            />
          ) : null)}
      </div>
    </div>
  )
}
