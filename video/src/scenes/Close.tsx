import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, FONT_BODY, FONT_HEAD } from '../brand'
import { Beats } from '../components/beats'
import { Beat, BrowserFrame, Logo, Pill, Pop, Stage, Words, ease, useSpr } from '../components/ui'
import { BW, CHROME, SC, Split, clampOpts } from '../components/split'
import { useLayout } from '../layout'

const Excos: React.FC = () => {
  const frame = useCurrentFrame()
  const vh = 830
  const zoom = interpolate(frame, [0, 180], [1, 1.06], clampOpts)
  const scroll = 0
  return (
    <Beat tone="paper">
      <Split
        frameH={CHROME + vh * SC}
        side={
          <>
            <Words text="Meet the excos" size={84} color={C.green900} delay={6} />
            <Pop from="up" delay={24}>
              <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 38, color: '#444', maxWidth: 620, lineHeight: 1.3 }}>The Executive Council leading NAMMES for the 2026/2027 session.</div>
            </Pop>
            <Pop from="up" delay={40}><Pill bg={C.orange} size={40}>The AEGIS 26/27</Pill></Pop>
          </>
        }
        frame={
          <div style={{ transform: `scale(${zoom})`, transformOrigin: '50% 20%' }}>
            <Pop from="up" dist={140}>
              <BrowserFrame width={BW} src="screens/excos.jpg" viewH={vh} scroll={scroll} url="nammeshub.com.ng/excos" />
            </Pop>
          </div>
        }
      />
    </Beat>
  )
}

const Built: React.FC = () => {
  const L = useLayout()
  return (
    <Beat tone="dark">
      <Stage style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40 }}>
        <Pop from="scale"><Logo size={L.portrait ? 220 : 190} /></Pop>
        <Words text="Built by students, for students." size={L.portrait ? 120 : 112} align="center" maxWidth={L.portrait ? L.sw : 1500} delay={8} stagger={5} highlight={['students', 'students.']} highlightColor={C.gold} />
      </Stage>
    </Beat>
  )
}

const Social: React.FC<{ kind: 'ig' | 'yt' | 'in'; label: string; delay: number; size: number }> = ({ kind, label, delay, size }) => (
  <Pop from="up" dist={60} delay={delay}>
    <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.4, color: C.white, fontFamily: FONT_BODY, fontWeight: 700, fontSize: size }}>
      <svg width={size * 1.3} height={size * 1.3} viewBox="0 0 48 48">
        <rect x="3" y="3" width="42" height="42" rx="12" fill={kind === 'ig' ? C.orange : kind === 'yt' ? '#e2460f' : C.green700} />
        {kind === 'ig' && (<><rect x="12" y="12" width="24" height="24" rx="7" fill="none" stroke="#fff" strokeWidth="3" /><circle cx="24" cy="24" r="6" fill="none" stroke="#fff" strokeWidth="3" /><circle cx="32" cy="16" r="1.8" fill="#fff" /></>)}
        {kind === 'yt' && <path d="M19 15l14 9-14 9z" fill="#fff" />}
        {kind === 'in' && <text x="24" y="33" textAnchor="middle" fontFamily="Arial" fontWeight="700" fontSize="24" fill="#fff">in</text>}
      </svg>
      {label}
    </div>
  </Pop>
)

const EndCard: React.FC = () => {
  const L = useLayout()
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const fade = interpolate(frame, [durationInFrames - 22, durationInFrames - 2], [0, 1], clampOpts)
  return (
    <Beat tone="dark">
      <Stage style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: L.portrait ? 30 : 24 }}>
        <Pop from="scale"><Logo size={L.portrait ? 250 : 200} /></Pop>
        <Pop from="up" dist={60} delay={6}>
          <div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: L.portrait ? 120 : 112, color: C.white, lineHeight: 1 }}>NAMMES Hub</div>
        </Pop>
        <Pop from="up" dist={60} delay={12}>
          <div style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: L.portrait ? 64 : 58, color: C.gold }}>nammeshub.com.ng</div>
        </Pop>
        <Pop from="scale" delay={24}>
          <Pill bg={C.orange} size={L.portrait ? 40 : 36}>Download the Handbook in the footer</Pill>
        </Pop>
        <div style={{ display: 'flex', flexDirection: L.portrait ? 'column' : 'row', gap: L.portrait ? 18 : 54, marginTop: 10, alignItems: L.portrait ? 'flex-start' : 'center' }}>
          <Social kind="ig" label="@unilag_nammes" delay={34} size={L.portrait ? 40 : 34} />
          <Social kind="yt" label="@nammesunilag" delay={40} size={L.portrait ? 40 : 34} />
          <Social kind="in" label="nammes-unilag" delay={46} size={L.portrait ? 40 : 34} />
        </div>
      </Stage>
      <AbsoluteFill style={{ background: C.green950, opacity: fade }} />
    </Beat>
  )
}

export const Close: React.FC = () => (
  <AbsoluteFill>
    <Beats scene="close" beats={{ excos: <Excos />, built: <Built />, endcard: <EndCard /> }} />
  </AbsoluteFill>
)
