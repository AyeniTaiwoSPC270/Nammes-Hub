// Timing lives here. Every number below is in SECONDS. Change a beat and everything (scene length, captions,
// captions.srt, voiceover-script.md, total video length) follows. Run `npm run docs` to refresh the two text files.

export const FPS = 30
export const WIDTH_169 = 1920
export const HEIGHT_169 = 1080
export const WIDTH_916 = 1080
export const HEIGHT_916 = 1920

// 9:16 safe zone (px). Nothing important goes inside these bands.
export const SAFE_TOP_916 = 150
export const SAFE_BOTTOM_916 = 250

// A beat is one idea on screen. A scene is a list of beats.
export const BEAT_SECONDS = {
  cold: { chat: 2.2, photo: 2, deadline: 2, stamp: 3, logo: 3 },
  meet: { home: 5, map: 5, account: 5 },
  academics: { outlines: 7, detail: 6, curriculum: 4, timetable: 5, cgpa: 8, resources: 5 },
  community: { events: 4.5, news: 3, opportunities: 4, awards: 9, forms: 5 },
  quiz: { lobby: 7.5, question: 5.5, reveal: 5, powers: 5, duel: 4, bracket: 4, champion: 3.5, share: 5.5 },
  behind: { dashboard: 3.5, news: 2.5, form: 3, season: 3, host: 3 },
  close: { excos: 5.5, built: 3.5, endcard: 6.5 },
} as const

export type SceneId = keyof typeof BEAT_SECONDS

export const SCENE_ORDER: SceneId[] = ['cold', 'meet', 'academics', 'community', 'quiz', 'behind', 'close']

export const SCENE_TITLES: Record<SceneId, string> = {
  cold: 'Cold open',
  meet: 'Meet the Hub',
  academics: 'Academics',
  community: 'Community',
  quiz: 'Live quiz showpiece',
  behind: 'Behind the scenes',
  close: 'Meet the excos and close',
}

export const sec = (s: number) => Math.round(s * FPS)

export function beatFrames<S extends SceneId>(scene: S): Record<keyof (typeof BEAT_SECONDS)[S], number> {
  const out = {} as Record<string, number>
  for (const [k, v] of Object.entries(BEAT_SECONDS[scene])) out[k] = sec(v as number)
  return out as Record<keyof (typeof BEAT_SECONDS)[S], number>
}

// Start frame of each beat inside its scene.
export function beatStarts<S extends SceneId>(scene: S): Record<keyof (typeof BEAT_SECONDS)[S], number> {
  const out = {} as Record<string, number>
  let t = 0
  for (const [k, v] of Object.entries(BEAT_SECONDS[scene])) {
    out[k] = t
    t += sec(v as number)
  }
  return out as Record<keyof (typeof BEAT_SECONDS)[S], number>
}

export function sceneFrames(scene: SceneId): number {
  return Object.values(BEAT_SECONDS[scene]).reduce((a, s) => a + sec(s as number), 0)
}

export const SCENE_START: Record<SceneId, number> = (() => {
  const out = {} as Record<SceneId, number>
  let t = 0
  for (const id of SCENE_ORDER) {
    out[id] = t
    t += sceneFrames(id)
  }
  return out
})()

export const TOTAL_FRAMES = SCENE_ORDER.reduce((a, id) => a + sceneFrames(id), 0)

// Optional audio files. Drop them into public/ and they are picked up automatically; if a file is missing the
// video renders silently with no errors.
export const AUDIO = {
  music: 'music.mp3',
  voiceover: 'voiceover.mp3',
  musicVolume: 0.22, // music level when nobody is speaking
  musicDuckedVolume: 0.08, // music level under narration
}
