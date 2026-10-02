import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { C, FONT_BODY, FONT_HEAD, SHADOW, SHADOW_SOFT } from '../brand'
import { Beats } from '../components/beats'
import { Qr } from '../components/Qr'
import { Beat, BrowserFrame, Card, Confetti, Cursor, Pill, PhoneFrame, Pop, Stage, useSpr, ease } from '../components/ui'
import { BW, CHROME, SC, Skel, Split, at, clampOpts } from '../components/split'
import { useLayout } from '../layout'

/* ---------------------------------------------------------------- events */

const TILE_COLORS = [C.green700, C.orange, C.gold, C.green800, '#ffb38f', C.green100, C.orangeDark, '#8fd0a4']

const Gallery: React.FC = () => (
  <div style={{ position: 'absolute', left: 0, top: 270, width: 1280, height: 600, background: '#fcf9f8' }}>
    <div style={{ position: 'absolute', left: 64, top: 10, width: 1152, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
      {TILE_COLORS.map((c, i) => (
        <TilePop key={i} i={i} color={c} />
      ))}
    </div>
  </div>
)

const TilePop: React.FC<{ i: number; color: string }> = ({ i, color }) => {
  const s = useSpr(74 + i * 4)
  return (
    <div style={{ height: 240, borderRadius: 14, background: color, transform: `scale(${s})`, display: 'grid', placeItems: 'center', boxShadow: SHADOW_SOFT }}>
      <svg width="64" height="64" viewBox="0 0 64 64" opacity="0.55">
        <rect x="6" y="16" width="52" height="38" rx="8" fill="none" stroke="#fff" strokeWidth="5" />
        <circle cx="32" cy="35" r="10" fill="none" stroke="#fff" strokeWidth="5" />
        <rect x="22" y="8" width="20" height="9" rx="3" fill="#fff" />
      </svg>
    </div>
  )
}

const Events: React.FC = () => {
  const frame = useCurrentFrame()
  const vh = 780
  const a1 = interpolate(frame, [36, 44], [1, 0], clampOpts)
  const a2 = interpolate(frame, [36, 44], [0, 1], clampOpts)
  const card = at(250, 660)
  const tab = at(210, 240)
  const ring = useSpr(64)
  return (
    <Beat tone="dark" wipe={false}>
      <Split
        frameH={CHROME + vh * SC}
        side={
          <>
            <Pop from="right" dist={120} delay={10}><Pill bg={C.orange} size={40}>Events</Pill></Pop>
            <Pop from="right" dist={120} delay={70}><Pill bg={C.gold} color={C.green950} size={40}>Photo gallery</Pill></Pop>
          </>
        }
        frame={
          <>
            <div style={{ position: 'absolute', left: 0, top: 0, opacity: a1 }}>
              <BrowserFrame width={BW} src="screens/events.jpg" viewH={vh} url="nammeshub.com.ng/events" />
            </div>
            <div style={{ position: 'absolute', left: 0, top: 0, opacity: a2 }}>
              <BrowserFrame width={BW} src="screens/event-detail.jpg" viewH={vh} url="nammeshub.com.ng/events/materials-horizon-3-0">
                <Gallery />
                <div style={{ position: 'absolute', left: 150, top: 222, width: 150, height: 46, borderRadius: 12, border: `5px solid ${C.orange}`, opacity: ring, transform: `scale(${0.7 + 0.3 * ring})` }} />
              </BrowserFrame>
            </div>
            <Cursor keys={[{ f: 8, x: 700 * SC, y: CHROME + 300 * SC }, { f: 26, ...card }, { f: 46, ...card }, { f: 66, ...tab }, { f: 150, ...tab }]} taps={[30, 70]} />
          </>
        }
      />
    </Beat>
  )
}

/* ---------------------------------------------------------------- news */

const NewsCards: React.FC = () => (
  <div style={{ position: 'absolute', left: 0, top: 500, width: 1280, height: 340, background: '#fcf9f8' }}>
    <div style={{ position: 'absolute', left: 64, top: 10, width: 1152, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 22 }}>
      {[0, 1, 2].map((i) => (
        <NewsCard key={i} i={i} />
      ))}
    </div>
  </div>
)

const NewsCard: React.FC<{ i: number }> = ({ i }) => {
  const s = useSpr(14 + i * 8)
  return (
    <div style={{ background: C.white, borderRadius: 16, border: '1px solid #d8d2d0', overflow: 'hidden', transform: `translateY(${(1 - s) * 60}px)`, opacity: s }}>
      <div style={{ height: 120, background: [C.green100, C.orangeTint, '#fff6d6'][i] }} />
      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ alignSelf: 'flex-start', fontFamily: FONT_BODY, fontWeight: 800, fontSize: 12, padding: '4px 12px', borderRadius: 999, background: '#ffe6d6', color: '#ae3200' }}>{['Academics', 'Welfare', 'Industry'][i]}</div>
        <Skel w="90%" h={16} />
        <Skel w="64%" h={12} />
      </div>
    </div>
  )
}

