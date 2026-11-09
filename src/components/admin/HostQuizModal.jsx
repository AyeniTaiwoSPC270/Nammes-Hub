import { useEffect, useRef, useState } from 'react'
import { useBodyScrollLock } from '../../lib/useBodyScrollLock'
import { validateMaxPlayers, DEFAULT_MAX_PLAYERS, MIN_PLAYERS_LIMIT, MAX_PLAYERS_LIMIT } from '../../data/quiz'
import Button from '../ui/Button'
import FormField from '../ui/FormField'

// Asked each time a quiz is hosted: how many players this game allows, whether it starts now or at a set time, and
// whether anyone on /play can walk into it. Starts from the quiz's own default.
export default function HostQuizModal({ quiz, busy, onHost, onClose }) {
  const dialogRef = useRef(null)
  useBodyScrollLock()
  const [maxPlayers, setMaxPlayers] = useState(String(quiz.max_players ?? DEFAULT_MAX_PLAYERS))
  const problem = validateMaxPlayers(maxPlayers)
  const hasTeams = (quiz.team_presets ?? []).length >= 2
  const [teamMode, setTeamMode] = useState(Boolean(quiz.team_mode) && hasTeams)
  // 'now' or 'schedule'. A scheduled quiz is always open: a game nobody can find and no tick may start is not a
  // schedule, it is a row.
  const [when, setWhen] = useState('now')
  const [scheduledAt, setScheduledAt] = useState('')
  const [openQuiz, setOpenQuiz] = useState(false)

  const scheduleProblem = when === 'schedule' && (!scheduledAt || !(new Date(scheduledAt).getTime() > Date.now()))
    ? 'Pick a time in the future.'
    : null
  const open = when === 'schedule' || openQuiz

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleSubmit(event) {
    event.preventDefault()
    if (problem || scheduleProblem) return
    onHost(Number(maxPlayers), {
      ...(hasTeams ? { teamMode } : {}),
      ...(open ? { openJoin: true, autopilot: true } : {}),
      ...(when === 'schedule' ? { scheduledAt: new Date(scheduledAt).toISOString() } : {}),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4" onClick={onClose}>
      <form
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Host game"
        tabIndex={-1}
        onSubmit={handleSubmit}
        className="relative flex w-full max-w-sm flex-col gap-4 rounded-lg bg-surface p-6 shadow-md outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="pr-10 text-lg font-bold text-ink-900">Host &ldquo;{quiz.title}&rdquo;</h2>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-bold text-ink-900">When it starts</legend>
          <div className="flex gap-2">
            {[
              { value: 'now', label: 'Start now' },
              { value: 'schedule', label: 'Schedule' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={when === option.value}
                onClick={() => setWhen(option.value)}
                className={[
                  'min-h-11 flex-1 rounded-lg border px-3 text-sm font-semibold',
                  when === option.value ? 'border-orange-500 bg-orange-500/10 text-ink-900' : 'border-hairline bg-surface text-ink-muted',
                ].join(' ')}
              >
                {option.label}
              </button>
            ))}
          </div>
          {when === 'schedule' && (
            <FormField
              label="Start time"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              error={scheduledAt !== '' && scheduleProblem ? scheduleProblem : undefined}
              helper="The room opens then and the game begins a minute after the first player arrives. You can leave; it runs by itself."
            />
          )}
        </fieldset>

        <FormField
          label="Max players"
          type="number"
          value={maxPlayers}
          onChange={(e) => setMaxPlayers(e.target.value)}
          error={maxPlayers !== '' && problem ? problem : undefined}
          helper={`From ${MIN_PLAYERS_LIMIT} to ${MAX_PLAYERS_LIMIT}. When the lobby fills up, the game starts by itself after 10 seconds. You can press Start sooner.`}
        />

        {when === 'now' ? (
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" className="mt-1 h-5 w-5" checked={openQuiz} onChange={(e) => setOpenQuiz(e.target.checked)} />
            <span>
              <span className="block font-semibold text-ink-900">Open to everyone</span>
              <span className="block text-sm text-ink-muted">Listed on /play, and it starts when the room is ready without anyone at the host screen.</span>
            </span>
          </label>
        ) : (
          <p className="rounded-lg bg-orange-500/10 px-3 py-2 text-sm text-ink-900">
            This quiz will be listed on /play. Nobody has to be at the host screen for it to run.
          </p>
        )}

        {hasTeams && (
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" className="mt-1 h-5 w-5" checked={teamMode} onChange={(e) => setTeamMode(e.target.checked)} />
            <span>
              <span className="block font-semibold text-ink-900">Play in teams</span>
              <span className="block text-sm text-ink-muted">{quiz.team_presets.map((t) => t.name).join(', ')}</span>
            </span>
          </label>
        )}
        <Button type="submit" variant="accent" className="w-full justify-center" loading={busy} disabled={Boolean(problem || scheduleProblem)}>
          {when === 'schedule' ? 'Schedule quiz' : 'Open lobby'}
        </Button>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-danger text-white shadow-md"
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </form>
    </div>
  )
}
