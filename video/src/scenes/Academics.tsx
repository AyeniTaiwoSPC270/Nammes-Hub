import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { C, FONT_BODY, FONT_HEAD, SHADOW_SOFT } from '../brand'
import { Beats } from '../components/beats'
import { Beat, BrowserFrame, Cursor, Logo, Pill, Pop, Words, ease, useSpr } from '../components/ui'
import { useLayout } from '../layout'
import { BW, CHROME, SC, Skel, Split, at, clampOpts } from '../components/split'

const Step: React.FC<{ n: number; label: string; active: boolean; done: boolean }> = ({ n, label, active, done }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 24px', borderRadius: 999, fontFamily: FONT_BODY, fontWeight: 800, fontSize: 30, background: active ? C.orange : done ? C.green800 : C.white, color: active || done ? C.white : C.ink, boxShadow: SHADOW_SOFT, transform: `scale(${active ? 1.08 : 1})` }}>
    <span style={{ width: 38, height: 38, borderRadius: '50%', background: active ? C.white : done ? C.gold : C.green100, color: active ? C.orange : C.green900, display: 'grid', placeItems: 'center', fontSize: 24 }}>{n}</span>
    {label}
  </div>
)

const Badge: React.FC<{ kind: 'C' | 'E'; size?: number }> = ({ kind, size = 26 }) => (
  <span style={{ display: 'inline-grid', placeItems: 'center', width: size * 1.4, height: size * 1.4, borderRadius: '50%', fontFamily: FONT_BODY, fontWeight: 800, fontSize: size, background: kind === 'C' ? C.green900 : '#ffe6d6', color: kind === 'C' ? C.white : '#e2460f' }}>{kind}</span>
)

/* ---------------------------------------------------------------- outlines */

const COURSES: [string, string, number][] = [
  ['CHM-CM 101', 'General Chemistry I', 2],
  ['GET 101', 'Introduction to Engineering', 1],
  ['GET 103', 'Engineering Mathematics I', 2],
  ['MTH 101', 'Elementary Mathematics I', 2],
  ['PHY-CM 101', 'General Physics I (Mechanics)', 2],
  ['PHY-CM 103', 'General Physics III (Heat and Properties of Matter)', 2],
]

const CourseTable: React.FC = () => (
  // Redrawn over the screenshot from y=322 so the Status column (C / E) can be shown.
  <div style={{ position: 'absolute', left: 0, top: 322, width: 1280, height: 520, background: '#fcf9f8' }}>
    <div style={{ position: 'absolute', left: 64, top: 5, width: 1152, borderRadius: 16, border: '1px solid #d8d2d0', background: C.white, overflow: 'hidden', fontFamily: FONT_BODY, color: C.ink }}>
      <div style={{ height: 61, background: '#f5f1f0', padding: '0 17px', display: 'flex', alignItems: 'center', fontWeight: 800, fontSize: 18 }}>100 Level · First Semester Courses</div>
      <div style={{ height: 49, borderTop: '1px solid #d8d2d0', display: 'flex', alignItems: 'center', fontWeight: 800, fontSize: 12.5, letterSpacing: 1, color: '#333' }}>
        <div style={{ width: 200, paddingLeft: 17 }}>COURSE CODE</div>
        <div style={{ flex: 1 }}>COURSE TITLE</div>
        <div style={{ width: 110 }}>UNITS</div>
        <div style={{ width: 130 }}>STATUS</div>
        <div style={{ width: 210 }}>ACTION</div>
      </div>
      {COURSES.map(([code, title, units], i) => (
        <div key={code} style={{ height: 57, borderTop: '1px solid #d8d2d0', display: 'flex', alignItems: 'center', fontSize: 17 }}>
          <div style={{ width: 200, paddingLeft: 17, fontWeight: 800 }}>{code}</div>
          <div style={{ flex: 1, color: '#444' }}>{title}</div>
          <div style={{ width: 110 }}>{units}</div>
          <div style={{ width: 130 }}>
            <BadgePop i={i} />
          </div>
          <div style={{ width: 210, fontWeight: 800, color: '#ae3200', fontSize: 15 }}>View outline →</div>
        </div>
      ))}
    </div>
    <div style={{ position: 'absolute', left: 64, top: 480, fontFamily: FONT_BODY, fontSize: 16, color: '#555', fontWeight: 600 }}>
      <b style={{ color: C.ink }}>C</b> = Compulsory · <b style={{ color: C.ink }}>E</b> = Elective
    </div>
  </div>
)

