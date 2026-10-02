import React from 'react'
import { Audio, Sequence, staticFile } from 'remotion'
import { AUDIO, BEAT_SECONDS, SCENE_ORDER, SCENE_START, beatFrames, beatStarts } from '../constants'
import { CAPTIONS } from '../captions'
import { HAS_AUDIO, SFX_FILES, VO_CLIPS } from '../assetManifest'
import { SCENE_WHOOSH_VOL, SFX_CUES } from '../sfx'

// Audio is optional. src/assetManifest.ts (generated from what is actually in public/) says which files exist, so a
// missing file is never requested and the video renders silently with no errors.

// One generated narration clip per beat (public/vo/), played at the start of its beat.
const VO_CUES = SCENE_ORDER.flatMap((scene) => {
  const starts = beatStarts(scene) as Record<string, number>
  const lens = beatFrames(scene) as Record<string, number>
  return Object.keys(BEAT_SECONDS[scene]).map((beat) => ({ id: `${scene}-${beat}`, from: SCENE_START[scene] + starts[beat] + 3, len: lens[beat] }))
})

// Sound effects: the cues in src/sfx.ts, placed on the global timeline, plus a whoosh at each scene start.
const SFX_PLAY = [
  ...SFX_CUES.map((q) => {
    const start = (beatStarts(q.scene) as Record<string, number>)[q.beat]
    return { name: q.name, from: SCENE_START[q.scene] + start + q.at, vol: q.vol ?? 0.7 }
  }),
  ...SCENE_ORDER.map((id) => ({ name: 'whoosh', from: SCENE_START[id], vol: SCENE_WHOOSH_VOL })),
].filter((q) => SFX_FILES.includes(q.name))

export const AudioLayer: React.FC = () => {
  // Duck the music whenever a caption (i.e. narration) is on screen.
  const musicVolume = (frame: number) => {
    const speaking = CAPTIONS.some((c) => frame >= c.start - 6 && frame < c.end + 6)
    return speaking ? AUDIO.musicDuckedVolume : AUDIO.musicVolume
  }

  return (
    <>
      {HAS_AUDIO.music && <Audio src={staticFile(AUDIO.music)} volume={musicVolume} loop />}
      {HAS_AUDIO.voiceover && <Audio src={staticFile(AUDIO.voiceover)} volume={1} />}
      {!HAS_AUDIO.voiceover &&
        VO_CUES.filter((c) => VO_CLIPS.includes(c.id)).map((c) => (
          <Sequence key={c.id} from={c.from} durationInFrames={c.len + 20}>
            <Audio src={staticFile(`vo/${c.id}.wav`)} volume={1} />
          </Sequence>
        ))}
      {SFX_PLAY.map((q, i) => (
        <Sequence key={`${q.name}-${q.from}-${i}`} from={q.from} durationInFrames={150}>
          <Audio src={staticFile(`sfx/${q.name}.mp3`)} volume={q.vol} />
        </Sequence>
      ))}
    </>
  )
}
