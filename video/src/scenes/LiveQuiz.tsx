import React from 'react'
import { AbsoluteFill, interpolate, random, useCurrentFrame } from 'remotion'
import { C, FONT_BODY, FONT_HEAD, SHADOW, SHADOW_SOFT } from '../brand'
import { Avatar } from '../components/Avatar'
import { Beats } from '../components/beats'
import { Qr } from '../components/Qr'
import { Beat, Card, Confetti, Cursor, Pill, PhoneFrame, Pop, Shake, Stage, Stamp, Words, useSpr, BOUNCY, SNAPPY, ease } from '../components/ui'
import { clampOpts } from '../components/split'
import { useLayout } from '../layout'

// All quiz UI here is drawn in React/SVG (a live game cannot be screenshotted). Names are playful nicknames only.
const PLAYERS = [
  { n: 'Ada_Bolt', id: 14 },
  { n: 'MMEKing', id: 30 },
  { n: 'Player 1', id: 3 },
  { n: 'Steel_Sam', id: 10 },
  { n: 'Zinc_Zara', id: 16 },
  { n: 'Player 2', id: 42 },
  { n: 'Tin_Tola', id: 0 },
  { n: 'Bronze_B', id: 26 },
]

/* ---------------------------------------------------------------- shared pieces */

// A projector screen. Content is laid out on a 1600x900 canvas and scaled to `width`.
const Screen: React.FC<{ width: number; children: React.ReactNode }> = ({ width, children }) => {
  const sc = width / 1600
  return (
    <div style={{ width, padding: width * 0.012, background: '#111', borderRadius: width * 0.03, boxShadow: SHADOW, boxSizing: 'border-box' }}>
      <div style={{ width: '100%', height: (width - width * 0.024) * 0.5625, borderRadius: width * 0.02, overflow: 'hidden', position: 'relative', background: C.green950 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1600, height: 900, transformOrigin: '0 0', transform: `scale(${(width - width * 0.024) / 1600})`, background: `linear-gradient(160deg, ${C.green950}, ${C.green900})`, fontFamily: FONT_BODY, color: C.white }}>
          {children}
        </div>
      </div>
    </div>
  )
}

const screenW = (L: ReturnType<typeof useLayout>, landscapeW = 1150) => (L.portrait ? L.sw : landscapeW)

const Tag: React.FC<{ children: React.ReactNode; bg?: string; color?: string; size?: number }> = ({ children, bg = C.orange, color = C.white, size = 34 }) => (
  <div style={{ display: 'inline-block', background: bg, color, fontWeight: 800, fontSize: size, padding: `${size * 0.25}px ${size * 0.7}px`, borderRadius: 999, letterSpacing: 1 }}>{children}</div>
)

// Phone used for the player side. Canvas is 800 wide.
const PLAYER_PHONE_VIEW = 1400
const Phone: React.FC<{ width: number; children: React.ReactNode; bg?: string; viewH?: number }> = ({ width, children, bg = C.paper, viewH = PLAYER_PHONE_VIEW }) => (
  <PhoneFrame width={width} viewH={viewH} bg={bg}>
    <div style={{ width: 800, height: viewH, background: bg, fontFamily: FONT_BODY, color: C.ink, position: 'relative' }}>{children}</div>
  </PhoneFrame>
)

const Row: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const L = useLayout()
  return <Stage style={{ display: 'flex', flexDirection: L.portrait ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: L.portrait ? 36 : 60 }}>{children}</Stage>
}

/* ---------------------------------------------------------------- lobby */

const LOBBY_JOIN = [24, 44, 62, 116, 134, 152, 168, 184]