const BadgePop: React.FC<{ i: number }> = ({ i }) => {
  const s = useSpr(14 + i * 7)
  return (
    <div style={{ transform: `scale(${s})`, display: 'inline-block' }}>
      <Badge kind="C" size={15} />
    </div>
  )
}

const Outlines: React.FC = () => {
  const frame = useCurrentFrame()
  const L = useLayout()
  const vh = 830
  const frameH = CHROME + vh * SC
  const a1 = interpolate(frame, [58, 66], [1, 0], clampOpts)
  const a2 = interpolate(frame, [58, 66, 112, 120], [0, 1, 1, 0], clampOpts)
  const a3 = interpolate(frame, [112, 120], [0, 1], clampOpts)
  const step = frame < 62 ? 0 : frame < 116 ? 1 : 2
  const cursorOut = interpolate(frame, [116, 126], [1, 0], clampOpts)
  const p1 = at(174, 510)
  const p2 = at(330, 318)
  // in the course step, a glow ring sits on the Status column header
  const ring = useSpr(150)
  const frameNode = (
    <>
      <div style={{ position: 'absolute', left: 0, top: 0, opacity: a1 }}>
        <BrowserFrame width={BW} src="screens/outlines.jpg" viewH={vh} url="nammeshub.com.ng/outlines" />
      </div>
      <div style={{ position: 'absolute', left: 0, top: 0, opacity: a2 }}>
        <BrowserFrame width={BW} src="screens/outlines-level.jpg" viewH={vh} url="nammeshub.com.ng/outlines/100" />
      </div>
      <div style={{ position: 'absolute', left: 0, top: 0, opacity: a3 }}>
        <BrowserFrame width={BW} src="screens/outlines-courses.jpg" viewH={vh} url="nammeshub.com.ng/outlines/100/1">
          <CourseTable />
          <div style={{ position: 'absolute', left: 866, top: 392, width: 130, height: 40, borderRadius: 14, border: `5px solid ${C.orange}`, opacity: ring, transform: `scale(${0.6 + 0.4 * ring})` }} />
        </BrowserFrame>
      </div>
      <div style={{ opacity: cursorOut }}>
        <Cursor keys={[{ f: 8, x: 700 * SC, y: CHROME + 380 * SC }, { f: 40, ...p1 }, { f: 66, ...p1 }, { f: 98, ...p2 }, { f: 130, ...p2 }]} taps={[44, 100]} />
      </div>
    </>
  )
  const side = (
    <>
      <div style={{ display: 'flex', flexDirection: L.portrait ? 'row' : 'column', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Step n={1} label="Level" active={step === 0} done={step > 0} />
        <Step n={2} label="Semester" active={step === 1} done={step > 1} />
        <Step n={3} label="Course" active={step === 2} done={false} />
      </div>
      {frame > 126 && (
        <div style={{ display: 'flex', flexDirection: L.portrait ? 'row' : 'column', gap: 22 }}>
          <Pop from="right" dist={120} delay={128}>
            <Pill bg={C.white} color={C.ink} size={38}><Badge kind="C" size={30} /> Compulsory</Pill>
          </Pop>
          <Pop from="right" dist={120} delay={140}>
            <Pill bg={C.white} color={C.ink} size={38}><Badge kind="E" size={30} /> Elective</Pill>
          </Pop>
        </div>
      )}
    </>
  )
  return (
    <Beat tone="paper" wipe={false}>
      <Split frame={frameNode} side={side} frameH={frameH} />
    </Beat>
  )
}

/* ---------------------------------------------------------------- outline detail */

const DetailExtras: React.FC = () => (
  <div style={{ position: 'absolute', left: 64, top: 800, width: 1152, fontFamily: FONT_BODY }}>
    <div style={{ background: C.white, border: '1px solid #d8d2d0', borderRadius: 16, padding: 24, marginBottom: 24 }}>
      <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: 1, color: '#ae3200', marginBottom: 18 }}>RECOMMENDED TEXTS</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Skel w="72%" h={16} />
        <Skel w="58%" h={16} />
        <Skel w="66%" h={16} />
      </div>
    </div>
    <div style={{ background: C.white, border: '1px solid #d8d2d0', borderRadius: 16, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: 1, color: '#ae3200' }}>PAST QUESTIONS</div>
        <div style={{ border: '2px solid #ff5a1f', color: '#ff5a1f', fontWeight: 800, fontSize: 14, padding: '6px 16px', borderRadius: 8 }}>Contribute</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Skel w="62%" h={16} />
        <Skel w="48%" h={16} />
      </div>
    </div>
  </div>
)

