import { useCallback, useEffect, useState } from 'react'
import { quizAudio } from './quizAudioStore'

// What this browser has imported, read once on the way in. The counts are worked out from the same walk rather than
// asked for separately, and an unreachable store is reported rather than thrown, because the quiz works perfectly well
// without any clips at all.
export function useAudioLibrary() {
  const [clips, setClips] = useState([])
  const [state, setState] = useState('loading')
  const [usage, setUsage] = useState({ clips: 0, bytes: 0 })

  const refresh = useCallback(() => quizAudio.list().then((listed) => {
    if (!listed.ok) {
      setState('unavailable')
      return
    }
    setClips(listed.clips)
    setUsage({ clips: listed.clips.length, bytes: listed.clips.reduce((sum, c) => sum + (c.size ?? 0), 0) })
    setState('ok')
  }), [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { clips, state, usage, refresh }
}