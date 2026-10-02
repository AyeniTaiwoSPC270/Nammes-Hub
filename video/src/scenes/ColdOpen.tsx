import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { C, FONT_BODY, FONT_HEAD, SHADOW } from '../brand'
import { Beats } from '../components/beats'
import { Beat, Card, Logo, Pill, Pop, Shake, Stage, Stamp, Words, useSpr, SNAPPY } from '../components/ui'
import { useLayout } from '../layout'

const Bubble: React.FC<{ who: string; text: string; delay: number; mine?: boolean; size: number }> = ({ who, text, delay, mine, size }) => (
  <Pop from={mine ? 'right' : 'left'} dist={90} delay={delay} config={SNAPPY} style={{ alignSelf: mine ? 'flex-end' : 'flex-start' }}>
    <div
      style={{
        background: mine ? '#d9fdd3' : C.white, color: C.ink, fontFamily: FONT_BODY, fontSize: size, fontWeight: 600,
        padding: `${size * 0.4}px ${size * 0.7}px`, borderRadius: size * 0.7, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', maxWidth: size * 14,
      }}
    >
      <div style={{ fontSize: size * 0.62, fontWeight: 800, color: C.orangeDark, marginBottom: 2 }}>{who}</div>
      {text}
    </div>
  </Pop>
)

const Chat: React.FC = () => {
  const L = useLayout()
  const fs = L.portrait ? 44 : 38
  const w = L.portrait ? 900 : 820
  return (
    <Beat tone="paper" wipe={false}>
      <Stage style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Pop from="up" dist={200}>
          <Card style={{ width: w, padding: 0, overflow: 'hidden', borderRadius: 40 }}>
            <div style={{ background: C.green800, color: C.white, fontFamily: FONT_BODY, fontWeight: 800, fontSize: fs * 0.85, padding: `${fs * 0.6}px ${fs}px` }}>Class group chat</div>
            <div style={{ background: '#efeae2', padding: fs * 0.8, display: 'flex', flexDirection: 'column', gap: fs * 0.5, minHeight: L.portrait ? 620 : 470 }}>
              <Bubble who="Coursemate 1" text="who has the outline??" delay={4} size={fs} />
              <Bubble who="Coursemate 2" text="outline for which course" delay={16} size={fs} />
              <Bubble who="Coursemate 3" text="anybody? the outline!!" delay={28} size={fs} />
              <Bubble who="You" text="i also need the outline" delay={40} mine size={fs} />
              <Bubble who="Coursemate 1" text="WHO HAS THE OUTLINE" delay={52} size={fs} />
            </div>
          </Card>
        </Pop>
      </Stage>
    </Beat>
  )
}

const Photo: React.FC = () => {
  const L = useLayout()
  const frame = useCurrentFrame()
  const z = interpolate(frame, [0, 50], [1, 1.25], { extrapolateRight: 'clamp' })
  const blur = 5 + Math.sin(frame / 4) * 1.5
  const w = L.portrait ? 880 : 760
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  return (
    <Beat tone="dark">
      <Stage style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 36 }}>
        <Pop from="scale" rotate={-3}>
          <div style={{ width: w, transform: `scale(${z}) rotate(-2deg)`, background: '#e8e2d0', borderRadius: 14, padding: 22, boxShadow: SHADOW, filter: `blur(${blur}px)` }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
              {['', ...days].map((d, i) => (
                <div key={i} style={{ background: '#c9c2a8', height: 40, borderRadius: 4, fontFamily: FONT_BODY, fontSize: 22, fontWeight: 700, color: '#666', padding: 6 }}>{d}</div>
              ))}
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} style={{ background: i % 4 === 0 ? '#b7b08f' : '#d8d1b8', height: 54, borderRadius: 4 }} />
              ))}
            </div>
          </div>
        </Pop>
        <Pop delay={14} from="up" dist={60}>
          <Pill bg={C.white} color={C.ink} size={L.portrait ? 40 : 34}>IMG_timetable_final(2).jpg</Pill>
        </Pop>
      </Stage>
    </Beat>
  )
}

const Deadline: React.FC = () => {
  const L = useLayout()
  const s = useSpr(0)
  return (
    <Beat tone="paper">
      <Stage style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'relative' }}>
          <Card style={{ width: L.portrait ? 820 : 720, padding: 44, transform: `scale(${0.8 + 0.2 * s})` }}>
            <div style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 30, color: C.orangeDark, letterSpacing: 2 }}>FORM CLOSED</div>
            <div style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: L.portrait ? 64 : 58, color: C.ink, marginTop: 12, lineHeight: 1.1 }}>Registration deadline was yesterday</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 32, color: '#666', marginTop: 16 }}>"I thought it was still open..."</div>
          </Card>
          <div style={{ position: 'absolute', right: -30, top: -40 }}>
            <Stamp text="MISSED!" size={L.portrait ? 76 : 70} delay={10} rotate={10} bg={C.orangeDark} />
          </div>
        </div>
      </Stage>
    </Beat>
  )
}

const StampBeat: React.FC = () => {
  const L = useLayout()
  const size = L.portrait ? 92 : 104
  return (
    <Beat tone="dark">
      <Shake start={8}>
        <Shake start={30}>
          <Stage style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 40 }}>
            <Stamp text="Where is the outline?" size={size} delay={8} rotate={-3} />
            <Stamp text="When is the exam?" size={size} delay={30} rotate={2} bg={C.gold} color={C.green950} />
          </Stage>
        </Shake>
      </Shake>
    </Beat>
  )
}

const LogoBeat: React.FC = () => {
  const L = useLayout()
  const frame = useCurrentFrame()
  const slam = useSpr(0, { damping: 8, stiffness: 220, mass: 0.7 })
  const ring = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' })
  const logoSize = L.portrait ? 380 : 340
  return (
    <Beat tone="dark">
      <Shake start={0} amount={22}>
        <Stage style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 28 }}>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: '50%', top: '50%', width: logoSize * (0.6 + ring * 2.2), height: logoSize * (0.6 + ring * 2.2), marginLeft: -(logoSize * (0.6 + ring * 2.2)) / 2, marginTop: -(logoSize * (0.6 + ring * 2.2)) / 2, borderRadius: '50%', border: `10px solid ${C.orange}`, opacity: 1 - ring }} />
            <div style={{ transform: `scale(${4 - 3 * slam})`, opacity: Math.min(1, frame / 3) }}>
              <Logo size={logoSize} />
            </div>
          </div>
          <Pop delay={10} from="up" dist={80}>
            <div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: L.portrait ? 130 : 136, color: C.white, letterSpacing: '-0.02em', lineHeight: 1 }}>NAMMES Hub</div>
          </Pop>
          <Words text="Everything. One address." size={L.portrait ? 64 : 62} head={false} color={C.gold} delay={22} align="center" />
        </Stage>
      </Shake>
    </Beat>
  )
}

export const ColdOpen: React.FC = () => (
  <AbsoluteFill>
    <Beats scene="cold" beats={{ chat: <Chat />, photo: <Photo />, deadline: <Deadline />, stamp: <StampBeat />, logo: <LogoBeat /> }} />
  </AbsoluteFill>
)
