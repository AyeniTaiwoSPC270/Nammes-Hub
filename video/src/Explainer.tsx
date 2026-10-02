import React from 'react'
import { AbsoluteFill, Sequence } from 'remotion'
import { C } from './brand'
import { SCENE_ORDER, SCENE_START, SceneId, sceneFrames } from './constants'
import { LayoutProvider } from './layout'
import { Captions } from './components/Captions'
import { AudioLayer } from './components/AudioLayer'
import { ColdOpen } from './scenes/ColdOpen'
import { MeetHub } from './scenes/MeetHub'
import { Academics } from './scenes/Academics'
import { Community } from './scenes/Community'
import { LiveQuiz } from './scenes/LiveQuiz'
import { Behind } from './scenes/Behind'
import { Close } from './scenes/Close'

const SCENES: Record<SceneId, React.FC> = {
  cold: ColdOpen,
  meet: MeetHub,
  academics: Academics,
  community: Community,
  quiz: LiveQuiz,
  behind: Behind,
  close: Close,
}

// One component, two shapes: the canvas size decides the layout (see layout.tsx).
export const Explainer: React.FC = () => (
  <LayoutProvider>
    <AbsoluteFill style={{ background: C.green950 }}>
      {SCENE_ORDER.map((id) => {
        const Scene = SCENES[id]
        return (
          <Sequence key={id} from={SCENE_START[id]} durationInFrames={sceneFrames(id)} name={id}>
            <Scene />
          </Sequence>
        )
      })}
      <Captions />
      <AudioLayer />
    </AbsoluteFill>
  </LayoutProvider>
)
