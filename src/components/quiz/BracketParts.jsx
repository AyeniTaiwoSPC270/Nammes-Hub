import { Avatar } from './QuizParts'
import { formatScore } from '../../data/quiz'
import { winnerId, podium, bracketRounds, BRACKET_LENGTHS } from '../../../api/_lib/quizBracketMath.js'

// Pieces of the knockout bracket (battle mode, phase C): the host's bracket board and podium for the projector, and a
// small card for each player's phone. The rules live in api/_lib/quizBracketMath.js.

// One match: two rows, the winner highlighted once the round is settled.
function MatchCard({ match }) {
  const settled = Boolean(match.settled_at)
  const side = (key) => {
    const name = key === 'a' ? match.name_a : match.name_b
    const avatar = key === 'a' ? match.avatar_a : match.avatar_b
    const score = key === 'a' ? match.score_a : match.score_b
    const isBot = key === 'b' && match.bot_b
    const won = settled && match.winner === key
    const lost = settled && match.winner && match.winner !== key
    return (
      <div className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${won ? 'bg-green-600/15 font-bold' : ''} ${lost ? 'opacity-50' : ''}`}>
        <Avatar name={name ?? '?'} avatarId={avatar ?? 0} mood="static" className="h-8 w-8" />
        <span className="min-w-0 flex-1 truncate text-lg">
          {name ?? 'Left the game'}
          {isBot && <span className="ml-2 rounded bg-orange-500/20 px-1.5 py-0.5 text-xs font-bold uppercase text-orange-500">bot</span>}
        </span>
        {settled && <span className="text-lg font-bold tabular-nums">{formatScore(score ?? 0)}</span>}
        {won && <span className="material-symbols-outlined text-green-600" aria-label="Through">check_circle</span>}
      </div>
    )
  }
  return (
    <li className="flex flex-col gap-1 rounded-2xl border border-hairline bg-surface p-2 shadow-sm">
      {side('a')}
      {side('b')}
    </li>
  )
}

const MAX_CARDS = 12

// The matches of one round as a grid of cards, with a line for each round so far.
export function BracketBoard({ matches, round, rounds, length }) {
  const inRound = matches.filter((m) => m.round === round).sort((a, b) => a.slot - b.slot)
  const rounds0 = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b)
  const label = (r) => (rounds && r === rounds - 1 ? 'Final' : rounds && r === rounds - 2 ? 'Semi-finals' : `Round ${r + 1}`)
  return (
    <section className="mx-auto w-full max-w-5xl rounded-3xl border border-hairline bg-surface-low p-5 shadow-md" aria-label="Knockout bracket">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-2xl font-bold">{label(round)}</h2>
        <span className="text-ink-muted">best of {length} question{length === 1 ? '' : 's'}</span>
        <ol className="ml-auto flex flex-wrap gap-2 text-sm font-bold">
          {rounds0.map((r) => {
            const done = matches.filter((m) => m.round === r).every((m) => m.settled_at)
            return (
              <li key={r} className={`rounded-full px-3 py-1 ${r === round ? 'bg-orange-500 text-white' : done ? 'bg-green-600/15 text-green-600' : 'bg-hairline/60 text-ink-muted'}`}>
                {label(r)}{done ? ' ✓' : ''}
              </li>
            )
          })}
        </ol>
      </div>
      <ol className={`grid gap-3 ${Math.min(inRound.length, MAX_CARDS) <= 2 ? 'sm:grid-cols-2' : inRound.length <= 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3 lg:grid-cols-4'}`}>
        {inRound.slice(0, MAX_CARDS).map((m) => <MatchCard key={m.id} match={m} />)}
      </ol>
      {inRound.length > MAX_CARDS && <p className="mt-3 text-center text-lg text-ink-muted">and {inRound.length - MAX_CARDS} more matches</p>}
    </section>
  )
}

const PLACES = [
  { key: 'champion', label: 'Champion', icon: '🏆' },
  { key: 'runnerUp', label: 'Runner-up', icon: '🥈' },
  { key: 'semi', label: 'Semi-finalist', icon: '🥉' },
]

// Champion, runner-up and the two semi-finalists, for the end of a bracket game.
export function BracketPodium({ matches, championId, players }) {
  const result = podium(matches, championId)
  if (!result) return null
  const champion = players.find((p) => p.id === championId)
  const entries = [
    { place: PLACES[0], name: champion?.nickname ?? 'Champion', avatar: champion?.avatar_id ?? 0 },
    ...(result.runnerUp ? [{ place: PLACES[1], name: result.runnerUp.name ?? 'Runner-up', avatar: result.runnerUp.avatar ?? 0 }] : []),
    ...result.semifinalists.map((s) => ({ place: PLACES[2], name: s.name ?? 'Semi-finalist', avatar: s.avatar ?? 0 })),
  ]
  return (
    <section className="mx-auto w-full max-w-4xl rounded-3xl qz-deep p-6 text-white shadow-xl" aria-label="Bracket podium">
      <h2 className="mb-4 text-center text-2xl font-bold uppercase tracking-[0.12em]">Knockout results</h2>
      <ol className="flex flex-wrap items-end justify-center gap-4">
        {entries.map((e, i) => (
          <li key={i} className={`flex flex-col items-center gap-1 rounded-2xl bg-white/10 px-5 py-3 ${i === 0 ? 'scale-110' : ''}`}>
            <span className="text-3xl" aria-hidden="true">{e.place.icon}</span>
            <Avatar name={e.name} avatarId={e.avatar} mood={i === 0 ? 'dance' : 'static'} className={i === 0 ? 'h-24 w-24' : 'h-16 w-16'} />
            <span className="max-w-[10rem] truncate text-xl font-bold">{e.name}</span>
            <span className="text-sm text-white/70">{e.place.label}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

// A player's own match, on their phone.
export function BracketCard({ bracket, compact = false }) {
  if (!bracket) return null
  const { match, status, rounds, done } = bracket
  if (!match) {
    return <p className="rounded-2xl bg-surface px-4 py-2 text-center text-sm font-semibold text-ink-muted">{status === 'champion' ? '🏆 You are the champion!' : 'You are out of the bracket.'}</p>
  }
  const opp = match.opponent
  const roundLabel = rounds && match.round === rounds - 1 ? 'Final' : `Round ${match.round + 1}${rounds ? ` of ${rounds}` : ''}`
  let line
  let tone = 'bg-surface text-ink-900'
  if (status === 'champion') {
    line = '🏆 You are the champion!'
    tone = 'bg-green-600 text-white'
  } else if (!match.settled) {
    line = `${roundLabel}: you vs ${opp.nickname}${opp.isBot ? ' (bot)' : ''}`
  } else if (match.won) {
    line = done ? `You beat ${opp.nickname}!` : `You beat ${opp.nickname} and go through!`
    tone = 'bg-green-600/15 text-green-700'
  } else {
    line = `${opp.nickname} knocked you out`
    tone = 'bg-red-600/15 text-red-700'
  }
  return (
    <div className={`flex items-center gap-3 rounded-2xl border border-hairline px-4 py-3 text-left ${tone}`} role="status">
      <Avatar name={opp.nickname} avatarId={opp.avatarId} mood="static" className={compact ? 'h-9 w-9' : 'h-12 w-12'} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{line}</p>
        {match.settled && <p className="text-sm opacity-80">{formatScore(match.myScore ?? 0)} to {formatScore(match.theirScore ?? 0)}</p>}
      </div>
    </div>
  )
}

export { winnerId }

const BOT_LEVELS = [
  { value: 'average', label: 'Average' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'expert', label: 'Expert' },
  { value: 'mixed', label: 'Mixed' },
]

// The host's bracket setup in the lobby: on or off, how many questions a match lasts, and how strong the bot is that
// faces a player left without an opponent.
export function BracketPanel({ session, playerCount, questionCount, busy, onChange }) {
  const on = Boolean(session.bracket_mode)
  const length = session.bracket_length ?? 3
  const rounds = bracketRounds(playerCount, questionCount, length)
  const fieldClass = 'min-h-11 rounded-lg border border-hairline bg-paper px-3 text-lg font-semibold text-ink-900'
  return (
    <section className="rounded-3xl border border-dashed border-orange-500/60 bg-surface p-5 shadow-md" aria-label="Battle bracket">
      <div className="flex flex-wrap items-center gap-3">
        <span className="material-symbols-outlined text-orange-500" aria-hidden="true">account_tree</span>
        <h2 className="text-xl font-bold">Battle bracket</h2>
        <label className="ml-auto flex min-h-11 cursor-pointer items-center gap-2 font-semibold">
          <input type="checkbox" className="h-5 w-5" checked={on} disabled={busy} onChange={(e) => onChange({ enabled: e.target.checked })} />
          Knockout on
        </label>
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        Players are paired off. Each match is decided by the points the two earn on a few questions, and the winners are paired again until one is left.
        Everyone keeps playing every question. Someone without an opponent faces a bot.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Match length
          <select className={fieldClass} value={length} disabled={busy} onChange={(e) => onChange({ length: Number(e.target.value) })}>
            {BRACKET_LENGTHS.map((n) => <option key={n} value={n}>{n === 1 ? '1 question' : `Best of ${n} questions`}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Bot strength
          <select className={fieldClass} value={session.bracket_bot_skill ?? 'average'} disabled={busy} onChange={(e) => onChange({ botSkill: e.target.value })}>
            {BOT_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </label>
      </div>
      {on && (
        <p className="mt-3 text-sm font-semibold text-orange-500">
          {rounds === 0
            ? `This quiz has too few questions for matches of ${length}.`
            : `${playerCount} player${playerCount === 1 ? '' : 's'} now: ${rounds} round${rounds === 1 ? '' : 's'} (${rounds * length} of the quiz's ${questionCount} questions).`}
        </p>
      )}
    </section>
  )
}