const Lobby: React.FC = () => {
  const L = useLayout()
  const frame = useCurrentFrame()
  const sw = screenW(L)
  const pw = L.portrait ? 340 : 400
  const typed = 'Ada_Bolt'.slice(0, Math.max(0, Math.floor((frame - 40) / 4)))
  const joined = frame >= 116
  const sel = frame >= 92 ? 5 : frame >= 82 ? 2 : -1
  const count = LOBBY_JOIN.filter((f) => frame >= f).length
  const grid = [14, 0, 3, 10, 16, 42, 26, 30, 1, 5, 7, 12, 20, 24, 33, 44]
  const nameIn = useSpr(0)
  return (
    <Beat tone="dark" wipe={false}>
      <Row>
        <Pop from="left" dist={160}>
          <Screen width={sw}>
            <div style={{ position: 'absolute', left: 70, top: 50 }}><Tag size={38}>LIVE QUIZ</Tag></div>
            <div style={{ position: 'absolute', right: 70, top: 56, fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 52 }}>MME Quiz Night</div>
            <div style={{ position: 'absolute', left: 70, top: 170 }}>
              {['Open the link or scan the QR', 'Type the game code', 'Pick a nickname and join'].map((t, i) => (
                <Pop key={t} from="left" dist={60} delay={8 + i * 6}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 22, fontWeight: 700, fontSize: 40, marginBottom: 18 }}>
                    <span style={{ width: 56, height: 56, borderRadius: '50%', background: C.gold, color: C.green950, display: 'grid', placeItems: 'center', fontSize: 32, fontWeight: 900 }}>{i + 1}</span>
                    {t}
                  </div>
                </Pop>
              ))}
            </div>
            <Pop from="scale" delay={14} style={{ position: 'absolute', left: 70, top: 410 }}>
              <div style={{ background: 'rgba(255,255,255,0.08)', border: `4px solid ${C.gold}`, borderRadius: 30, padding: '16px 44px' }}>
                <div style={{ fontWeight: 800, fontSize: 28, letterSpacing: 3, color: C.gold }}>GAME CODE</div>
                <div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 150, lineHeight: 1.05, letterSpacing: 10 }}>482 915</div>
              </div>
            </Pop>
            <Pop from="right" dist={140} delay={10} style={{ position: 'absolute', right: 70, top: 160 }}>
              <div style={{ background: C.white, borderRadius: 30, padding: 26, textAlign: 'center', color: C.ink }}>
                <Qr size={330} seed="lobby" />
                <div style={{ fontWeight: 800, fontSize: 36, marginTop: 14 }}>Scan to join</div>
              </div>
            </Pop>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 250, background: 'rgba(0,0,0,0.25)', borderTop: `4px solid ${C.green700}` }}>
              <div style={{ position: 'absolute', left: 70, top: 14, fontWeight: 800, fontSize: 30, color: C.gold }}>{count} in the lobby</div>
              {PLAYERS.map((p, i) => (
                <Pop key={p.n} from="scale" delay={LOBBY_JOIN[i]} config={BOUNCY} style={{ position: 'absolute', left: 70 + i * 180, top: 54 }}>
                  <div style={{ width: 160, textAlign: 'center' }}>
                    <Avatar id={p.id} size={130} mood="idle" phase={i} style={{ margin: '0 auto' }} />
                    <div style={{ fontWeight: 800, fontSize: 26, marginTop: -6 }}>{p.n}</div>
                  </div>
                </Pop>
              ))}
            </div>
          </Screen>
        </Pop>
        <Pop from="right" dist={160} delay={6}>
          <Phone width={pw}>
            <div style={{ padding: '110px 50px 0' }}>
              <div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 78, lineHeight: 1 }}>Join the game</div>
              <div style={{ marginTop: 36, height: 110, borderRadius: 22, border: `4px solid ${typed ? C.orange : '#ccc'}`, background: C.white, display: 'flex', alignItems: 'center', padding: '0 30px', fontSize: 50, fontWeight: 700 }}>
                {typed || <span style={{ color: '#aaa' }}>Nickname</span>}
              </div>
              <div style={{ marginTop: 44, background: C.orangeTint, color: C.orangeDark, fontWeight: 800, fontSize: 44, padding: '16px 28px', borderRadius: 22, textAlign: 'center', opacity: nameIn }}>
                50 characters, pick your fighter
              </div>
              <div style={{ marginTop: 30, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                {grid.map((id, i) => (
                  <div key={i} style={{ height: 160, borderRadius: 26, background: i === sel ? C.orangeTint : C.white, border: `5px solid ${i === sel ? C.orange : '#e3dedd'}`, display: 'grid', placeItems: 'center', transform: `scale(${i === sel ? 1.08 : 1})` }}>
                    <Avatar id={id} size={130} mood={i === sel ? 'happy' : 'static'} />
                  </div>
                ))}
              </div>
            </div>
            <div style={{ position: 'absolute', left: 50, right: 50, bottom: 50, height: 130, borderRadius: 30, background: joined ? C.green800 : C.orange, color: C.white, fontWeight: 800, fontSize: 56, display: 'grid', placeItems: 'center' }}>
              {joined ? "You're in!" : 'Join'}
            </div>
            <Cursor scale={2.4} keys={[{ f: 18, x: 640, y: 120 }, { f: 34, x: 400, y: 236 }, { f: 76, x: 400, y: 236 }, { f: 88, x: 220 + 210, y: 580 }, { f: 106, x: 330, y: 1290 }, { f: 150, x: 330, y: 1290 }]} taps={[36, 92, 112]} />
          </Phone>
        </Pop>
      </Row>
    </Beat>
  )
}

