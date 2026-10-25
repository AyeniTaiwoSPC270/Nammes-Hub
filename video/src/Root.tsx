import React from 'react'
import { Composition } from 'remotion'
import { FPS, TOTAL_FRAMES } from './beats'
import { Video } from './Video'

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="NammesHubLaunch60-16x9"
      component={Video}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{ ratio: '16x9' as const }}
    />
    <Composition
      id="NammesHubLaunch60-9x16"
      component={Video}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={{ ratio: '9x16' as const }}
    />
  </>
)
