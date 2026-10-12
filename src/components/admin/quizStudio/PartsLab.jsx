import { useState } from 'react'
import { BODIES, TOPPERS, EYES, MOUTHS, ACCESSORIES, PROPS, DEFAULT_MOOD } from '../../../../api/_lib/quizCharacterArt.js'
import Character from '../../quiz/Character'
import '../../quiz/characters.css'
import { filterPartNames } from './partsLabUtils.js'

// Every part in the drawer, one category at a time, drawn on one plain body. Nothing here writes: the cast editor is the
// only place a character is changed. This gives the new art somewhere to be reviewed before it is used in a character.

const CATEGORIES = [
  { id: 'body', label: 'Body', field: 'body', parts: BODIES },
  { id: 'topper', label: 'Headpiece', field: 'topper', parts: TOPPERS },
  { id: 'eyes', label: 'Eyes', field: 'eyes', parts: EYES },
  { id: 'mouth', label: 'Mouth', field: 'mouth', parts: MOUTHS },
  { id: 'accessory', label: 'Wears', field: 'accessory', parts: ACCESSORIES },
  { id: 'prop', label: 'Prop', field: 'prop', parts: PROPS },
]

const MOODS = ['idle', 'wave', 'happy', 'dance', 'sad']

export default function PartsLab() {
  const [category, setCategory] = useState(CATEGORIES[0])
  const [filter, setFilter] = useState('')
  const [chosen, setChosen] = useState(null)

  const shown = filterPartNames(category.parts, filter)
  const spec = chosen ? { ...DEFAULT_MOOD, [category.field]: chosen } : DEFAULT_MOOD

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-hairline bg-surface p-5 text-center shadow-md">
          <div className="mx-auto h-44 w-44">
            <Character key={`${category.field}-${chosen}`} spec={spec} mood="idle" title={chosen ?? 'A plain character'} />
          </div>
          <h3 className="mt-2 text-2xl font-bold text-ink-900">{chosen ?? category.label}</h3>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">
            {shown.length} of {category.parts.length}
          </p>
          {chosen && (
            <div className="mt-3 flex justify-center gap-2" aria-label="Part preview in each mood">
              {MOODS.map((mood) => (
                <span key={mood} className="h-12 w-12">
                  <Character spec={spec} mood={mood} title={`${chosen}, ${mood}`} />
                </span>
              ))}
            </div>
          )}
        </div>
        <label className="block text-sm font-semibold text-ink-900">
          Filter parts
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-md border border-hairline bg-surface px-3 py-2 text-base text-ink"
          />
        </label>
      </aside>

      <div>
        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Part categories">
          {CATEGORIES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === category.id}
              onClick={() => { setCategory(item); setChosen(null); setFilter('') }}
              className={[
                'min-h-11 cursor-pointer rounded-full px-5 text-sm font-bold',
                item.id === category.id ? 'bg-green-900 text-white' : 'border border-hairline bg-surface text-ink-900 hover:bg-surface-low',
              ].join(' ')}
            >
              {item.label} ({item.parts.length})
            </button>
          ))}
        </div>
        {shown.length === 0 ? (
          <p role="status" className="rounded-2xl border border-hairline bg-surface p-6 text-sm text-ink-muted">
            Nothing in {category.label} matches “{filter}”.
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
            {shown.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => setChosen(name)}
                  aria-pressed={chosen === name}
                  aria-label={`${category.field} ${name}`}
                  className={[
                    'flex w-full cursor-pointer flex-col items-center gap-1 rounded-2xl border bg-surface p-2 shadow-sm transition-colors',
                    chosen === name ? 'border-orange-500 ring-2 ring-orange-500/40' : 'border-hairline hover:bg-surface-low',
                  ].join(' ')}
                >
                  <span className="block h-16 w-16">
                    <Character spec={{ ...DEFAULT_MOOD, [category.field]: name }} mood="static" />
                  </span>
                  <span className="w-full truncate text-xs font-semibold text-ink-900">{name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