/* ---------------------------------------------------------------- question */

const OPTION_COLORS = [C.orange, C.green700, C.gold, C.green800]
const OPTION_TEXT = [C.white, C.white, C.green950, C.white]
const ANSWERS = ['Iron', 'Mercury', 'Copper', 'Zinc']

const Question: React.FC = () => {
  const L = useLayout()
  const frame = useCurrentFrame()
  const sw = screenW(L)
  const pw = L.portrait ? 340 : 400
  const t = Math.min(1, frame / 170)
  const secs = Math.max(1, Math.ceil(10 * (1 - t)))
  const answered = Math.min(7, Math.floor(Math.max(0, frame - 70) / 10))
  const locked = frame >= 92
  return (
    <Beat tone="dark" wipe={false}>
      <Row>
        <Pop from="left" dist={160}>
          <Screen width={sw}>
            <div style={{ position: 'absolute', left: 70, top: 50, display: 'flex', gap: 18, alignItems: 'center' }}>
              <Tag size={34}>QUESTION 3</Tag>
              <span style={{ fontWeight: 700, fontSize: 32, opacity: 0.8 }}>of 10</span>
            </div>
            <div style={{ position: 'absolute', right: 70, top: 26 }}>
              <svg width="150" height="150" viewBox="0 0 150 150">
                <circle cx="75" cy="75" r="62" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="14" />
                <circle cx="75" cy="75" r="62" fill="none" stroke={secs <= 3 ? C.orange : C.gold} strokeWidth="14" strokeLinecap="round" strokeDasharray={2 * Math.PI * 62} strokeDashoffset={2 * Math.PI * 62 * t} transform="rotate(-90 75 75)" />
                <text x="75" y="95" textAnchor="middle" fontFamily={FONT_HEAD} fontWeight="900" fontSize="68" fill="#fff">{secs}</text>
              </svg>
            </div>
            <div style={{ position: 'absolute', left: 70, right: 70, top: 200 }}>
              <Words text="Which of these metals is liquid at room temperature?" size={74} delay={4} stagger={2} />
            </div>
            <div style={{ position: 'absolute', left: 70, right: 70, top: 500, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 26 }}>
              {ANSWERS.map((a, i) => (
                <Pop key={a} from="up" dist={60} delay={20 + i * 5}>
                  <div style={{ height: 150, borderRadius: 26, background: OPTION_COLORS[i], color: OPTION_TEXT[i], display: 'flex', alignItems: 'center', gap: 26, padding: '0 36px', fontWeight: 800, fontSize: 56 }}>
                    <span style={{ width: 76, height: 76, borderRadius: 18, background: 'rgba(0,0,0,0.18)', display: 'grid', placeItems: 'center', fontSize: 46 }}>{'ABCD'[i]}</span>
                    {a}
                  </div>
                </Pop>
              ))}
            </div>
            <div style={{ position: 'absolute', left: 70, bottom: 30, fontWeight: 700, fontSize: 34, opacity: 0.85 }}>Answers in: {answered}</div>
          </Screen>
        </Pop>
        <Pop from="right" dist={160} delay={6}>
          <Phone width={pw}>
            <div style={{ padding: '110px 40px 0' }}>
              <div style={{ fontWeight: 800, fontSize: 40, color: C.orangeDark, letterSpacing: 2 }}>QUESTION 3</div>
              <div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 70, lineHeight: 1.05, marginTop: 10 }}>Tap your answer</div>
              <div style={{ marginTop: 50, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
                {ANSWERS.map((a, i) => {
                  const picked = i === 1
                  const dim = locked && !picked
                  return (
                    <div key={a} style={{ height: 420, borderRadius: 36, background: OPTION_COLORS[i], color: OPTION_TEXT[i], display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 150, opacity: dim ? 0.25 : 1, transform: `scale(${locked && picked ? 1.04 : 1})`, boxShadow: picked && locked ? `0 0 0 10px ${C.ink}` : 'none' }}>{'ABCD'[i]}</div>
                  )
                })}
              </div>
              {locked && (
                <Pop from="up" dist={40}>
                  <div style={{ marginTop: 44, textAlign: 'center', fontWeight: 800, fontSize: 54, color: C.green800 }}>Locked in!</div>
                </Pop>
              )}
            </div>
            <Cursor scale={2.4} keys={[{ f: 40, x: 640, y: 1300 }, { f: 86, x: 590, y: 380 }, { f: 130, x: 590, y: 380 }]} taps={[90]} />
          </Phone>
        </Pop>
      </Row>
    </Beat>
  )
}

