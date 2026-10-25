/**
 * The single source of truth for the cut. Every scene reads its start, length,
 * copy, pills and internal cut points from here; nothing downstream may
 * hard-code a timecode.
 *
 * Frames assume 30 fps and both compositions share this one timeline.
 */

export type Tone = 'orange' | 'green' | 'yellow'

export type SceneName =
  | 'cold-chat'
  | 'cold-stamp'
  | 'logo'
  | 'meet'
  | 'cgpa-in'
  | 'cgpa-out'
  | 'academics-montage'
  | 'events'
  | 'opportunities'
  | 'community-montage'
  | 'dashboard'
  | 'built'
  | 'endcard'

export interface PillSpec {
  label: string
  tone: Tone
  /** Local frame inside the beat's own sequence. */
  at: number
}

export interface Beat {
  id: string
  from: number
  durationInFrames: number
  scene: SceneName
  line1: string
  line2?: string
  /** Substring painted yellow; must appear in line1 or line2. */
  highlight?: string
  pills: readonly PillSpec[]
  /** Local frames where the shot changes inside the beat. Audio hits these. */
  cuts?: readonly number[]
  background: 'dark' | 'cream'
}

export const FPS = 30
export const TOTAL_FRAMES = 1800

export const BEATS: readonly Beat[] = [
  {
    id: 'cold-chat',
    from: 0,
    durationInFrames: 60,
    scene: 'cold-chat',
    line1: 'Who has the outline?',
    highlight: 'outline?',
    pills: [],
    background: 'cream',
  },
  {
    id: 'cold-stamp',
    from: 60,
    durationInFrames: 48,
    scene: 'cold-stamp',
    line1: 'Stop asking. Start here.',
    highlight: 'Stop asking.',
    pills: [],
    background: 'dark',
  },
  {
    id: 'logo',
    from: 108,
    durationInFrames: 132,
    scene: 'logo',
    line1: 'NAMMES Hub',
    line2: 'Everything. One address.',
    highlight: 'Everything. One address.',
    pills: [],
    background: 'dark',
  },
  {
    id: 'meet',
    from: 240,
    durationInFrames: 150,
    scene: 'meet',
    line1: 'Built for NAMMES, UNILAG.',
    highlight: 'NAMMES, UNILAG.',
    pills: [{ label: 'Meet the Hub', tone: 'orange', at: 6 }],
    background: 'dark',
  },
  {
    id: 'cgpa-in',
    from: 390,
    durationInFrames: 90,
    scene: 'cgpa-in',
    line1: 'Grades in. CGPA out.',
    highlight: 'Grades in.',
    pills: [
      { label: '100 Level', tone: 'green', at: 14 },
      { label: 'First Semester', tone: 'orange', at: 20 },
    ],
    background: 'cream',
  },
  {
    id: 'cgpa-out',
    from: 480,
    durationInFrames: 90,
    scene: 'cgpa-out',
    line1: 'Report ready.',
    highlight: 'Report ready.',
    pills: [
      { label: 'CGPA counts up', tone: 'yellow', at: 6 },
      { label: 'Download report', tone: 'orange', at: 12 },
    ],
    background: 'cream',
  },
  {
    id: 'academics-montage',
    from: 570,
    durationInFrames: 180,
    scene: 'academics-montage',
    line1: 'Outlines. Timetables. Resources.',
    highlight: 'Resources.',
    pills: [
      { label: 'Outlines', tone: 'green', at: 0 },
      { label: 'Timetables', tone: 'orange', at: 0 },
      { label: 'Resources', tone: 'yellow', at: 0 },
    ],
    cuts: [0, 66, 126],
    background: 'cream',
  },
  {
    id: 'events',
    from: 750,
    durationInFrames: 180,
    scene: 'events',
    line1: 'Relive every event.',
    highlight: 'Relive every event.',
    pills: [
      { label: 'Events', tone: 'orange', at: 8 },
      { label: 'Photo gallery', tone: 'yellow', at: 16 },
    ],
    cuts: [0, 108],
    background: 'dark',
  },
  {
    id: 'opportunities',
    from: 930,
    durationInFrames: 180,
    scene: 'opportunities',
    line1: 'Every deadline, sorted.',
    highlight: 'Every deadline,',
    pills: [
      { label: 'Opportunities', tone: 'orange', at: 4 },
      { label: 'Soonest first', tone: 'yellow', at: 22 },
    ],
    background: 'dark',
  },
  {
    id: 'community-montage',
    from: 1110,
    durationInFrames: 180,
    scene: 'community-montage',
    line1: 'News. Forms. Awards. One feed.',
    highlight: 'Awards.',
    pills: [
      { label: 'News', tone: 'green', at: 0 },
      { label: 'Forms', tone: 'orange', at: 0 },
      { label: 'Awards', tone: 'yellow', at: 0 },
    ],
    cuts: [0, 62, 124],
    background: 'cream',
  },
  {
    id: 'dashboard',
    from: 1290,
    durationInFrames: 170,
    scene: 'dashboard',
    line1: 'Run by the excos.',
    highlight: 'Run by the excos.',
    pills: [{ label: 'The excos run it all', tone: 'orange', at: 6 }],
    background: 'dark',
  },
  {
    id: 'built',
    from: 1460,
    durationInFrames: 130,
    scene: 'built',
    line1: 'Built for the chapter.',
    highlight: 'Built for the chapter.',
    pills: [],
    background: 'dark',
  },
  {
    id: 'endcard',
    from: 1590,
    durationInFrames: 210,
    scene: 'endcard',
    line1: 'nammeshub.com.ng',
    line2: 'Grab the Handbook in the footer.',
    highlight: 'Grab the Handbook in the footer.',
    pills: [],
    background: 'dark',
  },
]

export const SCENE_NAMES: readonly SceneName[] = [
  'cold-chat',
  'cold-stamp',
  'logo',
  'meet',
  'cgpa-in',
  'cgpa-out',
  'academics-montage',
  'events',
  'opportunities',
  'community-montage',
  'dashboard',
  'built',
  'endcard',
]

export const beatById = (id: string) => BEATS.find((beat) => beat.id === id)

/** Every cut in the film, in absolute frames: beat starts plus internal cuts. */
export const HITS: readonly number[] = BEATS.flatMap((beat) => [
  beat.from,
  ...(beat.cuts ?? []).filter((cut) => cut > 0).map((cut) => beat.from + cut),
])
