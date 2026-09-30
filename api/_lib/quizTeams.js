import { hasBlockedWord } from './quizText.js'

// Team mode rules: what a team list may look like, who joins which team, and how teams are scored and ranked.
// Pure, so every rule can be tested without a database.

export const TEAM_COLORS = ['red', 'blue', 'green', 'amber', 'purple', 'teal', 'pink', 'slate']
export const TEAM_NAME_MAX = 24
export const MIN_TEAMS = 2
export const MAX_TEAMS = 8
export const TEAM_SCORING = ['average', 'total']

// Ready-made team lists the admin can pick from. Every mascot is one of the 50 characters.
export const TEAM_PRESETS = {
  levels: {
    label: 'Levels (100L to 500L)',
    teams: ['100L', '200L', '300L', '400L', '500L'].map((name, i) => ({ name, color: TEAM_COLORS[i], avatarId: [3, 7, 14, 22, 41][i] })),
  },
  colours: {
    label: 'Colours',
    teams: [
      { name: 'Red', color: 'red', avatarId: 0 },
      { name: 'Blue', color: 'blue', avatarId: 10 },
      { name: 'Green', color: 'green', avatarId: 16 },
      { name: 'Gold', color: 'amber', avatarId: 15 },
    ],
  },
}

export function cleanTeamName(raw) {
  if (typeof raw !== 'string') return null
  // eslint-disable-next-line no-control-regex
  const name = raw.replace(/\s+/g, ' ').replace(/[\u0000-\u001f\u007f]/g, '').trim()
  if (name.length < 1 || name.length > TEAM_NAME_MAX) return null
  return hasBlockedWord(name) ? null : name
}

// Checks a list of teams typed by an admin. Returns { ok: true, teams } with clean, numbered teams, or { ok: false, error }.
export function cleanTeams(input) {
  if (!Array.isArray(input) || input.length < MIN_TEAMS || input.length > MAX_TEAMS) {
    return { ok: false, error: `Teams need ${MIN_TEAMS} to ${MAX_TEAMS} entries` }
  }
  const seen = new Set()
  const teams = []
  for (const [position, t] of input.entries()) {
    const name = cleanTeamName(t?.name)
    if (!name) return { ok: false, error: `Team ${position + 1} needs a name of 1 to ${TEAM_NAME_MAX} plain characters` }
    if (seen.has(name.toLowerCase())) return { ok: false, error: `Two teams are called "${name}"` }
    seen.add(name.toLowerCase())
    const color = TEAM_COLORS.includes(t?.color) ? t.color : TEAM_COLORS[position]
    const avatarId = Number.isInteger(t?.avatarId) && t.avatarId >= 0 && t.avatarId < 50 ? t.avatarId : 0
    teams.push({ name, color, avatarId, position })
  }
  return { ok: true, teams }
}

// "Put me anywhere": the team with the fewest players right now (the first one on a tie).
export function pickAutoTeam(teams, players) {
  const count = new Map(teams.map((t) => [t.id, 0]))
  for (const p of players) if (count.has(p.team_id)) count.set(p.team_id, count.get(p.team_id) + 1)
  return [...teams].sort((a, b) => count.get(a.id) - count.get(b.id) || a.position - b.position)[0] ?? null
}

// Teams with at least one player, best first. "average" stops a big class winning on numbers alone.
export function rankTeams({ teams, players, scoring = 'average' }) {
  const rows = teams
    .map((t) => {
      const members = players.filter((p) => p.team_id === t.id)
      const sum = members.reduce((total, p) => total + p.total_score, 0)
      return {
        id: t.id,
        name: t.name,
        color: t.color,
        avatarId: t.avatar_id ?? t.avatarId ?? 0,
        position: t.position,
        members: members.length,
        score: members.length === 0 ? 0 : scoring === 'total' ? sum : Math.round(sum / members.length),
      }
    })
    .filter((t) => t.members > 0)
    .sort((a, b) => b.score - a.score || a.position - b.position)
  let lastScore = null
  let lastRank = 0
  return rows.map((t, i) => {
    const rank = t.score === lastScore ? lastRank : i + 1
    lastScore = t.score
    lastRank = rank
    return { ...t, rank }
  })
}