/* ---------------------------------------------------------------- reveal */

const BAR_COUNTS = [2, 11, 3, 2]
const BOARD: { n: string; id: number; score: number; gain: number }[] = [
  { n: 'Ada_Bolt', id: 14, score: 2450, gain: 950 },
  { n: 'MMEKing', id: 30, score: 2300, gain: 880 },
  { n: 'Steel_Sam', id: 10, score: 1980, gain: 760 },
  { n: 'Zinc_Zara', id: 16, score: 1710, gain: 0 },
  { n: 'Player 1', id: 3, score: 1500, gain: 640 },
]
// starting order (before this question's points land), so rows visibly slide into their new places
const OLD_ORDER = [1, 3, 0, 4, 2]

const Reveal: React.FC = () => {
  const L = useLayout()
  const frame = useCurrentFrame()
  const sw = L.portrait ? L.sw : 1300
  const showBars = interpolate(frame, [58, 66], [1, 0], clampOpts)
  const showBoard = interpolate(frame, [62, 70], [0, 1], clampOpts)
  const slide = interpolate(frame, [80, 112], [0, 1], { ...clampOpts, easing: ease })
  const maxC = 12
  return (
    <Beat tone="dark" wipe={false}>
      <Stage style={{ display: 'grid', placeItems: 'center' }}>
        <Pop from="up" dist={120}>
          <Screen width={sw}>
            <div style={{ position: 'absolute', inset: 0, opacity: showBars }}>
              <div style={{ position: 'absolute', left: 70, top: 50 }}><Tag size={34}>THE ANSWER</Tag></div>
              <div style={{ position: 'absolute', left: 120, right: 120, top: 150, height: 600, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 40 }}>
                {BAR_COUNTS.map((n, i) => {
                  const s = useSpr(6 + i * 5, SNAPPY)
                  const correct = i === 1
                  return (
                    <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontWeight: 900, fontSize: 56, marginBottom: 10, opacity: s }}>{Math.round(n * s)}</div>
                      <div style={{ height: (n / maxC) * 420 * s + 6, background: correct ? C.gold : OPTION_COLORS[i], borderRadius: '22px 22px 0 0', boxShadow: correct ? `0 0 40px ${C.gold}` : 'none', opacity: correct || frame < 36 ? 1 : 0.55 }} />
                      <div style={{ marginTop: 14, fontWeight: 800, fontSize: 44, color: correct ? C.gold : C.white }}>{correct ? '✓ ' : ''}{ANSWERS[i]}</div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div style={{ position: 'absolute', inset: 0, opacity: showBoard }}>
              <div style={{ position: 'absolute', left: 70, top: 44 }}><Tag size={34} bg={C.gold} color={C.green950}>LEADERBOARD</Tag></div>
              {BOARD.map((p, i) => {
                const from = OLD_ORDER.indexOf(i)
                const y = 130 + (from + (i - from) * slide) * 136
                const rank = slide > 0.5 ? i + 1 : from + 1
                const pts = Math.round(p.score - p.gain * (1 - slide))
                return (
                  <div key={p.n} style={{ position: 'absolute', left: 90, right: 90, top: y, height: 118, borderRadius: 26, background: i === 0 && slide > 0.5 ? 'rgba(244,196,48,0.25)' : 'rgba(255,255,255,0.1)', border: i === 0 && slide > 0.5 ? `4px solid ${C.gold}` : '4px solid transparent', display: 'flex', alignItems: 'center', gap: 26, padding: '0 34px' }}>
                    <div style={{ width: 70, fontWeight: 900, fontSize: 56, color: C.gold }}>{rank}</div>
                    <Avatar id={p.id} size={96} mood="idle" phase={i} />
                    <div style={{ flex: 1, fontWeight: 800, fontSize: 54 }}>{p.n}</div>
                    {p.gain > 0 && <div style={{ fontWeight: 800, fontSize: 38, color: C.gold, opacity: 1 - slide * 0.6 }}>+{p.gain}</div>}
                    <div style={{ width: 210, textAlign: 'right', fontWeight: 900, fontSize: 58, fontVariantNumeric: 'tabular-nums' }}>{pts.toLocaleString('en-US')}</div>
                  </div>
                )
              })}
            </div>
          </Screen>
        </Pop>
      </Stage>
    </Beat>
  )
}

/* ---------------------------------------------------------------- power-ups / teams */

const Flame: React.FC<{ size: number }> = ({ size }) => {
  const frame = useCurrentFrame()
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ transform: `scale(${1 + Math.sin(frame / 3) * 0.05})` }}>
      <path d="M50 6c4 16 24 26 24 50a24 24 0 0 1-48 0c0-12 6-18 10-26 2 8 6 10 8 10-2-14 2-26 6-34z" fill={C.orange} stroke={C.orangeDark} strokeWidth="3" strokeLinejoin="round" />
      <path d="M50 52c2 8 12 12 12 24a12 12 0 0 1-24 0c0-8 6-10 6-16 2 2 4 2 6-8z" fill={C.gold} />
    </svg>
  )
}