const Detail: React.FC = () => {
  const frame = useCurrentFrame()
  const vh = 830
  const scroll = interpolate(frame, [48, 140], [0, 330], { ...clampOpts, easing: ease })
  const side = (
    <>
      <Pop from="right" dist={120} delay={12}><Pill bg={C.green800} size={40}>Topics covered</Pill></Pop>
      <Pop from="right" dist={120} delay={64}><Pill bg={C.orange} size={40}>Recommended texts</Pill></Pop>
      <Pop from="right" dist={120} delay={104}><Pill bg={C.gold} color={C.green950} size={40}>Past questions</Pill></Pop>
    </>
  )
  return (
    <Beat tone="dark">
      <Split
        frameH={CHROME + vh * SC}
        side={side}
        frame={
          <Pop from="up" dist={140}>
            <BrowserFrame width={BW} src="screens/outline-detail.jpg" viewH={vh} scroll={scroll} url="nammeshub.com.ng/outlines/100/1/chm-cm-101">
              <DetailExtras />
            </BrowserFrame>
          </Pop>
        }
      />
    </Beat>
  )
}

/* ---------------------------------------------------------------- curriculum */

const Curriculum: React.FC = () => {
  const frame = useCurrentFrame()
  const vh = 830
  const zoom = interpolate(frame, [0, 120], [1, 1.06], clampOpts)
  const ring = useSpr(20)
  return (
    <Beat tone="paper">
      <Split
        frameH={CHROME + vh * SC}
        side={
          <>
            <Words text="The official CCMAS curriculum" size={72} color={C.green900} delay={6} maxWidth={620} />
            <Pop from="up" delay={30}>
              <div style={{ fontFamily: FONT_BODY, fontSize: 34, fontWeight: 600, color: '#444', maxWidth: 620, lineHeight: 1.3 }}>NUC Core Curriculum and Minimum Academic Standards for Materials and Metallurgical Engineering.</div>
            </Pop>
          </>
        }
        frame={
          <div style={{ transform: `scale(${zoom})`, transformOrigin: '50% 30%' }}>
            <Pop from="up" dist={140}>
              <BrowserFrame width={BW} src="screens/curriculum.jpg" viewH={vh} url="nammeshub.com.ng/curriculum">
                <div style={{ position: 'absolute', left: 330, top: 168, width: 620, height: 70, borderRadius: 18, border: `6px solid ${C.orange}`, opacity: ring, transform: `scale(${0.7 + 0.3 * ring})` }} />
              </BrowserFrame>
            </Pop>
          </div>
        }
      />
    </Beat>
  )
}

/* ---------------------------------------------------------------- timetable */

const TimetableSkeleton: React.FC = () => (
  <div style={{ position: 'absolute', left: 0, top: 304, width: 1280, height: 340, background: '#fcf9f8' }}>
    {['Mon', 'Tue', 'Wed'].map((d, i) => (
      <Pop key={d} from="up" dist={30} delay={78 + i * 7}>
        <div style={{ position: 'absolute', left: 64, top: 8 + i * 98, width: 1152, height: 84, borderRadius: 14, background: C.white, border: '1px solid #d8d2d0', display: 'flex', alignItems: 'center', gap: 22, padding: '0 24px', fontFamily: FONT_BODY }}>
          <div style={{ width: 70, fontWeight: 800, fontSize: 20, color: C.green900 }}>{d}</div>
          <div style={{ width: 200, height: 40, borderRadius: 10, background: '#d9f7e3' }} />
          <div style={{ width: 260, height: 40, borderRadius: 10, background: '#e7e2e0' }} />
          <div style={{ width: 160, height: 40, borderRadius: 10, background: '#ffe6d6' }} />
        </div>
      </Pop>
    ))}
  </div>
)