const News: React.FC = () => (
  <Beat tone="paper">
    <Split
      frameH={CHROME + 830 * SC}
      side={
        <>
          <Pop from="right" dist={120} delay={8}><Pill bg={C.green800} size={44}>Department news</Pill></Pop>
          <Pop from="right" dist={120} delay={26}><Pill bg={C.white} color={C.ink} size={36}>Filter by category</Pill></Pop>
        </>
      }
      frame={
        <Pop from="up" dist={140}>
          <BrowserFrame width={BW} src="screens/news.jpg" viewH={830} url="nammeshub.com.ng/news">
            <NewsCards />
          </BrowserFrame>
        </Pop>
      }
    />
  </Beat>
)

/* ---------------------------------------------------------------- opportunities */

const OppTable: React.FC = () => {
  const frame = useCurrentFrame()
  const hl = interpolate(frame, [30, 44], [0, 1], clampOpts)
  return (
    <div style={{ position: 'absolute', left: 0, top: 510, width: 1280, height: 345, background: '#fcf9f8' }}>
      <div style={{ position: 'absolute', left: 64, top: 10, width: 1152, background: C.white, border: '1px solid #d8d2d0', borderRadius: 16, overflow: 'hidden', fontFamily: FONT_BODY }}>
        <div style={{ display: 'flex', height: 52, alignItems: 'center', background: '#f5f1f0', fontWeight: 800, fontSize: 13, letterSpacing: 1, color: '#333' }}>
          <div style={{ width: 230, paddingLeft: 24 }}>DEADLINE</div><div style={{ width: 200 }}>TYPE</div><div style={{ flex: 1 }}>TITLE &amp; ORG</div>
        </div>
        {[0, 1, 2].map((i) => {
          const s = Math.min(1, Math.max(0, (frame - 10 - i * 8) / 10))
          return (
            <div key={i} style={{ display: 'flex', height: 82, alignItems: 'center', borderTop: '1px solid #ddd', opacity: s, transform: `translateX(${(1 - s) * 50}px)`, background: i === 0 ? `rgba(255,90,31,${0.09 * hl})` : C.white }}>
              <div style={{ width: 230, paddingLeft: 24 }}><Skel w={140 - i * 14} h={18} tone="#ffb38f" /></div>
              <div style={{ width: 200 }}><div style={{ display: 'inline-block', width: 100, height: 28, borderRadius: 999, background: C.green100 }} /></div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Skel w={360 - i * 40} h={16} /><Skel w={200} h={11} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const Opportunities: React.FC = () => {
  const arrow = useSpr(40)
  return (
    <Beat tone="dark">
      <Split
        frameH={CHROME + 855 * SC}
        side={
          <>
            <Pop from="right" dist={120} delay={8}><Pill bg={C.orange} size={44}>Opportunities</Pill></Pop>
            <Pop from="right" dist={120} delay={36}>
              <Pill bg={C.gold} color={C.green950} size={38}>
                <span style={{ display: 'inline-block', transform: `translateY(${(1 - arrow) * -10}px)` }}>↑</span> Soonest deadline first
              </Pill>
            </Pop>
          </>
        }
        frame={
          <Pop from="up" dist={140}>
            <BrowserFrame width={BW} src="screens/opportunities.jpg" viewH={855} url="nammeshub.com.ng/opportunities">
              <OppTable />
            </BrowserFrame>
          </Pop>
        }
      />
    </Beat>
  )
}

/* ---------------------------------------------------------------- awards */

const PHASES = ['Nominating', 'Curating', 'Voting', 'Closed', 'Revealed']
const PHASE_NOTE = [
  'Nominate someone for each category.',
  'Nominations closed. The shortlist is being finalized.',
  'Pick one nominee per category, then submit your whole ballot.',
  'Voting closed. Results will be announced soon.',
  'Results revealed.',
]
// the stage tour, then back to Voting for the ballot, then on to Revealed
const phaseAt = (f: number) => (f < 22 ? 0 : f < 44 ? 1 : f < 66 ? 2 : f < 88 ? 3 : f < 110 ? 4 : f < 192 ? 2 : 4)

const Tracker: React.FC = () => {
  const L = useLayout()
  const frame = useCurrentFrame()
  const ph = phaseAt(frame)
  const fs = L.portrait ? 27 : 32
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: L.portrait ? 6 : 10 }}>
      {PHASES.map((p, i) => (
        <React.Fragment key={p}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: `${fs * 0.35}px ${fs * 0.75}px`, borderRadius: 999, fontFamily: FONT_BODY, fontWeight: 800, fontSize: fs, background: i === ph ? C.orange : i < ph ? C.green800 : C.white, color: i <= ph ? C.white : C.ink, boxShadow: SHADOW_SOFT, transform: `scale(${i === ph ? 1.1 : 1})` }}>
            {i < ph ? '✓' : i + 1}. {p}
          </div>
          {i < 4 && <div style={{ width: L.portrait ? 6 : 26, height: 6, borderRadius: 3, background: i < ph ? C.green800 : '#d8d2d0' }} />}
        </React.Fragment>
      ))}
    </div>
  )
}

const OPTS = [
  ['Ada_Bolt', 'MMEKing', 'Player 1'],
  ['Player 2', 'Tunde_T', 'Ngozi_N'],
]

const Ballot: React.FC = () => {
  const frame = useCurrentFrame()
  const f = frame - 112
  const pick = (cat: number, opt: number, at0: number) => (f >= at0 ? 1 : 0) * (cat === 0 ? (opt === 1 ? 1 : 0) : opt === 0 ? 1 : 0)
  const submitted = f >= 66
  const btnPress = f >= 60 && f < 66
  const s = useSpr(112)
  const done = useSpr(178)
  return (
    <div style={{ position: 'relative', width: 1000, height: 560, opacity: s, transform: `scale(${0.9 + 0.1 * s})` }}>
      <Card style={{ position: 'absolute', inset: 0, padding: 0, fontFamily: FONT_BODY }}>
        <div style={{ position: 'absolute', left: 36, top: 30, display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 62, height: 62, borderRadius: '50%', background: C.green900, display: 'grid', placeItems: 'center', color: C.white, fontSize: 32 }}>✓</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: 1.2, color: C.orangeDark }}>OFFICIAL STUDENT BALLOT</div>
            <div style={{ fontWeight: 600, fontSize: 24, color: '#555' }}>Matric no: verified · 1 vote per student</div>
          </div>
        </div>
        <div style={{ position: 'absolute', right: 36, top: 40, display: 'flex', alignItems: 'center', gap: 10, background: '#f5f1f0', borderRadius: 999, padding: '10px 20px', fontWeight: 800, fontSize: 20 }}>
          <span style={{ width: 14, height: 14, borderRadius: '50%', background: C.orange, opacity: 0.5 + 0.5 * Math.sin(frame / 4) }} /> Polling live
        </div>
        {[0, 1].map((cat) => (
          <React.Fragment key={cat}>
            <div style={{ position: 'absolute', left: 40, top: 140 + cat * 150, fontWeight: 800, fontSize: 28 }}>Category {cat + 1}</div>
            {OPTS[cat].map((name, opt) => {
              const on = pick(cat, opt, cat === 0 ? 14 : 34)
              return (
                <div key={name} style={{ position: 'absolute', left: 40 + opt * 320, top: 190 + cat * 150, width: 290, height: 70, borderRadius: 16, border: `3px solid ${on ? C.orange : '#d8d2d0'}`, background: on ? C.orangeTint : C.white, display: 'flex', alignItems: 'center', gap: 14, padding: '0 20px', fontWeight: 700, fontSize: 26 }}>
                  <span style={{ width: 28, height: 28, borderRadius: '50%', border: `3px solid ${on ? C.orange : '#bbb'}`, background: on ? C.orange : 'transparent', boxShadow: on ? `inset 0 0 0 5px ${C.orangeTint}` : 'none' }} />
                  {name}
                </div>
              )
            })}
          </React.Fragment>
        ))}
        <div style={{ position: 'absolute', left: 40, top: 452, width: 330, height: 70, borderRadius: 16, background: submitted ? C.green800 : C.orange, color: C.white, fontWeight: 800, fontSize: 30, display: 'grid', placeItems: 'center', transform: `scale(${btnPress ? 0.94 : 1})`, boxShadow: btnPress ? 'none' : '0 8px 18px rgba(255,90,31,0.35)' }}>
          {submitted ? '✓ Ballot submitted' : 'Submit ballot'}
        </div>
        {submitted && (
          <div style={{ position: 'absolute', left: 410, top: 462, fontWeight: 700, fontSize: 26, color: C.green800, opacity: done }}>Thank you for voting</div>
        )}
      </Card>
      <Cursor keys={[{ f: 122, x: 700, y: 400 }, { f: 130, x: 640 + 140, y: 225 }, { f: 148, x: 40 + 145, y: 375 }, { f: 172, x: 200, y: 487 }, { f: 195, x: 200, y: 487 }]} taps={[128, 146, 172]} />
    </div>
  )
}