const FeatureCard: React.FC<{ delay: number; title: string; w: number; children: React.ReactNode }> = ({ delay, title, w, children }) => (
  <Pop from="up" dist={120} delay={delay}>
    <Card style={{ width: w, height: 400, padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', textAlign: 'center' }}>
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', width: '100%' }}>{children}</div>
      <div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 44, lineHeight: 1.05 }}>{title}</div>
    </Card>
  </Pop>
)

const Powers: React.FC = () => {
  const L = useLayout()
  const cw = L.portrait ? 470 : 330
  const ladder = [50, 100, 150, 200]
  return (
    <Beat tone="paper" wipe={false}>
      <Stage style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 26, alignContent: 'center' }}>
        <FeatureCard delay={4} title="Teams" w={cw}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
            {[['Team Green', C.green800, 0.78], ['Team Orange', C.orange, 0.6]].map(([n, c, w], i) => {
              const s = useSpr(14 + i * 6, SNAPPY)
              return (
                <div key={n as string}>
                  <div style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 24, textAlign: 'left', marginBottom: 4 }}>{n}</div>
                  <div style={{ height: 34, borderRadius: 17, background: '#eee', overflow: 'hidden' }}><div style={{ width: `${(w as number) * 100 * s}%`, height: '100%', background: c as string, borderRadius: 17 }} /></div>
                </div>
              )
            })}
          </div>
        </FeatureCard>
        <FeatureCard delay={14} title="Streak" w={cw}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <Flame size={120} />
            <div style={{ display: 'flex', gap: 6 }}>
              {ladder.map((v, i) => {
                const s = useSpr(30 + i * 7, SNAPPY)
                return <div key={v} style={{ background: i === 3 ? C.orange : C.orangeTint, color: i === 3 ? C.white : C.orangeDark, fontFamily: FONT_BODY, fontWeight: 800, fontSize: 22, padding: '6px 8px', borderRadius: 10, transform: `scale(${s})` }}>+{v}</div>
              })}
            </div>
          </div>
        </FeatureCard>
        <FeatureCard delay={24} title="Double points" w={cw}>
          <Pill bg={C.orange} size={25} style={{ letterSpacing: 1 }}>DOUBLE POINTS</Pill>
        </FeatureCard>
        <FeatureCard delay={34} title="50/50" w={cw}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%' }}>
            {['A', 'B', 'C', 'D'].map((l, i) => {
              const gone = (i === 0 || i === 3) && useCurrentFrame() > 70
              return <div key={l} style={{ height: 66, borderRadius: 14, background: gone ? '#eee' : OPTION_COLORS[i], color: gone ? '#bbb' : OPTION_TEXT[i], fontFamily: FONT_BODY, fontWeight: 900, fontSize: 38, display: 'grid', placeItems: 'center', textDecoration: gone ? 'line-through' : 'none' }}>{l}</div>
            })}
          </div>
        </FeatureCard>
        <FeatureCard delay={44} title="Double down" w={cw}>
          <div style={{ width: 150, height: 150, borderRadius: '50%', background: C.gold, display: 'grid', placeItems: 'center', fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 84, color: C.green950, boxShadow: SHADOW_SOFT }}>x2</div>
        </FeatureCard>
      </Stage>
    </Beat>
  )
}

