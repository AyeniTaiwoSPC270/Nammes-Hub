import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { quizSound, EFFECT_GROUPS } from '../../../lib/quizSound'
import { THEME_MUSIC, MUSIC_NOTES } from '../../../../api/_lib/quizTheme.js'
import Button from '../../ui/Button'

// The sound lab: every music loop and every sound effect the live quiz can make, so an admin can hear them before
// choosing one. The loops are generated in the browser rather than played from a file, which means the only honest
// way to choose between them is to listen. What plays here is exactly what plays in the game, because it is the same
// engine either way.

// Long enough to hear a bar, a chord change and a drum pattern rather than a fragment.
const PREVIEW_MS = 12000

export default function SoundLab({ music, effects, onPickMusic, onPickEffects }) {
  const prefs = useSyncExternalStore(quizSound.subscribe, quizSound.getSnapshot)
  const supported = quizSound.isSupported()
  // Which loop is playing right now, so exactly one card shows Stop and the rest show Play.
  const [playing, setPlaying] = useState(null)
  const stopTimer = useRef(null)

  const stop = useCallback(() => {
    if (stopTimer.current) {
      clearTimeout(stopTimer.current)
      stopTimer.current = null
    }
    quizSound.stopMusic()
    setPlaying(null)
  }, [])

  // Leaving the lab must not leave a loop playing with no button left on screen to stop it.
  useEffect(() => () => {
    if (stopTimer.current) clearTimeout(stopTimer.current)
    quizSound.stopMusic()
  }, [])

  function hearMusic(key) {
    if (playing === key) {
      stop()
      return
    }
    // The click is the gesture browsers want before any sound at all.
    if (!quizSound.unlock()) return
    quizSound.previewMusic(key)
    setPlaying(key)
    if (stopTimer.current) clearTimeout(stopTimer.current)
    stopTimer.current = setTimeout(stop, PREVIEW_MS)
  }

  function hearEffect(name) {
    if (!quizSound.unlock()) return
    quizSound.play(name)
  }

  const styles = Object.entries(THEME_MUSIC)

  return (
    <div className="flex flex-col gap-6">
      {!supported && (
        <p role="status" className="rounded-2xl border border-hairline bg-surface p-4 text-sm font-semibold text-ink-900">
          This browser cannot play sound, so there is nothing to hear on this tab. The game still works exactly the same, silently.
        </p>
      )}
      {supported && !prefs.unlocked && (
        <p role="status" className="rounded-2xl border border-orange-500/40 bg-orange-500/10 p-4 text-sm font-semibold text-ink-900">
          Browsers keep sound switched off until you click something. Press any Play below and it starts.
        </p>
      )}
      {prefs.muted && (
        <p role="status" className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm font-semibold text-ink-900">
          Sound is muted on this computer, so nothing will play. Unmute it at the bottom of this page.
        </p>
      )}

      <section className="rounded-2xl border border-hairline bg-surface p-5 shadow-md">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-ink-900">Background music</h2>
            <p className="text-sm text-ink-muted">
              Plays in the lobby and during questions, quieter during questions so the host can be heard. Stopped for
              the reveal, the leaderboard and the end. Only one loop plays at a time.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={stop} disabled={!playing}>
            Stop the music
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {styles.map(([key, label]) => {
            const chosen = music === key
            const on = playing === key
            const silent = key === 'off'
            return (
              <div
                key={key}
                className={[
                  'flex flex-col rounded-xl border p-4',
                  chosen ? 'border-orange-500 bg-orange-500/10 ring-2 ring-orange-500/40' : 'border-hairline bg-surface-low',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-ink-900">{label}</h3>
                  {chosen && (
                    <span className="shrink-0 rounded-full bg-orange-500 px-2.5 py-1 text-xs font-bold text-white">
                      In use
                    </span>
                  )}
                </div>
                <p className="mt-1 flex-1 text-sm text-ink-muted">
                  {silent ? 'Silence. Sound effects still play if they are switched on below.' : MUSIC_NOTES[key]}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!silent && (
                    <Button variant={on ? 'accent' : 'secondary'} size="sm" onClick={() => hearMusic(key)}>
                      <span className="material-symbols-outlined" aria-hidden="true">{on ? 'stop' : 'play_arrow'}</span>
                      {on ? 'Stop' : 'Play'}
                    </Button>
                  )}
                  <Button variant={chosen ? 'ghost' : 'primary'} size="sm" onClick={() => onPickMusic(key)} disabled={chosen}>
                    {chosen ? 'Chosen' : 'Use this'}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-hairline bg-surface p-5 shadow-md">
        <h2 className="text-lg font-bold text-ink-900">Sound effects</h2>
        <p className="text-sm text-ink-muted">
          The short sounds the game plays by itself: countdown ticks, a drum roll that the right answer lands on, a
          cheer, and the board settling. Stop the music first if you want to hear one on its own.
        </p>

        <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm font-semibold text-ink-900">
          <input type="checkbox" className="h-5 w-5" checked={effects} onChange={(e) => onPickEffects(e.target.checked)} />
          Play sound effects during the game
        </label>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {EFFECT_GROUPS.map(({ group, items }) => (
            <div key={group} className="rounded-xl border border-hairline bg-surface-low p-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink-muted">{group}</h3>
              <ul className="mt-2 flex flex-col gap-1.5">
                {items.map(([name, itemLabel]) => (
                  <li key={name}>
                    <button
                      type="button"
                      onClick={() => hearEffect(name)}
                      className="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-left text-sm font-semibold text-ink-900 hover:bg-surface"
                    >
                      <span className="material-symbols-outlined" aria-hidden="true">play_arrow</span>
                      {itemLabel}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-hairline bg-surface p-5 shadow-md">
        <h2 className="text-lg font-bold text-ink-900">Listening level</h2>
        <p className="text-sm text-ink-muted">
          This is the same mute and volume the projector screen uses on this computer, so it is remembered between
          them: turn it down here to audition quietly, and it will still be down when you host. Players on their own
          phones choose their own sound and are not affected either way.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => quizSound.setMuted(!prefs.muted)}>
            <span className="material-symbols-outlined" aria-hidden="true">{prefs.muted ? 'volume_off' : 'volume_up'}</span>
            {prefs.muted ? 'Unmute' : 'Mute'}
          </Button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={prefs.volume}
            onChange={(e) => quizSound.setVolume(Number(e.target.value))}
            className="w-40 accent-orange-500"
            aria-label="Volume"
          />
          <span className="text-sm font-semibold text-ink-muted tabular-nums">{Math.round(prefs.volume * 100)}%</span>
        </div>
      </section>
    </div>
  )
}
