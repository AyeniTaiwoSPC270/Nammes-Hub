import { Easing, interpolate, spring } from 'remotion'

/** Spring scale-in used by pills and cards. `delay` is a local frame offset. */
export function pop(frame: number, fps: number, delay = 0, damping = 14) {
  return spring({ frame: frame - delay, fps, config: { damping, mass: 0.6, stiffness: 140 } })
}

/** Fade-and-rise entrance. Returns opacity and a translateY in design px. */
export function rise(frame: number, fps: number, delay = 0, distance = 10) {
  const p = spring({ frame: frame - delay, fps, config: { damping: 18, mass: 0.7 } })
  return { opacity: p, transform: `translateY(${(1 - p) * distance}px)` }
}

/** Fade in over `frames`, clamped. */
export function fadeIn(frame: number, delay = 0, frames = 10) {
  return interpolate(frame - delay, [0, frames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
}

/** Fade out over the last `frames` of a sequence. */
export function fadeOut(frame: number, duration: number, frames = 6) {
  return interpolate(frame, [duration - frames, duration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
}

interface CameraOptions {
  zoomFrom?: number
  zoomTo?: number
  /** Design px the frame drifts over the shot. */
  driftX?: number
  driftY?: number
  duration: number
  /** Start the move later so a cut can land still and then creep. */
  delay?: number
}

/**
 * The camera never stops. Every framed shot gets a slow push and a small drift,
 * eased across the whole shot, because a held screenshot reads as a slide, not
 * as a video. Callers pass the shot length so the move always finishes with it.
 */
export function camera(frame: number, { zoomFrom = 1, zoomTo = 1.045, driftX = 0, driftY = 0, duration, delay = 0 }: CameraOptions) {
  const p = interpolate(frame - delay, [0, Math.max(1, duration - delay)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.ease),
  })
  const zoom = zoomFrom + (zoomTo - zoomFrom) * p
  return `translate(${driftX * p}px, ${driftY * p}px) scale(${zoom})`
}

/** Continuous sine offset in design px. Phase is in radians. */
export function float(frame: number, amplitude: number, period: number, phase = 0) {
  return Math.sin((frame / period) * Math.PI * 2 + phase) * amplitude
}

/** Continuous breathe scale, centred on 1. */
export function breathe(frame: number, amount: number, period: number, phase = 0) {
  return 1 + Math.sin((frame / period) * Math.PI * 2 + phase) * amount
}

/** A caret that blinks on a fixed period. Returns 0 or 1. */
export function blink(frame: number, period = 16) {
  return Math.floor(frame / period) % 2 === 0 ? 1 : 0
}

/** 0→1 sweep across a shot, for a shine or a progress bar. */
export function sweep(frame: number, start: number, duration: number) {
  return interpolate(frame - start, [0, duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.ease),
  })
}