/* ---------------------------------------------------------------- duel */

const Duel: React.FC = () => {
  const L = useLayout()
  const frame = useCurrentFrame()
  const a = Math.round(interpolate(frame, [20, 100], [1200, 2150], { ...clampOpts }))
  const b = Math.round(interpolate(frame, [20, 100], [950, 1850], { ...clampOpts }))
  const vs = useSpr(8, { damping: 8, stiffness: 240, mass: 0.6 })
  const side = (who: { n: string; id: number }, score: number, left: boolean) => (
    <Pop from={left ? 'left' : 'right'} dist={300} style={{ flex: 1, height: '100%' }}>
      <div style={{ height: '100%', boxSizing: 'border-box', paddingTop: L.portrait ? (left ? 240 : 105) : 0, paddingBottom: L.portrait && left ? 95 : 0, background: left ? C.green800 : C.orangeDark, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, fontFamily: FONT_BODY, color: C.white }}>
        <Avatar id={who.id} size={L.portrait ? 170 : 330} mood={score > (left ? b : a) ? 'happy' : 'idle'} />
        <div style={{ fontWeight: 800, fontSize: L.portrait ? 46 : 52 }}>{who.n}</div>
        <div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: L.portrait ? 96 : 120, color: left ? C.gold : C.white, fontVariantNumeric: 'tabular-nums' }}>{score.toLocaleString('en-US')}</div>
      </div>
    </Pop>
  )
  const panelH = L.capBottom - L.capHeight - 16
  return (
    <Beat tone="dark" wipe={false}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: L.w, height: panelH, display: 'flex', flexDirection: L.portrait ? 'column' : 'row' }}>
        {side(PLAYERS[0], a, true)}
        {side(PLAYERS[1], b, false)}
      </div>
      <div style={{ position: 'absolute', left: '50%', top: panelH / 2, transform: `translate(-50%, -50%) scale(${vs})` }}>
        <div style={{ background: C.gold, color: C.green950, fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 110, width: 210, height: 210, borderRadius: '50%', display: 'grid', placeItems: 'center', boxShadow: SHADOW, border: `10px solid ${C.white}` }}>VS</div>
      </div>
      <div style={{ position: 'absolute', left: '50%', top: L.portrait ? L.y : 30, transform: 'translateX(-50%)', zIndex: 5 }}>
        <Pop from="down" dist={60} delay={4}><Pill bg={C.white} color={C.green950} size={40}>Live duel</Pill></Pop>
      </div>
    </Beat>
  )
}

/* ---------------------------------------------------------------- bracket */

