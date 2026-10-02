import React from 'react'
import { useCurrentFrame } from 'remotion'
import CharacterSvg from './CharacterSvg'
import { avatarInfo } from './quizCharacters'

export type Mood = 'idle' | 'happy' | 'dance' | 'sad' | 'wave' | 'static'

// A quiz character with Remotion-driven motion (the site uses CSS animation; video frames need it computed per frame).
export const Avatar: React.FC<{ id: number; size: number; mood?: Mood; phase?: number; style?: React.CSSProperties }> = ({ id, size, mood = 'idle', phase = 0, style }) => {
  const frame = useCurrentFrame() + phase * 7 + id * 3
  let ty = 0
  let rot = 0
  let sx = 1
  let sy = 1
  let angR = 0
  let angL = 0
  if (mood === 'idle') {
    ty = Math.sin(frame / 6) * size * 0.03
    sy = 1 + Math.sin(frame / 6) * 0.015
  } else if (mood === 'happy' || mood === 'dance') {
    const hop = Math.abs(Math.sin(frame / 4.5))
    ty = -hop * size * 0.14
    rot = Math.sin(frame / 4.5) * (mood === 'dance' ? 9 : 4)
    sy = 1 + (1 - hop) * -0.05
    angR = -70 + Math.sin(frame / 3) * 25
    angL = 70 - Math.sin(frame / 3) * 25
  } else if (mood === 'wave') {
    ty = Math.sin(frame / 7) * size * 0.02
    angR = -110 + Math.sin(frame / 2.5) * 22
  } else if (mood === 'sad') {
    ty = size * 0.02
    sy = 0.97
    rot = Math.sin(frame / 9) * 1.5
  }
  return (
    <div style={{ width: size, height: size, transform: `translateY(${ty}px) rotate(${rot}deg) scale(${sx}, ${sy})`, transformOrigin: '50% 90%', ...style }}>
      <CharacterSvg id={id} mood={mood === 'wave' ? 'idle' : mood} angleL={angL} angleR={angR} />
    </div>
  )
}

export const characterName = (id: number) => avatarInfo(id).name