const Timetable: React.FC = () => {
  const frame = useCurrentFrame()
  const vh = 640
  const a1 = interpolate(frame, [52, 60], [1, 0], clampOpts)
  const a2 = interpolate(frame, [52, 60], [0, 1], clampOpts)
  const p1 = at(174, 508)
  const p2 = at(537, 253)
  const ring = useSpr(92)
  return (
    <Beat tone="dark">
      <Split
        frameH={CHROME + vh * SC}
        side={
          <>
            <Pop from="right" dist={120} delay={10}><Pill bg={C.orange} size={40}>Class timetable</Pill></Pop>
            <Pop from="right" dist={120} delay={90}><Pill bg={C.gold} color={C.green950} size={40}>Exam timetable</Pill></Pop>
          </>
        }
        frame={
          <>
            <div style={{ position: 'absolute', left: 0, top: 0, opacity: a1 }}>
              <BrowserFrame width={BW} src="screens/timetable.jpg" viewH={vh} url="nammeshub.com.ng/timetable" />
            </div>
            <div style={{ position: 'absolute', left: 0, top: 0, opacity: a2 }}>
              <BrowserFrame width={BW} src="screens/timetable-level.jpg" viewH={vh} url="nammeshub.com.ng/timetable/100">
                <TimetableSkeleton />
                <div style={{ position: 'absolute', left: 345, top: 230, width: 262, height: 48, borderRadius: 30, border: `5px solid ${C.orange}`, opacity: ring, transform: `scale(${0.8 + 0.2 * ring})` }} />
              </BrowserFrame>
            </div>
            <Cursor keys={[{ f: 8, x: 700 * SC, y: CHROME + 380 * SC }, { f: 38, ...p1 }, { f: 56, ...p1 }, { f: 88, ...p2 }, { f: 140, ...p2 }]} taps={[42, 94]} />
          </>
        }
      />
    </Beat>
  )
}

/* ---------------------------------------------------------------- CGPA */

// Illustrative grades on the site's 5.0 scale (A=5 ... F=0).
const GRADES: [string, number, string][] = [
  ['CHM-CM 101', 2, 'A'],
  ['GET 101', 1, 'B'],
  ['GET 103', 2, 'A'],
  ['MTH 101', 2, 'B'],
  ['PHY-CM 101', 2, 'A'],
  ['PHY-CM 103', 2, 'C'],
]
const PTS: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 }
const ROW_AT = (i: number) => 20 + i * 20
const RUNNING = (() => {
  let u = 0
  let p = 0
  return GRADES.map(([, units, g]) => {
    u += units
    p += units * PTS[g]
    return { u, cgpa: p / u }
  })
})()