// 8 players -> 4 -> 2 -> 1. Columns: x; each match box is 300 wide.
const BR_W = 1000
const BR_H = 780
const SLOT_H = 90
const R1 = PLAYERS
const R2 = [0, 2, 4, 6].map((i) => i) // winners of round 1 (index into PLAYERS)
const R3 = [0, 4]
const FINAL = 0

const BracketCanvas: React.FC = () => {
  const frame = useCurrentFrame()
  const slot = (col: number, row: number, player: number, at0: number, highlight = false) => {
    const s = useSpr(at0, SNAPPY)
    const span = Math.pow(2, col)
    const y = (row * span + (span - 1) / 2) * (SLOT_H + 8) + 10
    const p = PLAYERS[player]
    return (
      <div key={`${col}-${row}`} style={{ position: 'absolute', left: col * 350, top: y, width: 300, height: SLOT_H, borderRadius: 20, background: highlight ? C.gold : 'rgba(255,255,255,0.12)', border: `3px solid ${highlight ? C.white : 'rgba(255,255,255,0.25)'}`, display: 'flex', alignItems: 'center', gap: 14, padding: '0 16px', color: highlight ? C.green950 : C.white, fontFamily: FONT_BODY, fontWeight: 800, fontSize: 30, opacity: s, transform: `translateX(${(1 - s) * -40}px)` }}>
        <Avatar id={p.id} size={64} mood="static" />
        {p.n}
      </div>
    )
  }
  const line = (col: number, row: number, at0: number): React.ReactNode => {
    const p = interpolate(frame, [at0, at0 + 14], [0, 1], clampOpts)
    const span = Math.pow(2, col)
    const y = (row * span + (span - 1) / 2) * (SLOT_H + 8) + 10 + SLOT_H / 2
    const nextSpan = span * 2
    const pairRow = Math.floor(row / 2)
    const ny = (pairRow * nextSpan + (nextSpan - 1) / 2) * (SLOT_H + 8) + 10 + SLOT_H / 2
    const x1 = col * 350 + 300
    return (
      <path key={`l${col}-${row}`} d={`M${x1} ${y} H${x1 + 25} V${ny} H${x1 + 50}`} fill="none" stroke={C.orange} strokeWidth="6" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
    )
  }
  return (
    <div style={{ position: 'relative', width: BR_W, height: BR_H }}>
      <svg width={BR_W} height={BR_H} style={{ position: 'absolute', left: 0, top: 0 }}>
        {R1.map((_, i) => line(0, i, 30 + i * 3))}
        {R2.map((_, i) => line(1, i, 62 + i * 5))}
        {R3.map((_, i) => line(2, i, 92 + i * 6))}
      </svg>
      {R1.map((_, i) => slot(0, i, i, 4 + i * 3))}
      {R2.map((pl, i) => slot(1, i, pl, 46 + i * 5))}
      {R3.map((pl, i) => slot(2, i, pl, 80 + i * 6))}
    </div>
  )
}

const Bracket: React.FC = () => {
  const L = useLayout()
  const bs = L.portrait ? Math.min(1, L.sw / BR_W) : 0.95
  return (
    <Beat tone="dark" wipe={false}>
      <Stage style={{ display: 'flex', flexDirection: L.portrait ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: L.portrait ? 30 : 80 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, alignItems: L.portrait ? 'center' : 'flex-start' }}>
          <Pop from="left" dist={100}><Pill bg={C.orange} size={44}>Quiz battles</Pill></Pop>
          <Words text="Knockout bracket" size={L.portrait ? 86 : 92} delay={6} />
        </div>
        <div style={{ width: BR_W * bs, height: BR_H * bs }}>
          <div style={{ transform: `scale(${bs})`, transformOrigin: '0 0' }}>
            <BracketCanvas />
          </div>
        </div>
      </Stage>
    </Beat>
  )
}

/* ---------------------------------------------------------------- champion */

