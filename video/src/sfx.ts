import { SceneId } from './constants'

// Sound-effect cues. Each cue plays `name` (public/sfx/<name>.mp3, made by `npm run sfx`) `at` frames after the start of
// the beat `scene/beat`. Add, move or delete lines freely; cues whose file is missing are skipped.
// `vol` is 0..1 (default 0.7). Frames are at 30 fps.
export type Cue = { name: string; scene: SceneId; beat: string; at: number; vol?: number }

const c = (name: string, scene: SceneId, beat: string, ats: number[], vol?: number): Cue[] => ats.map((at) => ({ name, scene, beat, at, vol }))

export const SFX_CUES: Cue[] = [
  // cold open
  ...c('ping', 'cold', 'chat', [6, 18, 30, 42, 54], 0.5),
  ...c('swish', 'cold', 'photo', [4], 0.5),
  ...c('error', 'cold', 'deadline', [10], 0.6),
  ...c('stamp', 'cold', 'stamp', [8, 30]),
  ...c('impact', 'cold', 'logo', [0], 0.9),
  // meet the hub
  ...c('whoosh', 'meet', 'home', [40], 0.5),
  ...c('pop', 'meet', 'map', [14, 24, 34, 42], 0.5),
  ...c('chime', 'meet', 'account', [24], 0.5),
  // academics
  ...c('click', 'academics', 'outlines', [44, 100], 0.6),
  ...c('pop', 'academics', 'outlines', [130, 142], 0.5),
  ...c('pop', 'academics', 'detail', [12, 64, 104], 0.5),
  ...c('swish', 'academics', 'detail', [48], 0.4),
  ...c('click', 'academics', 'timetable', [42, 94], 0.6),
  ...c('tick', 'academics', 'cgpa', [20, 40, 60, 80, 100, 120], 0.45),
  ...c('click', 'academics', 'cgpa', [174], 0.6),
  ...c('chime', 'academics', 'cgpa', [182], 0.5),
  ...c('click', 'academics', 'resources', [68], 0.6),
  // community
  ...c('click', 'community', 'events', [30, 70], 0.6),
  ...c('shutter', 'community', 'events', [76], 0.5),
  ...c('pop', 'community', 'news', [14, 22, 30], 0.5),
  ...c('pop', 'community', 'opportunities', [10, 18, 26], 0.5),
  ...c('ding', 'community', 'awards', [22, 44, 66, 88, 110], 0.5),
  ...c('swish', 'community', 'awards', [112], 0.5),
  ...c('click', 'community', 'awards', [128, 146, 172], 0.6),
  ...c('chime', 'community', 'awards', [176], 0.55),
  ...c('fanfare', 'community', 'awards', [196], 0.8),
  ...c('click', 'community', 'forms', [14, 52], 0.6),
  ...c('scan', 'community', 'forms', [98], 0.5),
  ...c('chime', 'community', 'forms', [130], 0.5),
  // live quiz
  ...c('pop', 'quiz', 'lobby', [24, 44, 62, 116, 134, 152, 168, 184], 0.6),
  ...c('click', 'quiz', 'lobby', [36, 92, 112], 0.5),
  ...c('tick', 'quiz', 'question', [17, 34, 51, 68, 85, 102, 119, 136, 153], 0.4),
  ...c('click', 'quiz', 'question', [90], 0.6),
  ...c('ding', 'quiz', 'question', [92], 0.5),
  ...c('rise', 'quiz', 'reveal', [6], 0.6),
  ...c('ding', 'quiz', 'reveal', [34], 0.6),
  ...c('whoosh', 'quiz', 'reveal', [62], 0.5),
  ...c('swish', 'quiz', 'reveal', [80], 0.5),
  ...c('pop', 'quiz', 'powers', [4, 14, 24, 34, 44], 0.55),
  ...c('impact', 'quiz', 'duel', [8], 0.8),
  ...c('swish', 'quiz', 'bracket', [34, 66, 94], 0.5),
  ...c('fanfare', 'quiz', 'champion', [6], 0.85),
  ...c('pop', 'quiz', 'champion', [26], 0.6),
  ...c('swish', 'quiz', 'share', [14], 0.6),
  ...c('ping', 'quiz', 'share', [60], 0.5),
  ...c('stamp', 'quiz', 'share', [44, 64]),
  // behind the scenes
  ...c('pop', 'behind', 'dashboard', [6, 12, 18, 24, 30], 0.4),
  ...c('type', 'behind', 'news', [8], 0.5),
  ...c('click', 'behind', 'news', [50], 0.6),
  ...c('chime', 'behind', 'news', [56], 0.5),
  ...c('pop', 'behind', 'form', [8, 26, 44, 66], 0.55),
  ...c('ding', 'behind', 'season', [0, 16, 32, 48, 64], 0.5),
  ...c('pop', 'behind', 'host', [6, 18, 30, 42], 0.45),
  ...c('chime', 'behind', 'host', [62], 0.55),
  // close
  ...c('whoosh', 'close', 'excos', [0], 0.5),
  ...c('impact', 'close', 'built', [8], 0.6),
  ...c('impact', 'close', 'endcard', [0], 0.7),
  ...c('pop', 'close', 'endcard', [34, 40, 46], 0.5),
]

// A whoosh at the start of every scene, on top of the beat cues.
export const SCENE_WHOOSH_VOL = 0.55