const CgpaPage: React.FC = () => {
  const frame = useCurrentFrame()
  const frames = [0, ...GRADES.map((_, i) => ROW_AT(i) + 12)]
  const cg = interpolate(frame, frames, [0, ...RUNNING.map((r) => r.cgpa)], { ...clampOpts })
  const units = interpolate(frame, frames, [0, ...RUNNING.map((r) => r.u)], clampOpts)
  const btn = useSpr(150)
  const pdf = useSpr(182)
  const pressed = frame >= 172 && frame < 178
  return (
    <div style={{ position: 'absolute', inset: 0, width: 1280, height: 830, background: '#fcf9f8', fontFamily: FONT_BODY, color: C.ink }}>
      <div style={{ height: 72, background: C.white, borderBottom: '1px solid #ddd', display: 'flex', alignItems: 'center', padding: '0 30px', gap: 14 }}>
        <Logo size={34} small />
        <div style={{ fontWeight: 800, fontSize: 21 }}>NAMMES Hub</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 34, fontWeight: 600, fontSize: 15, color: '#444' }}>
          <span>About</span><span style={{ color: C.ink }}>Academics</span><span>Community</span><span>Forms</span><span>Contact</span>
        </div>
      </div>
      <div style={{ padding: '36px 64px 0' }}>
        <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: 1.2, color: '#ae3200' }}>CGPA CALCULATOR</div>
        <div style={{ fontWeight: 800, fontSize: 34, marginTop: 6 }}>100 Level · First Semester</div>
        <div style={{ display: 'flex', gap: 34, marginTop: 26 }}>
          <div style={{ width: 720, background: C.white, border: '1px solid #d8d2d0', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ display: 'flex', background: '#f5f1f0', height: 48, alignItems: 'center', fontWeight: 800, fontSize: 12.5, letterSpacing: 1, color: '#333' }}>
              <div style={{ width: 260, paddingLeft: 20 }}>CODE</div><div style={{ width: 180 }}>UNITS</div><div style={{ flex: 1 }}>GRADE</div>
            </div>
            {GRADES.map(([code, u, g], i) => {
              const s = Math.min(1, Math.max(0, (frame - ROW_AT(i)) / 10))
              return (
                <div key={code} style={{ height: 62, borderTop: '1px solid #ddd', display: 'flex', alignItems: 'center', fontSize: 19, opacity: s, transform: `translateX(${(1 - s) * 40}px)` }}>
                  <div style={{ width: 260, paddingLeft: 20, fontWeight: 800 }}>{code}</div>
                  <div style={{ width: 180 }}>{u}</div>
                  <div style={{ flex: 1 }}>
                    <span style={{ display: 'inline-grid', placeItems: 'center', width: 44, height: 44, borderRadius: 10, fontWeight: 800, fontSize: 22, background: g === 'A' ? '#d9f7e3' : g === 'B' ? '#e6f0ea' : '#fff0e6', color: g === 'C' ? '#ae3200' : C.green800 }}>{g}</span>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ background: C.green900, borderRadius: 20, padding: '28px 30px', color: C.white }}>
              <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: 1.2, color: '#9fc4ad' }}>CUMULATIVE GPA</div>
              <div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 104, color: C.gold, lineHeight: 1.1, marginTop: 6 }}>{cg.toFixed(2)}</div>
              <div style={{ fontFamily: 'monospace', fontSize: 17, color: 'rgba(255,255,255,0.8)' }}>{Math.round(units)} units completed</div>
            </div>
            <div style={{ marginTop: 26, display: 'inline-flex', alignItems: 'center', gap: 10, background: C.orange, color: C.white, fontWeight: 800, fontSize: 19, padding: '15px 28px', borderRadius: 12, transform: `scale(${btn * (pressed ? 0.94 : 1)})`, boxShadow: pressed ? 'none' : '0 6px 14px rgba(255,90,31,0.4)' }}>
              ⭳ Download report
            </div>
            <div style={{ marginTop: 22, background: C.white, border: '1px solid #d8d2d0', borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, fontWeight: 700, fontSize: 18, transform: `translateY(${(1 - pdf) * 40}px)`, opacity: pdf }}>
              <div style={{ background: '#e2460f', color: C.white, fontWeight: 800, fontSize: 14, padding: '8px 10px', borderRadius: 8 }}>PDF</div>
              CGPA report
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const Cgpa: React.FC = () => {
  const vh = 830
  const p = at(1040, 660)
  return (
    <Beat tone="paper">
      <Split
        frameH={CHROME + vh * SC}
        side={
          <>
            <Pop from="right" dist={120} delay={14}><Pill bg={C.green800} size={40}>Grades in</Pill></Pop>
            <Pop from="right" dist={120} delay={70}><Pill bg={C.orange} size={40}>CGPA counts up</Pill></Pop>
            <Pop from="right" dist={120} delay={150}><Pill bg={C.gold} color={C.green950} size={40}>Download report</Pill></Pop>
            <Pop from="right" dist={120} delay={180}>
              <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 30, color: '#555', maxWidth: 600 }}>Sign in and your grades are saved to your account.</div>
            </Pop>
          </>
        }
        frame={
          <>
            <Pop from="up" dist={140}>
              <BrowserFrame width={BW} viewH={vh} url="nammeshub.com.ng/cgpa">
                <CgpaPage />
              </BrowserFrame>
            </Pop>
            <Cursor keys={[{ f: 120, x: 700 * SC, y: CHROME + 700 * SC }, { f: 168, ...p }, { f: 240, ...p }]} taps={[174]} />
          </>
        }
      />
    </Beat>
  )
}

/* ---------------------------------------------------------------- resources */

const Resources: React.FC = () => {
  const vh = 469
  const p = at(1095, 392)
  const pop = useSpr(86)
  return (
    <Beat tone="dark">
      <Split
        frameH={CHROME + vh * SC}
        side={
          <>
            <Pop from="right" dist={120} delay={10}><Pill bg={C.orange} size={40}>Shared Drive links</Pill></Pop>
            <Pop from="right" dist={120} delay={24}><Pill bg={C.white} color={C.ink} size={40}>Level by level</Pill></Pop>
          </>
        }
        frame={
          <>
            <Pop from="up" dist={140}>
              <BrowserFrame width={BW} src="screens/resources-list.jpg" viewH={vh} url="nammeshub.com.ng/resources/100/1" />
            </Pop>
            <Cursor keys={[{ f: 20, x: 500 * SC, y: CHROME + 150 * SC }, { f: 62, ...p }, { f: 150, ...p }]} taps={[68]} />
            <div style={{ position: 'absolute', left: BW * 0.62, top: CHROME + 380 * SC + 60, transform: `scale(${pop})`, transformOrigin: '0 0' }}>
              <Pill bg={C.gold} color={C.green950} size={32}>Opens the shared folder</Pill>
            </div>
          </>
        }
      />
    </Beat>
  )
}

export const Academics: React.FC = () => (
  <AbsoluteFill>
    <Beats scene="academics" beats={{ outlines: <Outlines />, detail: <Detail />, curriculum: <Curriculum />, timetable: <Timetable />, cgpa: <Cgpa />, resources: <Resources /> }} />
  </AbsoluteFill>
)
