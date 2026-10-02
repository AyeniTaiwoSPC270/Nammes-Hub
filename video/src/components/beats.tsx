import React from 'react'
import { Sequence } from 'remotion'
import { BEAT_SECONDS, SceneId, sec } from '../constants'

// Lays a scene's beats end to end, using the durations in constants.ts.
export function Beats<S extends SceneId>({ scene, beats }: { scene: S; beats: Record<keyof (typeof BEAT_SECONDS)[S], React.ReactNode> }) {
  let from = 0
  return (
    <>
      {Object.entries(BEAT_SECONDS[scene]).map(([name, seconds]) => {
        const dur = sec(seconds as number)
        const node = (beats as Record<string, React.ReactNode>)[name]
        const el = (
          <Sequence key={name} from={from} durationInFrames={dur} name={`${scene}/${name}`}>
            {node}
          </Sequence>
        )
        from += dur
        return el
      })}
    </>
  )
}
