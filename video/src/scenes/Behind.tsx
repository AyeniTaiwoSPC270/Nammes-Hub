import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { C, FONT_BODY, FONT_HEAD, SHADOW_SOFT } from '../brand'
import { Beats } from '../components/beats'
import { Qr } from '../components/Qr'
import { Beat, BrowserFrame, Cursor, Logo, Pill, Pop, Stage, useSpr, SNAPPY, browserHeight } from '../components/ui'
import { clampOpts } from '../components/split'
import { useLayout } from '../layout'

// The executives' side. Drawn natively (there are no admin screenshots, and admin pages hold real data).

const GLYPHS: Record<string, string> = {
  News: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM9 9h7M9 13h7',
  Events: 'M4 7h16v13H4zM4 11h16M8 3v4M16 3v4',
  Opportunities: 'M4 8h16v11H4zM9 8V5h6v3M4 13h16',
  Forms: 'M6 3h12v18H6zM9 8h6M9 12h6M9 16h4',
  Awards: 'M7 4h10v5a5 5 0 0 1-10 0zM5 5H3v2a3 3 0 0 0 3 3M19 5h2v2a3 3 0 0 1-3 3M12 14v4M8 20h8',
  'Live quiz': 'M13 2L5 14h6l-1 8 8-12h-6z',
  Outlines: 'M4 5h7a3 3 0 0 1 1 .2V20a3 3 0 0 0-1-.2H4zM20 5h-7a3 3 0 0 0-1 .2V20a3 3 0 0 1 1-.2h7z',
  Timetables: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  Resources: 'M3 6h7l2 2h9v11H3z',
  Messages: 'M4 5h16v11H9l-5 4z',
  Excos: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M16 14a5 5 0 0 1 5 5',
  Handbook: 'M5 3h11l3 3v15H5zM9 10h7M9 14h7',
}
const TILES = Object.keys(GLYPHS)
const TILE_TONES = [C.green800, C.orange, C.green700, C.orangeDark]

const Glyph: React.FC<{ name: string; size: number; color?: string }> = ({ name, size, color = C.white }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={GLYPHS[name]} />
  </svg>
)

// Admin window on a 1280-wide canvas.
const AdminFrame: React.FC<{ vh: number; title: string; children: React.ReactNode }> = ({ vh, title, children }) => {
  const L = useLayout()
  const w = L.portrait ? L.sw : 1240
  const sc = w / 1280
  return (
    <div style={{ position: 'relative' }}>
      <Pop from="up" dist={120}>
        <BrowserFrame width={w} viewH={vh} url="nammeshub.com.ng/admin" scroll={0}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: vh, background: '#f4f1f0', fontFamily: FONT_BODY, color: C.ink }}>
            <div style={{ height: 78, background: C.green900, display: 'flex', alignItems: 'center', gap: 16, padding: '0 34px', color: C.white }}>
              <Logo size={44} small />
              <div style={{ fontWeight: 800, fontSize: 24 }}>NAMMES Hub</div>
              <div style={{ background: C.orange, borderRadius: 999, padding: '4px 16px', fontWeight: 800, fontSize: 16 }}>Admin</div>
              <div style={{ marginLeft: 'auto', fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 28 }}>{title}</div>
            </div>
            {children}
          </div>
        </BrowserFrame>
      </Pop>
      <div style={{ display: 'none' }}>{sc}</div>
    </div>
  )
}

const adminVh = (L: ReturnType<typeof useLayout>) => (L.portrait ? 980 : 640)

/* ---------------------------------------------------------------- dashboard */

const Dashboard: React.FC = () => {
  const L = useLayout()
  const cols = L.portrait ? 3 : 4
  const tileW = (1280 - 68 - (cols - 1) * 22) / cols
  const tileH = L.portrait ? 190 : 150
  return (
    <Beat tone="dark" wipe={false}>
      <Stage style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 24 }}>
        <Pop from="down" dist={60}><Pill bg={C.orange} size={L.portrait ? 40 : 36}>The excos run it all</Pill></Pop>
        <AdminFrame vh={adminVh(L)} title="Dashboard">
          <div style={{ padding: 34, display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 22 }}>
            {TILES.map((t, i) => {
              const s = useSpr(6 + i * 3, SNAPPY)
              return (
                <div key={t} style={{ width: tileW, height: tileH, background: C.white, borderRadius: 22, boxShadow: SHADOW_SOFT, display: 'flex', alignItems: 'center', gap: 20, padding: '0 26px', transform: `scale(${s})`, opacity: s }}>
                  <div style={{ width: 70, height: 70, borderRadius: 20, background: TILE_TONES[i % 4], display: 'grid', placeItems: 'center' }}>
                    <Glyph name={t} size={40} />
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 28 }}>{t}</div>
                </div>
              )
            })}
          </div>
        </AdminFrame>
      </Stage>
    </Beat>
  )
}

