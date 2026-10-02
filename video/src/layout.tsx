import React, { createContext, useContext } from 'react'
import { useVideoConfig } from 'remotion'
import { SAFE_BOTTOM_916, SAFE_TOP_916 } from './constants'

// One set of scenes, two shapes. `useLayout()` tells a scene how big the canvas is and where the usable "stage" is
// (the box where text and devices may sit). In 9:16 the stage respects the safe zone and leaves room for captions.

export type Layout = {
  portrait: boolean
  w: number
  h: number
  // the stage: safe area for content, above the caption band
  x: number
  y: number
  sw: number
  sh: number
  // caption band (bottom edge of the band)
  capBottom: number
  capHeight: number
  // handy scale so type and UI sized "for 1080p landscape" also look right in portrait
  u: number
}

export function computeLayout(w: number, h: number): Layout {
  const portrait = h > w
  if (portrait) {
    const capBottom = h - SAFE_BOTTOM_916
    const capHeight = 230
    const top = SAFE_TOP_916
    const sh = capBottom - capHeight - 20 - top
    return { portrait, w, h, x: 40, y: top, sw: w - 80, sh, capBottom, capHeight, u: 0.95 }
  }
  const capHeight = 150
  const capBottom = h - 40
  return { portrait, w, h, x: 70, y: 40, sw: w - 140, sh: capBottom - capHeight - 20 - 40, capBottom, capHeight, u: 1 }
}

const Ctx = createContext<Layout | null>(null)

export const LayoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { width, height } = useVideoConfig()
  return <Ctx.Provider value={computeLayout(width, height)}>{children}</Ctx.Provider>
}

export function useLayout(): Layout {
  const l = useContext(Ctx)
  if (!l) throw new Error('useLayout must be inside <LayoutProvider>')
  return l
}
