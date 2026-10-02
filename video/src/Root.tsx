import React from 'react'
import { Composition } from 'remotion'
import { Explainer } from './Explainer'
import { FPS, HEIGHT_169, HEIGHT_916, TOTAL_FRAMES, WIDTH_169, WIDTH_916 } from './constants'

export const Root: React.FC = () => (
  <>
    <Composition id="Explainer169" component={Explainer} durationInFrames={TOTAL_FRAMES} fps={FPS} width={WIDTH_169} height={HEIGHT_169} />
    <Composition id="Explainer916" component={Explainer} durationInFrames={TOTAL_FRAMES} fps={FPS} width={WIDTH_916} height={HEIGHT_916} />
  </>
)