/* ---------------------------------------------------------------- publish news */

const News: React.FC = () => {
  const L = useLayout()
  const frame = useCurrentFrame()
  const title = 'Welcome back, everyone'.slice(0, Math.max(0, Math.floor((frame - 8) / 1.6)))
  const pressed = frame >= 48 && frame < 54
  const done = useSpr(56)
  const vh = adminVh(L)
  return (
    <Beat tone="paper">
      <Stage style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 24 }}>
        <Pop from="down" dist={60}><Pill bg={C.green800} size={L.portrait ? 40 : 36}>Publish news</Pill></Pop>
        <div style={{ position: 'relative' }}>
          <AdminFrame vh={vh} title="News">
            <div style={{ position: 'absolute', left: 60, top: 120, width: 1160, background: C.white, borderRadius: 24, padding: 40, boxShadow: SHADOW_SOFT }}>
              <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: 1.2, color: C.orangeDark }}>NEW POST</div>
              <div style={{ marginTop: 14, height: 84, borderRadius: 16, border: `3px solid ${C.orange}`, display: 'flex', alignItems: 'center', padding: '0 26px', fontSize: 38, fontWeight: 700 }}>{title}{frame % 16 < 8 && frame < 46 ? '|' : ''}</div>
              <div style={{ display: 'flex', gap: 14, marginTop: 26 }}>
                {['Academics', 'Welfare', 'Industry'].map((c, i) => (
                  <div key={c} style={{ fontWeight: 800, fontSize: 22, padding: '10px 22px', borderRadius: 999, background: i === 0 ? C.green900 : C.white, color: i === 0 ? C.white : C.ink, border: '2px solid #ccc' }}>{c}</div>
                ))}
              </div>
              <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ width: '90%', height: 18, borderRadius: 9, background: '#e7e2e0' }} />
                <div style={{ width: '74%', height: 18, borderRadius: 9, background: '#e7e2e0' }} />
              </div>
              <div style={{ marginTop: 34, display: 'flex', alignItems: 'center', gap: 26 }}>
                <div style={{ background: C.orange, color: C.white, fontWeight: 800, fontSize: 30, padding: '18px 46px', borderRadius: 16, transform: `scale(${pressed ? 0.93 : 1})` }}>Publish</div>
                <div style={{ fontWeight: 800, fontSize: 30, color: C.green800, opacity: done, transform: `translateX(${(1 - done) * 30}px)` }}>✓ Published</div>
              </div>
            </div>
          </AdminFrame>
        </div>
      </Stage>
    </Beat>
  )
}

/* ---------------------------------------------------------------- design a form */

const BLOCKS = [
  ['Short answer', 'What is your full name?'],
  ['Multiple choice', 'Which level are you in?'],
  ['Paragraph', 'Anything else we should know?'],
]

const FormDesign: React.FC = () => {
  const L = useLayout()
  const vh = adminVh(L)
  return (
    <Beat tone="dark">
      <Stage style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 24 }}>
        <Pop from="down" dist={60}><Pill bg={C.orange} size={L.portrait ? 40 : 36}>Design a form</Pill></Pop>
        <AdminFrame vh={vh} title="Forms">
          <div style={{ position: 'absolute', left: 60, top: 116, width: 1160 }}>
            {BLOCKS.map(([type, q], i) => {
              const s = useSpr(8 + i * 18, SNAPPY)
              return (
                <div key={q} style={{ background: C.white, borderRadius: 22, padding: '22px 32px', marginBottom: 18, boxShadow: SHADOW_SOFT, display: 'flex', alignItems: 'center', gap: 24, transform: `translateY(${(1 - s) * 50}px) scale(${0.95 + 0.05 * s})`, opacity: s }}>
                  <div style={{ background: C.green100, color: C.green900, fontWeight: 800, fontSize: 20, padding: '8px 18px', borderRadius: 999, minWidth: 190, textAlign: 'center' }}>{type}</div>
                  <div style={{ fontWeight: 700, fontSize: 32 }}>{q}</div>
                </div>
              )
            })}
            <Pop from="scale" delay={66}>
              <div style={{ display: 'inline-block', border: `3px dashed ${C.orange}`, color: C.orange, fontWeight: 800, fontSize: 28, padding: '14px 34px', borderRadius: 18 }}>+ Add question</div>
            </Pop>
          </div>
        </AdminFrame>
      </Stage>
    </Beat>
  )
}

