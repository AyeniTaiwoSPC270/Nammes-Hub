import React from 'react'
import { Audio, Sequence, staticFile, useVideoConfig } from 'remotion'
import { BEATS, beatById } from '../beats'

/**
 * Every cut the picture makes, in absolute frames. Taken from the beat sheet so
 * a re-time cannot leave a whoosh on the old mark.
 */
const BEAT_STARTS = BEATS.slice(1).map((beat) => beat.from)
const EVENTS_LIGHTBOX = (beatById('events')?.from ?? 0) + (beatById('events')?.cuts?.[1] ?? 0)
const WHOOSH = [...BEAT_STARTS, EVENTS_LIGHTBOX].sort((a, b) => a - b)

/**
 * The stamps follow the slams, not the cut: the two cold-open labels land on
 * the beat's own frames 0 and 8, and the crest lands six frames into the logo.
 */
const COLD_STAMP = beatById('cold-stamp')?.from ?? 0
const LOGO = beatById('logo')?.from ?? 0
const STAMP = [COLD_STAMP, COLD_STAMP + 8, LOGO + 6]

/** Pills land together at the top of a montage, so they are split by a few frames. */
const POPS = BEATS.flatMap((beat) =>
  beat.pills.map((pill, index) => beat.from + pill.at + index * 3),
)

/** A pointer click on the gallery tile, where the picture cuts to the lightbox. */
const CLICKS = [EVENTS_LIGHTBOX - 30]

const DUCK = [...WHOOSH, ...STAMP]

/** 3 dB of ducking over 250ms either side of a hit, applied to the bed only. */
const musicVolume = (frame: number) => {
  let gain = 1
  for (const hit of DUCK) {
    const distance = Math.abs(frame - hit)
    if (distance < 7.5) gain = Math.min(gain, 1 - 0.292 * (1 - distance / 7.5))
  }
  return gain
}

export const AudioLayer: React.FC = () => {
  const { fps } = useVideoConfig()

  return (
    <>
      <Audio src={staticFile('audio/music-60s-master.wav')} volume={musicVolume} />

      {WHOOSH.map((frame) => (
        <Sequence key={`whoosh-${frame}`} from={frame} durationInFrames={fps} name={`whoosh-${frame}`}>
          <Audio src={staticFile('audio/sfx/whoosh.wav')} volume={0.32} />
        </Sequence>
      ))}

      {STAMP.map((frame) => (
        <Sequence key={`stamp-${frame}`} from={frame} durationInFrames={fps} name={`stamp-${frame}`}>
          <Audio src={staticFile('audio/sfx/stamp.mp3')} volume={0.55} />
        </Sequence>
      ))}

      {POPS.map((frame, index) => (
        <Sequence key={`pop-${frame}-${index}`} from={frame} durationInFrames={fps} name={`pop-${frame}-${index}`}>
          <Audio src={staticFile('audio/sfx/pop.wav')} volume={0.22} />
        </Sequence>
      ))}

      {CLICKS.map((frame, index) => (
        <Sequence key={`click-${frame}-${index}`} from={frame} durationInFrames={fps} name={`click-${frame}-${index}`}>
          <Audio src={staticFile('audio/sfx/pop.wav')} volume={0.34} />
        </Sequence>
      ))}
    </>
  )
}
