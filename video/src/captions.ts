import { BEAT_SECONDS, SCENE_ORDER, SCENE_START, SceneId, FPS, sec } from './constants'
import { VO } from './script'

export type Caption = { start: number; end: number; text: string; scene: SceneId; beat: string }

const MAX_WORDS = 7

// Cut a beat's line into short caption chunks: sentence by sentence, and never more than MAX_WORDS words each so a
// chunk fits on two lines at caption size.
function chunk(text: string): string[] {
  const sentences = text.match(/[^.?!:]+[.?!:]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text]
  const out: string[] = []
  for (const s of sentences) {
    const words = s.split(/\s+/)
    if (words.length <= MAX_WORDS) {
      out.push(s)
      continue
    }
    const parts = Math.ceil(words.length / MAX_WORDS)
    const size = Math.ceil(words.length / parts)
    for (let i = 0; i < words.length; i += size) out.push(words.slice(i, i + size).join(' '))
  }
  return out
}

export function buildCaptions(): Caption[] {
  const caps: Caption[] = []
  for (const scene of SCENE_ORDER) {
    let beatStart = SCENE_START[scene]
    for (const [beat, seconds] of Object.entries(BEAT_SECONDS[scene])) {
      const frames = sec(seconds as number)
      const text = (VO[scene] as Record<string, string>)[beat]
      const parts = chunk(text)
      const weights = parts.map((p) => p.length + 6)
      const total = weights.reduce((a, b) => a + b, 0)
      // Leave a short breath at the end of the beat, and a short lead-in at the start.
      const usable = Math.max(1, frames - Math.round(FPS * 0.15))
      const lead = Math.round(FPS * 0.1)
      let t = beatStart + lead
      parts.forEach((p, i) => {
        const len = Math.round(((usable - lead) * weights[i]) / total)
        caps.push({ start: t, end: t + Math.max(len, 1), text: p, scene, beat })
        t += len
      })
      beatStart += frames
    }
  }
  return caps
}

export const CAPTIONS = buildCaptions()

export function captionAt(frame: number): Caption | undefined {
  return CAPTIONS.find((c) => frame >= c.start && frame < c.end)
}