/* ---------------------------------------------------------------- awards season */

const STAGES = ['Nominating', 'Curating', 'Voting', 'Closed', 'Revealed']

const Season: React.FC = () => {
  const L = useLayout()
  const frame = useCurrentFrame()
  const idx = Math.min(4, Math.floor(frame / 16))
  const vh = adminVh(L)
  return (
    <Beat tone="paper">
      <Stage style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 24 }}>
        <Pop from="down" dist={60}><Pill bg={C.green800} size={L.portrait ? 40 : 36}>Run an awards season</Pill></Pop>
        <AdminFrame vh={vh} title="Awards">
          <div style={{ position: 'absolute', left: 60, top: 130, width: 1160, background: C.white, borderRadius: 24, padding: 44, boxShadow: SHADOW_SOFT }}>
            <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: 1.2, color: C.orangeDark }}>SEASON STAGE</div>
            <div style={{ display: 'flex', flexDirection: L.portrait ? 'column' : 'row', gap: 16, marginTop: 26 }}>
              {STAGES.map((st, i) => (
                <div key={st} style={{ flex: 1, textAlign: 'center', padding: '26px 10px', borderRadius: 20, fontWeight: 800, fontSize: 28, background: i === idx ? C.orange : i < idx ? C.green800 : '#eee', color: i <= idx ? C.white : '#888', transform: `scale(${i === idx ? 1.06 : 1})` }}>
                  {i < idx ? '✓ ' : ''}{st}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 34, display: 'inline-block', background: C.green900, color: C.white, fontWeight: 800, fontSize: 28, padding: '16px 40px', borderRadius: 16 }}>Move to next stage →</div>
          </div>
        </AdminFrame>
      </Stage>
    </Beat>
  )
}

/* ---------------------------------------------------------------- host a live quiz */

const Host: React.FC = () => {
  const L = useLayout()
  const frame = useCurrentFrame()
  const vh = adminVh(L)
  const n = Math.min(12, Math.floor(frame / 6))
  const started = frame >= 62
  const press = frame >= 56 && frame < 62
  return (
    <Beat tone="dark">
      <Stage style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 24 }}>
        <Pop from="down" dist={60}><Pill bg={C.orange} size={L.portrait ? 40 : 36}>Host a live quiz</Pill></Pop>
        <AdminFrame vh={vh} title="Live quiz">
          <div style={{ position: 'absolute', left: 60, top: 120, width: 1160, display: 'flex', gap: 34, alignItems: 'center', background: C.white, borderRadius: 24, padding: 40, boxShadow: SHADOW_SOFT }}>
            <div style={{ background: C.white, borderRadius: 18, padding: 10, border: '2px solid #ddd' }}><Qr size={200} seed="host" /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: 1.2, color: C.orangeDark }}>{started ? 'GAME ON' : 'WAITING FOR PLAYERS'}</div>
              <div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 92, lineHeight: 1.05 }}>482 915</div>
              <div style={{ fontWeight: 700, fontSize: 30, color: '#555' }}>{n} in the lobby</div>
              <div style={{ marginTop: 22, display: 'inline-block', background: started ? C.green800 : C.orange, color: C.white, fontWeight: 800, fontSize: 32, padding: '16px 44px', borderRadius: 16, transform: `scale(${press ? 0.94 : 1})` }}>{started ? '✓ Started' : 'Start game'}</div>
            </div>
          </div>
        </AdminFrame>
      </Stage>
    </Beat>
  )
}

export const Behind: React.FC = () => (
  <AbsoluteFill>
    <Beats scene="behind" beats={{ dashboard: <Dashboard />, news: <News />, form: <FormDesign />, season: <Season />, host: <Host /> }} />
  </AbsoluteFill>
)

void Cursor
void interpolate
void clampOpts
void browserHeight
