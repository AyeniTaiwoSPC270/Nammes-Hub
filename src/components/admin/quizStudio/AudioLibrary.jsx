import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { quizAudio, limitSummary, formatSeconds, formatBytes, REFUSALS, LIMITS } from '../../../lib/quizAudioStore'
import { quizSound } from '../../../lib/quizSound'
import Button from '../../ui/Button'

// The clips an admin has imported on this computer: import them, hear them, and throw them away again. Nothing here is
// uploaded anywhere, so every word on this panel is about the one device it is stored on.
const ACCEPT = 'audio/mpeg,audio/ogg,audio/wav,audio/mp4,audio/x-m4a'

export default function AudioLibrary({ clips, state, usage, refresh }) {
  const [busy, setBusy] = useState(false)
  const [refused, setRefused] = useState('')
  const [playing, setPlaying] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const fileInputs = useRef({})
  const limits = limitSummary()

  // A clip is heard through a plain audio element rather than the quiz's own buses, so auditioning one cannot disturb
  // a loop the admin is comparing it against, and it stops by itself at the end.
  const element = useRef(null)
  const stop = useCallback(() => {
    element.current?.pause()
    element.current = null
    setPlaying(null)
  }, [])

  useEffect(() => () => {
    stop()
  }, [stop])

  async function importFiles(kind, fileList) {
    setBusy(true)
    setRefused('')
    try {
      for (const file of Array.from(fileList ?? [])) {
        // Sequential on purpose: the limits are counted across the library, so importing a folder's worth of files has to
        // see each one land before the next is judged.
        // eslint-disable-next-line no-await-in-loop
        const result = await quizAudio.save(file, kind)
        if (!result.ok) {
          setRefused(`${file.name}: ${REFUSALS[result.reason] ?? 'That file could not be imported.'}`)
          break
        }
      }
    } catch {
      setRefused('That file could not be imported.')
    } finally {
      setBusy(false)
      await refresh()
    }
  }

  async function preview(clip) {
    const address = await quizAudio.url(clip.id)
    if (!address) return
    if (playing === clip.id) {
      stop()
      return
    }
    stop()
    const audio = new Audio(address)
    const level = quizSound.getSnapshot()
    audio.volume = level.muted ? 0 : level.volume
    audio.onended = () => setPlaying(null)
    audio.play().catch(() => setPlaying(null))
    element.current = audio
    setPlaying(clip.id)
  }

  async function remove(id) {
    if (playing === id) stop()
    await quizAudio.remove(id)
    if (confirming === id) setConfirming(null)
    await refresh()
  }

  const groups = [
    { kind: 'music', title: 'Music', empty: 'No music imported.' },
    { kind: 'effect', title: 'Sound effects', empty: 'No sound effects imported.' },
  ]
  const hasClips = state === 'ok' && usage.clips > 0

  return (
    <section className="rounded-2xl border border-hairline bg-surface p-5 shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink-900">Your own audio</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Import a background track or your own sound effects and use them in this quiz. Only import audio you have
            the right to play.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={refresh} disabled={state === 'loading'}>
          <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
          Look again
        </Button>
      </div>

      {state === 'unavailable' && (
        <p role="status" className="mt-4 rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm font-semibold text-ink-900">
          This browser will not let this page keep audio, so clips cannot be imported here. That is normal in a private
          window, and it will not affect the quiz: every sound falls back to the ones Nammes Hub makes for you.
        </p>
      )}

      {state !== 'unavailable' && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {groups.map(({ kind, title }) => (
              <Fragment key={kind}>
                <input
                  ref={(el) => { fileInputs.current[kind] = el }}
                  type="file"
                  accept={ACCEPT}
                  aria-label={`Import ${title.toLowerCase()}`}
                  className="sr-only"
                  onChange={(e) => {
                    const files = e.target.files
                    e.target.value = ''
                    importFiles(kind, files)
                  }}
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => fileInputs.current[kind]?.click()}
                  disabled={busy || state === 'loading'}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">upload</span>
                  Import {title.toLowerCase()}
                </Button>
              </Fragment>
            ))}
            {busy && <span role="status" className="text-sm font-semibold text-ink-muted">Checking the file…</span>}
          </div>
          <p className="mt-2 text-sm text-ink-muted">
            {limits.music} · {limits.effect} · {limits.library}. MP3, OGG, WAV and M4A.
          </p>

          {refused && (
            <p role="alert" className="mt-3 rounded-2xl border border-danger/40 bg-danger/10 p-3 text-sm font-semibold text-ink-900">
              {refused}
            </p>
          )}

          {hasClips && (
            <p className="mt-3 text-sm font-semibold text-ink-muted">
              {usage.clips} {usage.clips === 1 ? 'clip' : 'clips'} on this computer, {formatBytes(usage.bytes)} of {formatBytes(LIMITS.totalBytes)}.
            </p>
          )}

          <div className="mt-4 flex flex-col gap-4">
            {groups.map(({ kind, title, empty }) => {
              const mine = clips.filter((c) => c.kind === kind)
              return (
                <div key={kind}>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-ink-muted">{title}</h3>
                  {mine.length === 0 ? (
                    <p className="mt-1 text-sm text-ink-muted">{empty}</p>
                  ) : (
                    <ul className="mt-2 flex flex-col gap-2">
                      {mine.map((clip) => (
                        <li key={clip.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-surface-low px-3 py-2">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-ink-900">{clip.name}</span>
                            <span className="block text-xs text-ink-muted">
                              {formatSeconds(clip.seconds)} · {formatBytes(clip.size)} · {clip.type.replace('audio/', '')}
                            </span>
                          </span>
                          <Button variant="secondary" size="sm" onClick={() => preview(clip)}>
                            <span className="material-symbols-outlined" aria-hidden="true">{playing === clip.id ? 'stop' : 'play_arrow'}</span>
                            {playing === clip.id ? 'Stop' : 'Play'}
                          </Button>
                          {confirming === clip.id ? (
                            <>
                              <Button variant="destructive" size="sm" onClick={() => remove(clip.id)}>Delete it</Button>
                              <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>Keep it</Button>
                            </>
                          ) : (
                            <Button variant="ghost" size="sm" onClick={() => setConfirming(clip.id)}>
                              <span className="material-symbols-outlined" aria-hidden="true">delete</span>
                              Delete
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      <p role="note" className="mt-5 rounded-2xl border border-orange-500/40 bg-orange-500/10 p-4 text-sm font-semibold text-ink-900">
        These clips stay in this browser. Nothing is uploaded and no other device gets them, so a quiz that uses one
        plays the built-in sounds anywhere else. Clearing this browser's site data deletes them.
      </p>
      {state !== 'unavailable' && (
        <p className="mt-2 text-xs text-ink-muted">
          A browser can still throw stored files away when a device runs out of space. The app asks the browser to keep
          them, which most of the time is enough.
        </p>
      )}
    </section>
  )
}