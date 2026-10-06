import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { quizSound, EFFECT_GROUPS } from '../../../lib/quizSound'
import { quizAudio } from '../../../lib/quizAudioStore'
import { useAudioLibrary } from '../../../lib/useAudioLibrary'
import { THEME_MUSIC, MUSIC_NOTES } from '../../../../api/_lib/quizTheme.js'
import AudioLibrary from './AudioLibrary'
import Button from '../../ui/Button'
import Toggle from '../../ui/Toggle'

// The sound lab: every music loop and every sound effect the live quiz can make, so an admin can hear them before
// choosing one. The loops are generated in the browser rather than played from a file, which means the only honest
// way to choose between them is to listen. What plays here is exactly what plays in the game, because it is the same
// engine either way.

// Long enough to hear a bar, a chord change and a drum pattern rather than a fragment.
const PREVIEW_MS = 12000

export default function SoundLab({ sound, onChange, onToggleEffect }) {
  const prefs = useSyncExternalStore(quizSound.subscribe, quizSound.getSnapshot)
  const supported = quizSound.isSupported()
  const library = useAudioLibrary()
  const { clips } = library
  // Which loop is playing right now, so exactly one card shows Stop and the rest show Play.
  const [playing, setPlaying] = useState(null)
  const stopTimer = useRef(null)
  const switchedOff = sound.off ?? []
  const custom = sound.custom ?? { music: null, effects: {} }
  // A theme names clips by id. Looking one up here is how the lab can say plainly that a quiz points at a clip this
  // browser has not got, instead of quietly showing a clip that is not there.
  const clipsById = useMemo(() => new Map(clips.map((c) => [c.id, c])), [clips])
  const musicClips = useMemo(() => clips.filter((c) => c.kind === 'music'), [clips])
  const effectClips = useMemo(() => clips.filter((c) => c.kind === 'effect'), [clips])
  // The engine plays an imported effect only once it has been decoded, and in the studio nothing else decodes it.
  // The library is part of the key so deleting or importing a clip updates what Play will do.
  const customKey = `${JSON.stringify(custom.effects)}|${clips.map((c) => c.id).join(',')}`
  useEffect(() => {
    quizSound.loadCustomEffects(custom.effects, quizAudio.get)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customKey])

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
    quizSound.clearCustomEffects()
    quizSound.releaseCustomMusic()
  }, [])

  function setCustomEffect(name, id) {
    const effects = { ...custom.effects }
    if (id) effects[name] = id
    else delete effects[name]
    onChange({ ...sound, custom: { ...custom, effects } })
  }

  function hearMusic(key) {
    if (playing === key) {
      stop()
      return
    }
    // The click is the gesture browsers want before any sound at all.
    if (!quizSound.unlock()) return
    // An imported track is streamed from the browser's own copy of it, which has to be found before it can be started.
    const address = key === 'custom' ? quizAudio.url(custom.music ?? null) : Promise.resolve(null)
    address.then((made) => {
      if (!made) return
      quizSound.previewMusic(key, { address: made })
      setPlaying(key)
      if (stopTimer.current) clearTimeout(stopTimer.current)
      stopTimer.current = setTimeout(stop, PREVIEW_MS)
    })
  }

  function hearEffect(name) {
    if (!quizSound.unlock()) return
    // Auditioning ignores this quiz's own switches, so pressing Play on an effect that is switched off still makes a
    // noise: it is the only way to hear what you have just turned off.
    quizSound.previewEffect(name)
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
            const chosen = sound.music === key
            const on = playing === key
            const silent = key === 'off'
            const mine = key === 'custom'
            const track = mine ? clipsById.get(custom.music) : null
            const missing = mine && Boolean(custom.music) && !track
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
                {mine && (
                  <div className="mt-3">
                    {missing && (
                      <p className="mb-2 rounded-xl border border-orange-500/40 bg-orange-500/10 p-2 text-xs font-bold text-ink-900">
                        Not on this device, so this quiz plays no music here. Import it again on the computer you will
                        host from.
                      </p>
                    )}
                    {musicClips.length === 0 ? (
                      <p className="text-xs text-ink-muted">Import a track below to use one.</p>
                    ) : (
                      <select
                        aria-label="Choose which imported track to play"
                        value={clipsById.has(custom.music) ? custom.music : ''}
                        onChange={(e) => onChange({ ...sound, music: 'custom', custom: { ...custom, music: e.target.value || null } })}
                        className="w-full rounded-lg border border-hairline bg-surface px-2 py-1.5 text-sm font-semibold text-ink-900"
                      >
                        <option value="">Choose a track…</option>
                        {musicClips.map((clip) => (
                          <option key={clip.id} value={clip.id}>{clip.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {!silent && (
                    <Button variant={on ? 'accent' : 'secondary'} size="sm" onClick={() => hearMusic(key)} disabled={mine && !track}>
                      <span className="material-symbols-outlined" aria-hidden="true">{on ? 'stop' : 'play_arrow'}</span>
                      {on ? 'Stop' : 'Play'}
                    </Button>
                  )}
                  {!mine && (
                    <Button variant={chosen ? 'ghost' : 'primary'} size="sm" onClick={() => onChange({ ...sound, music: key })} disabled={chosen}>
                      {chosen ? 'Chosen' : 'Use this'}
                    </Button>
                  )}
                  {mine && (
                    <Button
                      variant={chosen ? 'ghost' : 'primary'}
                      size="sm"
                      onClick={() => onChange({ ...sound, music: 'custom' })}
                      // Choosing a track in the list above already puts the quiz on it, so this only has a job to do when
                      // a track is remembered from before and another style was chosen since.
                      disabled={chosen || !custom.music}
                    >
                      {chosen ? 'Chosen' : 'Use this'}
                    </Button>
                  )}
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
        <p className="mt-2 text-sm text-ink-muted">
          Each one has its own switch. Anything you switch off stays silent in the game, on the projector and on players'
          phones alike. Play still makes a sound for a switched-off effect, so you can always hear what you turned off.
        </p>

        <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm font-semibold text-ink-900">
          <input type="checkbox" className="h-5 w-5" checked={sound.effects} onChange={(e) => onChange({ ...sound, effects: e.target.checked })} />
          Play sound effects during the game
        </label>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {EFFECT_GROUPS.map(({ group, items }) => (
            <div key={group} className="rounded-xl border border-hairline bg-surface-low p-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink-muted">{group}</h3>
              <ul className="mt-2 flex flex-col gap-1.5">
{items.map(([name, itemLabel]) => {
                  const offThis = switchedOff.includes(name)
                  const chosen = custom.effects[name]
                  const mine = chosen ? clipsById.get(chosen) : null
                  const missing = Boolean(chosen) && !mine
                  return (
                    <li key={name} className="rounded-lg px-1 py-0.5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => hearEffect(name)}
                          className={[
                            'flex min-h-10 flex-1 cursor-pointer items-center gap-2 rounded-lg px-2 text-left text-sm font-semibold hover:bg-surface',
                            offThis ? 'text-ink-muted' : 'text-ink-900',
                          ].join(' ')}
                        >
                          <span className="material-symbols-outlined" aria-hidden="true">play_arrow</span>
                          {itemLabel}
                          {offThis && <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">Off</span>}
                        </button>
                        <Toggle
                          checked={!offThis}
                          onChange={() => onToggleEffect(name)}
                          hideLabel
                          label={`Play ${itemLabel.toLowerCase()} during the game`}
                        />
                      </div>
                      {effectClips.length > 0 && (
                        <div className="mt-1 pr-1">
                          <select
                            aria-label={`Which sound plays for ${itemLabel.toLowerCase()}`}
                            value={chosen && (mine || missing) ? chosen : ''}
                            onChange={(e) => setCustomEffect(name, e.target.value || null)}
                            className="w-full rounded-lg border border-hairline bg-surface px-2 py-1 text-xs font-semibold text-ink-900"
                          >
                            <option value="">Built-in sound</option>
                            {effectClips.map((clip) => (
                              <option key={clip.id} value={clip.id}>{clip.name}</option>
                            ))}
                            {missing && <option value={chosen}>Not on this device</option>}
                          </select>
                          {missing && (
                            <p className="mt-1 text-xs font-bold text-ink-muted">
                              Not on this device, so the built-in sound plays here.
                            </p>
                          )}
                          {name === 'drumroll' && mine && (
                            <p className="mt-1 text-xs text-ink-muted">
                              The answer appears when this clip stops, so trim it to end on the hit.
                            </p>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <AudioLibrary {...library} />

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
