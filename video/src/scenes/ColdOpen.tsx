import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import type { Beat } from '../beats'
import { Backdrop } from '../components/Backdrop'
import { Caption } from '../components/Caption'
import { float } from '../motion'
import { C, FONT, useLayout } from '../theme'

const MESSAGES = [
  { who: 'Coursemate 1', text: 'who has the outline??' },
  { who: 'Coursemate 2', text: 'outline for which course' },
  { who: 'Coursemate 3', text: 'anybody? the outline!!' },
  { who: 'You', text: 'i also need the outline', mine: true },
  { who: 'Coursemate 1', text: 'WHO HAS THE OUTLINE' },
  { who: 'Coursemate 4', text: 'exam is monday o' },
  { who: 'Coursemate 2', text: 'someone should just check the hub', mine: false },
]

const Chat: React.FC<{ portrait: boolean }> = ({ portrait }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const width = portrait ? 920 : 820
  const top = portrait ? 260 : 66
  const header = portrait ? 104 : 88
  const bodyPad = portrait ? 30 : 26

  return (      <div
        style={{
          position: 'absolute',
          left: '50%',
          top,
          width,
          transform: `translateX(-50%) translateY(${float(frame, 3, 90)}px)`,
          borderRadius: 20,
          overflow: 'hidden',
          backgroundColor: C.white,
          boxShadow: '0 30px 70px rgba(12,23,16,0.18)',
        }}
      >
      <div
        style={{
          height: header,
          backgroundColor: C.green,
          color: C.white,
          fontFamily: FONT.sans,
          fontWeight: 800,
          fontSize: portrait ? 44 : 38,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: portrait ? 34 : 28,
        }}
      >
        Class group chat
      </div>
      <div
        style={{
          backgroundColor: '#efeae2',
          padding: bodyPad,
          display: 'flex',
          flexDirection: 'column',
          gap: portrait ? 22 : 18,
        }}
      >
        {MESSAGES.map((message, index) => {
          // Not rendered before it is due: a bubble at opacity 0 still takes
          // layout height, which leaves the card half empty for the first second.
          if (frame < 1 + index * 6) return null
          const p = spring({
            frame: frame - 1 - index * 6,
            fps,
            config: { damping: 15, mass: 0.55, stiffness: 160 },
          })
          return (
            <div
              key={message.text}
              style={{
                alignSelf: message.mine ? 'flex-end' : 'flex-start',
                maxWidth: '86%',
                opacity: p,
                transform: `translateY(${(1 - p) * 10}px) scale(${0.94 + 0.06 * p})`,
              }}
            >
              <div
                style={{
                  backgroundColor: message.mine ? '#d9fdd3' : C.white,
                  borderRadius: 16,
                  padding: portrait ? '16px 22px' : '13px 18px',
                  boxShadow: '0 2px 6px rgba(12,23,16,0.08)',
                }}
              >
                <div
                  style={{
                    fontFamily: FONT.sans,
                    fontWeight: 700,
                    fontSize: portrait ? 24 : 21,
                    color: message.mine ? C.orange : '#ae323f',
                    marginBottom: 4,
                  }}
                >
                  {message.who}
                </div>
                <div
                  style={{
                    fontFamily: FONT.sans,
                    fontWeight: 500,
                    fontSize: portrait ? 34 : 30,
                    color: C.ink,
                    lineHeight: 1.2,
                  }}
                >
                  {message.text}
                </div>
              </div>
            </div>
          )
        })}

        {/* The thread keeps talking after the last bubble lands, so the shot
            never freezes on a still frame of a chat. */}
        <div
          style={{
            alignSelf: 'flex-start',
            backgroundColor: C.white,
            borderRadius: 16,
            padding: portrait ? '16px 22px' : '13px 18px',
            display: 'flex',
            gap: 7,
            opacity: interpolate(frame, [44, 50], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          }}
        >
          {[0, 1, 2].map((dot) => (
            <div
              key={dot}
              style={{
                width: portrait ? 12 : 10,
                height: portrait ? 12 : 10,
                borderRadius: '50%',
                backgroundColor: 'rgba(12,23,16,0.35)',
                transform: `translateY(${Math.sin((frame / 6 + dot * 0.8) * Math.PI) * 3}px)`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

const SlamLabel: React.FC<{
  text: string
  tone: 'orange' | 'yellow'
  delay: number
  top: number
  rotate: number
  portrait: boolean
}> = ({ text, tone, delay, top, rotate, portrait }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const p = spring({ frame: frame - delay, fps, config: { damping: 11, mass: 0.7, stiffness: 180 } })
  // The slam shakes the frame for four frames after impact, which is what sells
  // the weight of the label landing.
  const since = frame - delay
  const shake = since >= 0 && since < 5 ? (5 - since) * 2.2 : 0
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top,
        display: 'flex',
        justifyContent: 'center',
        transform: `translate(${Math.sin(since * 3.1) * shake}px, ${Math.cos(since * 2.3) * shake * 0.6}px) rotate(${rotate}deg) scale(${1.35 - 0.35 * p})`,
        opacity: p,
      }}
    >
      <div
        style={{
          backgroundColor: tone === 'orange' ? C.orange : C.yellow,
          color: tone === 'orange' ? C.white : C.ink,
          fontFamily: FONT.serif,
          fontWeight: 800,
          fontSize: portrait ? 78 : 70,
          padding: portrait ? '20px 46px' : '16px 42px',
          borderRadius: 10,
          boxShadow: '0 18px 36px rgba(0,0,0,0.35)',
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </div>
    </div>
  )
}

export const ColdOpen: React.FC<{ beat: Beat; mode: 'chat' | 'stamp' }> = ({ beat, mode }) => {
  const { portrait } = useLayout()
  const frame = useCurrentFrame()

  if (mode === 'chat') {
    return (
      <AbsoluteFill>
        <Backdrop variant="cream" />
        <Chat portrait={portrait} />
        <Caption line1={beat.line1} highlight={beat.highlight} duration={beat.durationInFrames} />
      </AbsoluteFill>
    )
  }

  const outgoing = interpolate(frame, [0, 9], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const incoming = interpolate(frame, [4, 13], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill>
      <Backdrop variant="dark" />
      <SlamLabel
        text="Where is the outline?"
        tone="orange"
        delay={0}
        top={portrait ? 560 : 300}
        rotate={-2.5}
        portrait={portrait}
      />
      <SlamLabel
        text="When is the exam?"
        tone="yellow"
        delay={8}
        top={portrait ? 720 : 456}
        rotate={1.8}
        portrait={portrait}
      />

      {/* A crossfade, not two boxes: the outgoing copy is gone before the new
          caption finishes arriving. */}
      <AbsoluteFill style={{ opacity: outgoing }}>
        <Caption line1="Who has the outline?" highlight="outline?" duration={beat.durationInFrames} instant />
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: incoming }}>
        <Caption
          line1={beat.line1}
          highlight={beat.highlight}
          duration={beat.durationInFrames}
          instant
        />
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
