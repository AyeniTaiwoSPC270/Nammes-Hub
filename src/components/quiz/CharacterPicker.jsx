import { castIds, characterSpec } from '../../../api/_lib/quizCharacterArt.js'
import Character from './Character'
import './characters.css'

// A player's available ids and the character each id means come from the same cast resolver used by the server and card.
export default function CharacterPicker({ cast, value, onChange, label = 'Characters' }) {
  return (
    <div className="grid max-h-56 grid-cols-5 gap-2 overflow-y-auto rounded-2xl border border-hairline p-2" role="group" aria-label={label}>
      {castIds(cast).map((id) => {
        const spec = characterSpec(id, cast)
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-label={spec.name}
            aria-pressed={value === id}
            className={`aspect-square rounded-xl border-2 p-0.5 ${value === id ? 'border-orange-500 bg-orange-500/12' : 'border-transparent bg-paper'}`}
          >
            <Character spec={spec} mood={value === id ? 'happy' : 'static'} />
          </button>
        )
      })}
    </div>
  )
}
