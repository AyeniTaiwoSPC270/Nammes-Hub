import { TEAM_COLORS, MIN_TEAMS, MAX_TEAMS, cleanTeams } from '../../api/_lib/quizTeams.js'

export { TEAM_COLORS, MIN_TEAMS, MAX_TEAMS, TEAM_PRESETS, cleanTeams, rankTeams } from '../../api/_lib/quizTeams.js'

// Tailwind needs to see every class name written out in full, so each team colour lists its own.
export const TEAM_STYLES = {
  red: { label: 'Red', bg: 'bg-red-600', soft: 'bg-red-600/15', text: 'text-red-600', border: 'border-red-600' },
  blue: { label: 'Blue', bg: 'bg-blue-600', soft: 'bg-blue-600/15', text: 'text-blue-600', border: 'border-blue-600' },
  green: { label: 'Green', bg: 'bg-green-600', soft: 'bg-green-600/15', text: 'text-green-600', border: 'border-green-600' },
  amber: { label: 'Gold', bg: 'bg-amber-600', soft: 'bg-amber-600/15', text: 'text-amber-600', border: 'border-amber-600' },
  purple: { label: 'Purple', bg: 'bg-purple-600', soft: 'bg-purple-600/15', text: 'text-purple-600', border: 'border-purple-600' },
  teal: { label: 'Teal', bg: 'bg-teal-600', soft: 'bg-teal-600/15', text: 'text-teal-600', border: 'border-teal-600' },
  pink: { label: 'Pink', bg: 'bg-pink-600', soft: 'bg-pink-600/15', text: 'text-pink-600', border: 'border-pink-600' },
  slate: { label: 'Slate', bg: 'bg-slate-600', soft: 'bg-slate-600/15', text: 'text-slate-600', border: 'border-slate-600' },
}

export function teamStyle(color) {
  return TEAM_STYLES[color] ?? TEAM_STYLES.slate
}

export function blankTeam(position = 0) {
  return { name: '', color: TEAM_COLORS[position % TEAM_COLORS.length], avatarId: (position * 7 + 3) % 50 }
}

// The editor's team settings, checked. Returns a message or null.
export function validateTeamSettings({ teamMode, teams }) {
  if (!teamMode) return null
  const checked = cleanTeams(teams)
  return checked.ok ? null : checked.error
}

export const DEFAULT_TEAM_SETTINGS = { teamMode: false, teamScoring: 'average', teams: [] }
export { MIN_TEAMS as MIN_TEAM_COUNT, MAX_TEAMS as MAX_TEAM_COUNT }
