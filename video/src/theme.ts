import { useVideoConfig } from 'remotion'
import { FONT } from './fonts'

// Sampled from video/out/stills/169/*.png rather than guessed: cream, dark,
// orange and yellow are the four colours every reference frame is built from.
export const C = {
  dark: '#04160c',
  darkLift: '#0a2416',
  darkDot: '#0b2a18',
  cream: '#fcf9f8',
  creamDeep: '#efeae2',
  green: '#0c4a24',
  greenDeep: '#0a381d',
  greenBright: '#145c30',
  sage: '#e6f0ea',
  peach: '#fff0e6',
  orange: '#ff5a1f',
  orangeSoft: '#ffb38f',
  yellow: '#f4c430',
  ink: '#0c1710',
  white: '#ffffff',
  brown: '#2e2513',
  hairline: 'rgba(12, 23, 16, 0.12)',
} as const

export { FONT }

export type Ratio = '16x9' | '9x16'

/** One design pixel at 1080p (16:9) and at 1080x1920 (9:16). */
export function useLayout() {
  const { width, height, fps } = useVideoConfig()
  const portrait = height > width
  return {
    width,
    height,
    fps,
    portrait,
    u: portrait ? width / 1080 : width / 1920,
    captionBottom: portrait ? 330 : 46,
    captionSize: portrait ? 64 : 54,
    captionMaxWidth: portrait ? 920 : Math.round(width * 0.88),
  }
}

export type FrameMode = 'side' | 'meet'

/**
 * The browser frame never moves inside a scene: montage cuts only swap the
 * screenshot, so this is shared by every framed beat.
 */
export function frameBox(portrait: boolean, mode: FrameMode = 'side') {
  if (portrait) return { x: 43, y: 419, w: 994, h: 621 }
  if (mode === 'meet') return { x: 300, y: 118, w: 1320, h: 742 }
  return { x: 84, y: 96, w: 1240, h: 775 }
}

/** Right-hand pill column at 16:9, stacked under the frame at 9:16. */
export function pillColumn(portrait: boolean, frameBottom: number) {
  if (portrait) return { x: 54, y: frameBottom + 44, width: 972, align: 'center' as const }
  return { x: 1370, y: 150, width: 500, align: 'left' as const }
}
