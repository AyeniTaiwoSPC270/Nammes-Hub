import React from 'react'
import { random } from 'remotion'
import { C } from '../brand'

// A QR-style picture for the video (decorative, not scannable): three finder squares plus seeded noise.
const N = 25

export const Qr: React.FC<{ size: number; seed?: string; fg?: string; bg?: string }> = ({ size, seed = 'qr', fg = C.ink, bg = C.white }) => {
  const cell = size / N
  const cells: React.ReactNode[] = []
  const inFinder = (x: number, y: number) => (x < 8 && y < 8) || (x >= N - 8 && y < 8) || (x < 8 && y >= N - 8)
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (inFinder(x, y)) continue
      if (random(`${seed}-${x}-${y}`) > 0.52) cells.push(<rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell + 0.4} height={cell + 0.4} fill={fg} />)
    }
  }
  const finder = (fx: number, fy: number) => (
    <g key={`${fx}-${fy}`} transform={`translate(${fx * cell} ${fy * cell})`}>
      <rect width={7 * cell} height={7 * cell} fill={fg} />
      <rect x={cell} y={cell} width={5 * cell} height={5 * cell} fill={bg} />
      <rect x={2 * cell} y={2 * cell} width={3 * cell} height={3 * cell} fill={fg} />
    </g>
  )
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ background: bg, borderRadius: size * 0.04, display: 'block' }}>
      {cells}
      {finder(0, 0)}
      {finder(N - 7, 0)}
      {finder(0, N - 7)}
    </svg>
  )
}