const Winner: React.FC = () => {
  const frame = useCurrentFrame()
  const s = useSpr(194, { damping: 10, stiffness: 160, mass: 0.8 })
  return (
    <div style={{ width: 760, transform: `scale(${0.6 + 0.4 * s})`, opacity: Math.min(1, s * 2) }}>
      <div style={{ background: `linear-gradient(160deg, ${C.gold}, #ffe38a)`, borderRadius: 36, padding: 40, boxShadow: SHADOW, textAlign: 'center', fontFamily: FONT_BODY }}>
        <svg width="150" height="150" viewBox="0 0 100 100" style={{ transform: `rotate(${Math.sin(frame / 5) * 4}deg)` }}>
          <path d="M28 14h44v20q0 26-22 30-22-4-22-30z" fill={C.orange} stroke={C.orangeDark} strokeWidth="3" strokeLinejoin="round" />
          <path d="M28 20H12q0 22 18 24M72 20h16q0 22-18 24" fill="none" stroke={C.orangeDark} strokeWidth="4" />
          <rect x="42" y="64" width="16" height="12" fill={C.orangeDark} />
          <rect x="30" y="76" width="40" height="10" rx="3" fill={C.green900} />
        </svg>
        <div style={{ fontWeight: 800, fontSize: 26, letterSpacing: 2, color: C.green900, marginTop: 8 }}>WINNER · CATEGORY 1</div>
        <div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 84, color: C.green950 }}>MMEKing</div>
      </div>
    </div>
  )
}