const Champion: React.FC = () => {
  const L = useLayout()
  const w = L.portrait ? L.sw : 1200
  const step = (delay: number, h: number, color: string, label: string, p: (typeof PLAYERS)[number], mood: 'dance' | 'happy', size: number) => {
    const s = useSpr(delay, SNAPPY)
    return (
      <div style={{ width: w * 0.3, textAlign: 'center', fontFamily: FONT_BODY }}>
        <div style={{ transform: `translateY(${(1 - s) * -200}px)`, opacity: s }}>
          <Avatar id={p.id} size={size} mood={mood} style={{ margin: '0 auto' }} />
          <div style={{ fontWeight: 800, fontSize: 40, color: C.white, marginTop: -6 }}>{p.n}</div>
        </div>
        <div style={{ height: h * s, background: color, borderRadius: '20px 20px 0 0', marginTop: 8, display: 'grid', placeItems: 'center', fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 96, color: C.green950 }}>{label}</div>
      </div>
    )
  }
  return (
    <Beat tone="dark" wipe={false}>
      <Shake start={30} amount={10}>
        <Stage style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <Pop from="down" dist={80}><div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: L.portrait ? 92 : 100, color: C.gold }}>Champion!</div></Pop>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 16, width: w }}>
            {step(14, 200, '#cfd8d3', '2', PLAYERS[0], 'happy', L.portrait ? 170 : 220)}
            {step(6, 300, C.gold, '1', PLAYERS[1], 'dance', L.portrait ? 240 : 300)}
            {step(22, 140, '#e3a06f', '3', PLAYERS[2], 'happy', L.portrait ? 150 : 200)}
          </div>
        </Stage>
      </Shake>
      <Confetti start={26} count={130} seed="podium" />
    </Beat>
  )
}

/* ---------------------------------------------------------------- share */

const Share: React.FC = () => {
  const L = useLayout()
  const frame = useCurrentFrame()
  const pw = L.portrait ? 460 : 440
  const reply = frame >= 60
  return (
    <Beat tone="paper">
      <Row>
        <Pop from="left" dist={160}>
          <Phone width={pw} bg="#efeae2" viewH={L.portrait ? 1000 : 1150}>
            <div style={{ background: C.green800, color: C.white, fontWeight: 800, fontSize: 52, padding: '96px 40px 30px' }}>Friend</div>
            <div style={{ padding: '44px 36px', display: 'flex', flexDirection: 'column', gap: 30 }}>
              <Pop from="right" dist={120} delay={14} config={SNAPPY} style={{ alignSelf: 'flex-end', width: 600 }}>
                <div style={{ background: '#d9fdd3', borderRadius: 34, padding: 26, boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>
                  <div style={{ fontWeight: 600, fontSize: 40, marginBottom: 16 }}>Beat my score?</div>
                  <div style={{ background: C.white, borderRadius: 26, padding: 26 }}>
                    <div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 52, lineHeight: 1.05 }}>Quiz battle</div>
                    <div style={{ fontWeight: 600, fontSize: 32, color: '#666', margin: '8px 0 20px' }}>nammeshub.com.ng</div>
                    <div style={{ background: C.orange, color: C.white, fontWeight: 800, fontSize: 40, padding: '18px 0', borderRadius: 20, textAlign: 'center' }}>Challenge a friend</div>
                  </div>
                </div>
              </Pop>
              {reply && (
                <Pop from="left" dist={120} config={SNAPPY} style={{ alignSelf: 'flex-start' }}>
                  <div style={{ background: C.white, borderRadius: 34, padding: '22px 34px', fontWeight: 700, fontSize: 44, boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>Say less. I'm in!</div>
                </Pop>
              )}
            </div>
          </Phone>
        </Pop>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: L.portrait ? 'center' : 'flex-start', gap: 30 }}>
          <Stamp text="No account." size={L.portrait ? 100 : 112} delay={44} rotate={-3} />
          <Stamp text="Just a nickname." size={L.portrait ? 100 : 112} delay={64} rotate={2} bg={C.green800} />
        </div>
      </Row>
    </Beat>
  )
}

export const LiveQuiz: React.FC = () => (
  <AbsoluteFill>
    <Beats scene="quiz" beats={{ lobby: <Lobby />, question: <Question />, reveal: <Reveal />, powers: <Powers />, duel: <Duel />, bracket: <Bracket />, champion: <Champion />, share: <Share /> }} />
  </AbsoluteFill>
)

void random
