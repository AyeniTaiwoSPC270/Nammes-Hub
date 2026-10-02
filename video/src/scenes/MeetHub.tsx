import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { C, FONT_BODY, FONT_HEAD, SHADOW } from '../brand'
import { Beats } from '../components/beats'
import { Beat, BrowserFrame, Card, Logo, Pill, PhoneFrame, Pop, Stage, Words, browserHeight, ease, phoneHeight, useSpr } from '../components/ui'
import { useLayout } from '../layout'

const Home: React.FC = () => {
  const L = useLayout()
  const frame = useCurrentFrame()
  // phone first, then it zooms into the browser
  const phoneOut = interpolate(frame, [38, 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease })
  const browserIn = interpolate(frame, [44, 66], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease })
  const scroll = interpolate(frame, [66, 150], [0, 120], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease })
  const bw = L.portrait ? L.sw : 1250
  const viewH = 560
  const pw = L.portrait ? 520 : 400
  const pView = L.portrait ? 1000 : 850
  return (
    <Beat tone="dark" wipe={false}>
      <Stage style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 34 }}>
        <Pop from="down" dist={80}>
          <Pill bg={C.orange} size={L.portrait ? 40 : 36}>Meet the Hub</Pill>
        </Pop>
        <div style={{ position: 'relative', width: bw, height: Math.max(browserHeight(bw, viewH), phoneHeight(pw, pView)), display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ position: 'absolute', opacity: 1 - phoneOut, transform: `scale(${1 + phoneOut * 1.6})`, filter: `blur(${phoneOut * 6}px)` }}>
            <Pop from="up" dist={140}>
              <PhoneFrame width={pw} src="screens/m-home.jpg" viewH={pView} />
            </Pop>
          </div>
          <div style={{ position: 'absolute', opacity: browserIn, transform: `scale(${0.6 + 0.4 * browserIn})` }}>
            <BrowserFrame width={bw} src="screens/home.jpg" viewH={viewH} scroll={scroll} url="nammeshub.com.ng" />
          </div>
        </div>
      </Stage>
    </Beat>
  )
}

const MapCard: React.FC<{ title: string; items: string[]; delay: number; tone?: 'dark' | 'orange' | 'light'; width: number; fs: number }> = ({ title, items, delay, tone = 'dark', width, fs }) => {
  const s = useSpr(delay)
  const bg = tone === 'dark' ? C.green800 : tone === 'orange' ? C.orange : C.white
  const fg = tone === 'light' ? C.ink : C.white
  return (
    <div style={{ width, transform: `scale(${0.15 + 0.85 * s}) translateY(${(1 - s) * -160}px)`, transformOrigin: '50% 0%', opacity: Math.min(1, s * 2) }}>
      <div style={{ background: bg, color: fg, borderRadius: 30, boxShadow: SHADOW, padding: fs * 0.8, fontFamily: FONT_BODY }}>
        <div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: fs * 1.45, marginBottom: fs * 0.5, lineHeight: 1.05 }}>{title}</div>
        {items.map((it, i) => (
          <Pop key={it} from="left" dist={40} delay={delay + 12 + i * 4}>
            <div style={{ display: 'flex', alignItems: 'center', gap: fs * 0.4, fontSize: fs, fontWeight: 700, padding: `${fs * 0.22}px 0` }}>
              <span style={{ width: fs * 0.42, height: fs * 0.42, borderRadius: '50%', background: tone === 'light' ? C.orange : C.gold, display: 'inline-block' }} />
              {it}
            </div>
          </Pop>
        ))}
      </div>
    </div>
  )
}