const Awards: React.FC = () => {
  const L = useLayout()
  const frame = useCurrentFrame()
  const ph = phaseAt(frame)
  const tourNote = frame < 110 || (frame >= 192 && frame < 194)
  const opTour = interpolate(frame, [100, 110], [1, 0], clampOpts)
  const opBallot = interpolate(frame, [108, 116, 186, 194], [0, 1, 1, 0], clampOpts)
  const opWin = interpolate(frame, [192, 198], [0, 1], clampOpts)
  return (
    <Beat tone="paper">
      <Stage style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: L.portrait ? 50 : 36 }}>
        <Pop from="down" dist={80}>
          <div style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 26, letterSpacing: 1.6, background: C.orangeTint, color: C.orangeDark, padding: '10px 26px', borderRadius: 999 }}>ANNUAL DEPARTMENTAL POLL</div>
        </Pop>
        <Tracker />
        <div style={{ position: 'relative', width: 1000, height: 560 }}>
          {tourNote && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', opacity: opTour }}>
              <Card style={{ padding: '54px 60px', width: 820, textAlign: 'center' }}>
                <div key={ph} style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 66, color: C.green900 }}>{PHASES[ph]}</div>
                <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 34, color: '#555', marginTop: 18, lineHeight: 1.25 }}>{PHASE_NOTE[ph]}</div>
              </Card>
            </div>
          )}
          <div style={{ position: 'absolute', inset: 0, opacity: opBallot }}><Ballot /></div>
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', opacity: opWin }}><Winner /></div>
        </div>
      </Stage>
      {frame >= 196 && <Confetti start={196} count={90} seed="award" />}
    </Beat>
  )
}

/* ---------------------------------------------------------------- forms */

