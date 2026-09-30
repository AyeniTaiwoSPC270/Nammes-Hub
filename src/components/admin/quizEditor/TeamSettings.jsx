import { TEAM_PRESETS, TEAM_STYLES, MAX_TEAMS, blankTeam } from '../../../data/quizTeams'
import Button from '../../ui/Button'

const inputClass = 'min-h-11 min-w-0 rounded-md border border-hairline bg-surface px-3 py-2 text-base text-ink'

// Team mode settings for a quiz: switch, how teams are scored, and the list of teams (presets or your own).
export default function TeamSettings({ settings, onChange }) {
  const { teamMode, teamScoring, teams } = settings
  const set = (patch) => onChange({ ...settings, ...patch })

  function updateTeam(index, patch) {
    set({ teams: teams.map((t, i) => (i === index ? { ...t, ...patch } : t)) })
  }

  return (
    <fieldset className="rounded-lg border border-hairline bg-surface p-4">
      <legend className="px-1 text-sm font-bold text-ink-900">Team mode</legend>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5"
          checked={teamMode}
          onChange={(e) => set({ teamMode: e.target.checked, teams: e.target.checked && teams.length === 0 ? TEAM_PRESETS.levels.teams : teams })}
        />
        <span>
          <span className="block font-semibold text-ink-900">Play in teams</span>
          <span className="block text-sm text-ink-muted">Players pick a team when they join (or get put on the smallest one). Class against class, hostel against hostel.</span>
        </span>
      </label>

      {teamMode && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {Object.entries(TEAM_PRESETS).map(([key, preset]) => (
              <Button key={key} variant="secondary" size="sm" onClick={() => set({ teams: preset.teams.map((t) => ({ ...t })) })}>
                Use: {preset.label}
              </Button>
            ))}
          </div>

          <ul className="flex flex-col gap-2">
            {teams.map((team, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <span className={`h-9 w-9 shrink-0 rounded-md ${TEAM_STYLES[team.color]?.bg ?? 'bg-slate-600'}`} aria-hidden="true" />
                <input
                  value={team.name}
                  maxLength={24}
                  onChange={(e) => updateTeam(i, { name: e.target.value })}
                  placeholder={`Team ${i + 1} name`}
                  aria-label={`Team ${i + 1} name`}
                  className={`${inputClass} min-w-[8rem] flex-1`}
                />
                <select value={team.color} onChange={(e) => updateTeam(i, { color: e.target.value })} aria-label={`Team ${i + 1} colour`} className={inputClass}>
                  {Object.entries(TEAM_STYLES).map(([key, style]) => <option key={key} value={key}>{style.label}</option>)}
                </select>
                <Button variant="ghost" size="sm" onClick={() => set({ teams: teams.filter((_, j) => j !== i) })} aria-label={`Remove team ${i + 1}`}>Remove</Button>
              </li>
            ))}
          </ul>
          <div>
            <Button variant="secondary" size="sm" disabled={teams.length >= MAX_TEAMS} onClick={() => set({ teams: [...teams, blankTeam(teams.length)] })}>
              Add a team
            </Button>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-[.05em] text-brand-orange">Team score</span>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-900">
              <input type="radio" name="team-scoring" checked={teamScoring === 'average'} onChange={() => set({ teamScoring: 'average' })} />
              Average of its players (fair when teams are different sizes)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-900">
              <input type="radio" name="team-scoring" checked={teamScoring === 'total'} onChange={() => set({ teamScoring: 'total' })} />
              Total of its players (bigger teams have an edge)
            </label>
          </div>
        </div>
      )}
    </fieldset>
  )
}
