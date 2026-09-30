import { useState } from 'react'
import { AVATAR_COUNT, avatarInfo } from '../../../data/quizCharacters'
import Character from '../../quiz/Character'

// All 50 characters in one place, so an admin can see who players can pick and how each one moves.

const MOODS = [
  { id: 'idle', label: 'Waiting', hint: 'How it stands around in the lobby' },
  { id: 'wave', label: 'Saying hi', hint: 'Its hello gesture' },
  { id: 'happy', label: 'Right answer', hint: 'Its win move' },
  { id: 'dance', label: 'On the podium', hint: 'Its win move, faster' },
  { id: 'sad', label: 'Wrong answer', hint: 'How it takes a miss' },
]

export default function CharacterGallery() {
  const [mood, setMood] = useState('idle')
  const [selected, setSelected] = useState(0)
  const info = avatarInfo(selected)
  const currentMood = MOODS.find((m) => m.id === mood)

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-hairline bg-surface p-5 text-center shadow-md">
          <div className="mx-auto h-44 w-44">
            <Character key={`${selected}-${mood}`} id={selected} mood={mood} title={info.name} />
          </div>
          <h3 className="mt-2 text-2xl font-bold text-ink-900">{info.name}</h3>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">Character {selected + 1} of {AVATAR_COUNT}</p>
          <dl className="mt-4 grid gap-2 text-left text-sm">
            {[
              ['Waiting', info.moves.idle],
              ['Right answer', info.moves.win],
              ['Says hi', info.moves.hello],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 rounded-lg bg-surface-low px-3 py-2">
                <dt className="text-ink-muted">{label}</dt>
                <dd className="font-semibold text-ink-900">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.05em] text-brand-orange">Show it</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Character mood">
            {MOODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMood(m.id)}
                aria-pressed={mood === m.id}
                title={m.hint}
                className={[
                  'min-h-10 cursor-pointer rounded-full border px-4 text-sm font-semibold',
                  mood === m.id ? 'border-orange-500 bg-orange-500 text-white' : 'border-hairline bg-surface text-ink-900 hover:bg-surface-low',
                ].join(' ')}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-muted">{currentMood.hint}. Every one of the 50 moves differently.</p>
        </div>
      </aside>

      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: AVATAR_COUNT }, (_, id) => {
          const c = avatarInfo(id)
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => setSelected(id)}
                aria-pressed={selected === id}
                aria-label={c.name}
                className={[
                  'flex w-full cursor-pointer flex-col items-center gap-1 rounded-2xl border bg-surface p-2 shadow-sm transition-colors',
                  selected === id ? 'border-orange-500 ring-2 ring-orange-500/40' : 'border-hairline hover:bg-surface-low',
                ].join(' ')}
              >
                <span className="block h-16 w-16">
                  <Character id={id} mood={selected === id ? mood : 'idle'} />
                </span>
                <span className="w-full truncate text-xs font-semibold text-ink-900">{c.name}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
