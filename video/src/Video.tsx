import React from 'react'
import { AbsoluteFill, Sequence } from 'remotion'
import { BEATS, type Beat, type SceneName } from './beats'
import { FontGate } from './fonts'
import { C } from './theme'
import { ColdOpen } from './scenes/ColdOpen'
import { LogoBeat } from './scenes/LogoBeat'
import { MeetBeat } from './scenes/MeetBeat'
import { AcademicsBeat } from './scenes/AcademicsBeat'
import { EventsBeat } from './scenes/EventsBeat'
import { OpportunitiesBeat } from './scenes/OpportunitiesBeat'
import { CommunityBeat } from './scenes/CommunityBeat'
import { DashboardBeat } from './scenes/DashboardBeat'
import { BuiltBeat } from './scenes/BuiltBeat'
import { EndCard } from './scenes/EndCard'
import { AudioLayer } from './audio/AudioLayer'

const Scene: React.FC<{ beat: Beat }> = ({ beat }) => {
  const scene = (name: SceneName) => {
    switch (name) {
      case 'cold-chat':
        return <ColdOpen beat={beat} mode="chat" />
      case 'cold-stamp':
        return <ColdOpen beat={beat} mode="stamp" />
      case 'logo':
        return <LogoBeat beat={beat} />
      case 'meet':
        return <MeetBeat beat={beat} />
      case 'cgpa-in':
      case 'cgpa-out':
      case 'academics-montage':
        return <AcademicsBeat beat={beat} />
      case 'events':
        return <EventsBeat beat={beat} />
      case 'opportunities':
        return <OpportunitiesBeat beat={beat} />
      case 'community-montage':
        return <CommunityBeat beat={beat} />
      case 'dashboard':
        return <DashboardBeat beat={beat} />
      case 'built':
        return <BuiltBeat beat={beat} />
      case 'endcard':
        return <EndCard beat={beat} />
    }
  }
  return <AbsoluteFill>{scene(beat.scene)}</AbsoluteFill>
}

export const Video: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: C.dark }}>
    <FontGate>
      {BEATS.map((beat) => (
        <Sequence key={beat.id} from={beat.from} durationInFrames={beat.durationInFrames} name={beat.id}>
          <Scene beat={beat} />
        </Sequence>
      ))}
      <AudioLayer />
    </FontGate>
  </AbsoluteFill>
)
