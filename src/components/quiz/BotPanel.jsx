import { useState } from 'react'

// The host's "Test bots" box in the lobby: add computer players (any number, any skill) to try a game out, or to make
// a small room feel full. Bots join like real players, answer by themselves while the host page is open, and show up in
// the results like everyone else.

export const BOT_SKILL_OPTIONS = [
  { value: 'mixed', label: 'Mixed crowd', hint: 'A few beginners, mostly average, a few experts. Feels like a real room.' },
  { value: 'beginner', label: 'Beginners', hint: 'Right about 65% of easy, 35% of medium and 15% of hard questions.' },
  { value: 'average', label: 'Average', hint: 'Right about 88% of easy, 62% of medium and 33% of hard questions.' },
  { value: 'expert', label: 'Experts', hint: 'Right about 97% of easy, 90% of medium and 75% of hard questions.' },
]

const QUICK_COUNTS = [5, 10, 20, 49]

export default function BotPanel({ botCount, spotsLeft, busy, onAdd, onRemove }) {
  const [count, setCount] = useState(10)
  const [skill, setSkill] = useState('mixed')
  const hint = BOT_SKILL_OPTIONS.find((o) => o.value === skill)?.hint
  const amount = Math.max(1, Math.min(100, Number(count) || 1))
  const fieldClass = 'min-h-11 rounded-lg border border-hairline bg-paper px-3 text-lg font-semibold text-ink-900'

  return (
    <section className="rounded-3xl border border-dashed border-orange-500/60 bg-surface p-5 shadow-md" aria-label="Test bots">
      <div className="flex flex-wrap items-center gap-3">
        <span className="material-symbols-outlined text-orange-500" aria-hidden="true">smart_toy</span>
        <h2 className="text-xl font-bold">Test bots</h2>
        <span className="text-ink-muted">
          {botCount === 0 ? 'None yet.' : `${botCount} in this game.`} {spotsLeft} spot{spotsLeft === 1 ? '' : 's'} left.
        </span>
      </div>
      <p className="mt-1 text-sm text-ink-muted">Bots only answer while this page is open. They are part of the results.</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          How many
          <input
            type="number"
            min="1"
            max="100"
            inputMode="numeric"
            className={`${fieldClass} w-24`}
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2" aria-label="Quick amounts">
          {QUICK_COUNTS.map((n) => (
            <button key={n} type="button" onClick={() => setCount(n)} className="min-h-11 rounded-full border border-hairline px-4 font-bold hover:bg-surface-low">
              {n}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Skill
          <select className={fieldClass} value={skill} onChange={(e) => setSkill(e.target.value)}>
            {BOT_SKILL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <button
          type="button"
          disabled={busy || spotsLeft <= 0}
          onClick={() => onAdd(amount, skill)}
          className="min-h-11 rounded-lg bg-orange-500 px-5 font-bold text-white disabled:opacity-50"
        >
          Add {amount} bot{amount === 1 ? '' : 's'}
        </button>
        {botCount > 0 && (
          <button type="button" disabled={busy} onClick={onRemove} className="min-h-11 rounded-lg border border-hairline px-4 font-bold hover:bg-surface-low disabled:opacity-50">
            Remove all bots
          </button>
        )}
      </div>
      <p className="mt-2 text-sm text-ink-muted">{hint}</p>
    </section>
  )
}