const SiteMap: React.FC = () => {
  const L = useLayout()
  const frame = useCurrentFrame()
  const barShrink = interpolate(frame, [0, 14], [1, 0.85], { extrapolateRight: 'clamp' })
  const fs = L.portrait ? 44 : 36
  const cardW = L.portrait ? (L.sw - 30) / 2 : (L.sw - 3 * 28) / 4
  const nav = ['About', 'Academics', 'Community', 'Forms', 'Contact']
  return (
    <Beat tone="paper">
      <Stage style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 44 }}>
        {/* the menu bar... */}
        <div style={{ transform: `scale(${barShrink})`, display: 'flex', alignItems: 'center', gap: L.portrait ? 18 : 34, background: C.white, borderRadius: 999, padding: '16px 36px', boxShadow: SHADOW, fontFamily: FONT_BODY, fontWeight: 700, fontSize: L.portrait ? 32 : 34 }}>
          <Logo size={56} small />
          {nav.map((n, i) => (
            <span key={n} style={{ color: i === 1 || i === 2 ? C.orange : C.ink, transform: `scale(${1 + (frame > 4 + i * 2 && frame < 12 + i * 2 ? 0.18 : 0)})` }}>{n}</span>
          ))}
        </div>
        {/* ...grows into a map of the site */}
        <div style={{ display: 'grid', gridTemplateColumns: L.portrait ? '1fr 1fr' : 'repeat(4, 1fr)', gap: L.portrait ? 30 : 28, width: L.sw, justifyItems: 'center', alignItems: 'start' }}>
          <MapCard title="Academics" items={['Outlines', 'Curriculum', 'Timetable', 'CGPA', 'Resources']} delay={10} width={cardW} fs={fs} />
          <MapCard title="Community" items={['Events', 'News', 'Opportunities', 'Awards']} delay={20} width={cardW} fs={fs} tone="orange" />
          <MapCard title="Forms" items={['Fill in forms']} delay={30} width={cardW} fs={fs} tone="light" />
          <MapCard title="Contact" items={['Get in touch']} delay={38} width={cardW} fs={fs} tone="light" />
        </div>
      </Stage>
    </Beat>
  )
}

const Account: React.FC = () => {
  const L = useLayout()
  const frame = useCurrentFrame()
  const timer = interpolate(frame, [30, 120], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const pw = L.portrait ? 400 : 440
  const pView = L.portrait ? 900 : 1000
  const scroll = interpolate(frame, [0, 140], [0, 120], { extrapolateRight: 'clamp', easing: ease })
  const r = 62
  const circ = 2 * Math.PI * r
  return (
    <Beat tone="dark">
      <Stage style={{ display: 'flex', flexDirection: L.portrait ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: L.portrait ? 40 : 90 }}>
        <Pop from="left" dist={160}>
          <PhoneFrame width={pw} src="screens/m-outlines.jpg" viewH={pView} scroll={scroll} />
        </Pop>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 30, width: L.portrait ? L.sw : 760 }}>
          <Pop from="right" dist={200} delay={8}>
            <Card style={{ padding: 36, display: 'flex', alignItems: 'center', gap: 28 }}>
              <div style={{ width: 92, height: 92, borderRadius: '50%', background: C.green100, display: 'grid', placeItems: 'center' }}>
                <svg width="54" height="54" viewBox="0 0 54 54"><path d="M10 28 L22 40 L44 14" fill="none" stroke={C.green700} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <div>
                <div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: L.portrait ? 52 : 50, lineHeight: 1.05 }}>Browse freely</div>
                <div style={{ fontFamily: FONT_BODY, fontSize: 32, color: '#555', fontWeight: 600, marginTop: 8 }}>No account needed to look around</div>
              </div>
            </Card>
          </Pop>
          <Pop from="right" dist={200} delay={22}>
            <Card style={{ padding: 36, display: 'flex', alignItems: 'center', gap: 28 }}>
              <svg width="140" height="140" viewBox="0 0 140 140" style={{ flexShrink: 0 }}>
                <circle cx="70" cy="70" r={r} fill="none" stroke={C.green100} strokeWidth="14" />
                <circle cx="70" cy="70" r={r} fill="none" stroke={C.orange} strokeWidth="14" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - timer)} transform="rotate(-90 70 70)" />
                <text x="70" y="82" textAnchor="middle" fontFamily={FONT_BODY} fontWeight="800" fontSize="30" fill={C.ink}>~1 min</text>
              </svg>
              <div>
                <div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: L.portrait ? 52 : 50, lineHeight: 1.05 }}>Sign up</div>
                <div style={{ fontFamily: FONT_BODY, fontSize: 32, color: '#555', fontWeight: 600, marginTop: 8 }}>Takes about a minute</div>
              </div>
            </Card>
          </Pop>
          <Words text="Browse first. Join when you're ready." size={L.portrait ? 50 : 48} head={false} color={C.white} weight={700} delay={44} />
        </div>
      </Stage>
    </Beat>
  )
}

export const MeetHub: React.FC = () => (
  <AbsoluteFill>
    <Beats scene="meet" beats={{ home: <Home />, map: <SiteMap />, account: <Account /> }} />
  </AbsoluteFill>
)