const FormsBeat: React.FC = () => {
  const L = useLayout()
  const frame = useCurrentFrame()
  const typed = 'Ada_Bolt'.slice(0, Math.max(0, Math.floor((frame - 14) / 3)))
  const radio = useSpr(52)
  const vh = 530
  const zoomF = L.portrait ? 1 : 1.25
  const a1 = interpolate(frame, [80, 90], [1, 0], clampOpts)
  const a2 = interpolate(frame, [84, 96], [0, 1], clampOpts)
  const scan = interpolate(frame % 40, [0, 40], [0, 1])
  const found = frame > 128
  const pw = 360
  return (
    <Beat tone="dark">
      <Stage>
        <div style={{ position: 'absolute', inset: 0, opacity: a1, display: 'grid', placeItems: 'center' }}>
          <div style={{ position: 'relative', width: BW, height: CHROME + vh * SC, transform: `scale(${zoomF})` }}>
            <Pop from="up" dist={140}>
              <BrowserFrame width={BW} src="screens/form-detail.jpg" viewH={vh} scroll={330} url="nammeshub.com.ng/forms">
                <div style={{ position: 'absolute', left: 326, top: 392, fontFamily: FONT_BODY, fontSize: 22, color: '#3a1b10', fontWeight: 600 }}>{typed}{frame % 14 < 7 && frame < 60 ? '|' : ''}</div>
                <div style={{ position: 'absolute', left: 327, top: 799, width: 14, height: 14, borderRadius: '50%', background: C.orange, transform: `scale(${radio})` }} />
              </BrowserFrame>
            </Pop>
            <Cursor keys={[{ f: 6, x: 300, y: 50 }, { f: 12, ...at(600, 402 - 330 + 20) }, { f: 46, ...at(344, 806 - 330) }, { f: 70, ...at(344, 806 - 330) }]} taps={[14, 52]} />
          </div>
          <div style={{ position: 'absolute', top: L.portrait ? 40 : 10 }} />
        </div>
        <div style={{ position: 'absolute', inset: 0, opacity: a2, display: 'flex', flexDirection: L.portrait ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: L.portrait ? 50 : 100 }}>
          <Pop from="left" dist={140} delay={86}>
            <Card style={{ padding: 34, width: 480, textAlign: 'center' }}>
              <div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 42, marginBottom: 20 }}>Share this form</div>
              <div style={{ display: 'grid', placeItems: 'center', position: 'relative' }}>
                <Qr size={330} seed="form" />
                <div style={{ position: 'absolute', left: '50%', marginLeft: -165, top: `calc(50% - 165px + ${scan * 330}px)`, width: 330, height: 6, background: C.orange, boxShadow: `0 0 18px ${C.orange}`, opacity: found ? 0 : 1 }} />
              </div>
              <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 24 }}>
                <Pill bg={C.green100} color={C.green900} size={26}>Copy link</Pill>
                <Pill bg={C.orange} size={26}>QR code</Pill>
              </div>
            </Card>
          </Pop>
          <Pop from="right" dist={140} delay={98}>
            <PhoneFrame width={pw} viewH={1250} bg="#fdebe0">
              <div style={{ width: 800, height: 1250, background: 'linear-gradient(160deg,#ffe2cf,#ffc9ad)', position: 'relative', fontFamily: FONT_BODY }}>
                {!found ? (
                  <>
                    <div style={{ position: 'absolute', left: 120, top: 320, width: 560, height: 560, border: `8px dashed ${C.white}`, borderRadius: 40, opacity: 0.85 }} />
                    <div style={{ position: 'absolute', left: 0, right: 0, top: 150, textAlign: 'center', fontWeight: 800, fontSize: 52, color: C.green950 }}>Point at the QR code</div>
                  </>
                ) : (
                  <div style={{ padding: '150px 48px' }}>
                    <Pop from="up" dist={80} delay={130}>
                      <div style={{ background: '#fffaf6', borderRadius: 28, padding: 40, boxShadow: SHADOW_SOFT }}>
                        <div style={{ fontWeight: 900, fontSize: 52, color: '#3a1b10' }}>The form opens</div>
                        <div style={{ marginTop: 26 }}><Skel w="80%" h={26} tone="#e7d6cb" /></div>
                        <div style={{ marginTop: 22 }}><Skel w="100%" h={70} tone="#f1e3d9" /></div>
                        <div style={{ marginTop: 22 }}><Skel w="64%" h={26} tone="#e7d6cb" /></div>
                      </div>
                    </Pop>
                  </div>
                )}
              </div>
            </PhoneFrame>
          </Pop>
        </div>
      </Stage>
    </Beat>
  )
}

export const Community: React.FC = () => (
  <AbsoluteFill>
    <Beats scene="community" beats={{ events: <Events />, news: <News />, opportunities: <Opportunities />, awards: <Awards />, forms: <FormsBeat /> }} />
  </AbsoluteFill>
)

void ease
