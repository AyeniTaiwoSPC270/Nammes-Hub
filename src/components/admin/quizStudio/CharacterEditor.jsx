import { useState } from 'react'
import {
  ACCESSORIES, BODIES, DEFAULT_MOOD, EYES, HELLO_MOVES, IDLE_MOVES, MAX_CAST, MOUTHS,
  PROPS, SAD_MOVES, TOPPERS, WIN_MOVES, avatarInfo, deriveColour, nextCastSlot, sameDesign, sanitizeCast,
} from '../../../../api/_lib/quizCharacterArt.js'
import { contrastWithWhite } from '../../../../api/_lib/quizTheme.js'
import Character from '../../quiz/Character'
import { useCastQuery, useSaveCast } from '../../../data/quiz'
import '../../quiz/characters.css'

const COLOUR_SWATCHES = ['#ff5a1f', '#d97706', '#15803d', '#0e7490', '#2563eb', '#6366f1', '#7c3aed', '#db2777', '#dc2626', '#52525b']
const PART_SECTIONS = [
  { id: 'body', label: 'Body', field: 'body', parts: BODIES },
  { id: 'topper', label: 'Headpiece', field: 'topper', parts: TOPPERS },
  { id: 'eyes', label: 'Eyes', field: 'eyes', parts: EYES },
  { id: 'mouth', label: 'Mouth', field: 'mouth', parts: MOUTHS },
  { id: 'accessory', label: 'Wears', field: 'accessory', parts: ACCESSORIES },
  { id: 'prop', label: 'Prop', field: 'prop', parts: PROPS },
]
const MOVE_SECTIONS = [
  { id: 'idle', label: 'Idle move', moves: IDLE_MOVES },
  { id: 'win', label: 'Win move', moves: WIN_MOVES },
  { id: 'sad', label: 'Miss move', moves: SAD_MOVES },
  { id: 'hello', label: 'Hello move', moves: HELLO_MOVES },
]
const SECTIONS = [
  { id: 'name', label: 'Name' }, { id: 'body', label: 'Body' }, { id: 'color', label: 'Colour' },
  { id: 'topper', label: 'Headpiece' }, { id: 'eyes', label: 'Eyes' }, { id: 'mouth', label: 'Mouth' },
  { id: 'accessory', label: 'Wears' }, { id: 'prop', label: 'Prop' }, { id: 'moves', label: 'Moves' },
]

function newCharacter(slot) {
  return {
    slot,
    name: `Character ${slot + 1}`,
    spec: { ...DEFAULT_MOOD, color: DEFAULT_MOOD.color.main },
    moves: { idle: DEFAULT_MOOD.idle, win: DEFAULT_MOOD.win, sad: DEFAULT_MOOD.sad, hello: DEFAULT_MOOD.hello },
  }
}

function drawingSpec(character) {
  return {
    ...character.spec,
    ...character.moves,
    color: deriveColour(character.spec.color ?? DEFAULT_MOOD.color.main),
    name: character.name,
  }
}

export default function CharacterEditor({ quizId }) {
  const query = useCastQuery({ quizId })
  const saveMutation = useSaveCast(quizId)
  const [draft, setDraft] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [open, setOpen] = useState('name')
  const saved = query.data ?? { mode: 'builtins', characters: [] }
  const cast = draft ?? saved
  const selected = cast.characters.find((character) => character.slot === selectedSlot) ?? cast.characters[0] ?? null
  const spec = selected ? drawingSpec(selected) : null

  function changeCast(next) {
    const names = next.characters.map((character) => character.name)
    const cleaned = sanitizeCast({
      ...next,
      // Keep the name field editable one key at a time, including briefly empty, without letting that partial value
      // reach the save boundary. Names are restored after all drawing fields have gone through the shared cleaner.
      characters: next.characters.map((character) => ({ ...character, name: character.name.trim() || '_' })),
    })
    setDraft({
      ...cleaned,
      retiredSlots: next.retiredSlots ?? cast.retiredSlots ?? [],
      characters: cleaned.characters.map((character, index) => ({ ...character, name: names[index] })),
    })
  }

  function updateCharacter(patch) {
    if (!selected) return
    changeCast({
      ...cast,
      characters: cast.characters.map((character) => character.slot === selected.slot ? { ...character, ...patch } : character),
    })
  }

  function updateSpec(field, value) {
    updateCharacter({ spec: { ...selected.spec, [field]: value } })
  }

  function addCharacter() {
    const slot = nextCastSlot(cast)
    if (slot === null) return
    changeCast({ ...cast, characters: [...cast.characters, newCharacter(slot)] })
    setSelectedSlot(slot)
    setOpen('name')
  }

  function deleteCharacter() {
    if (!selected) return
    const characters = cast.characters.filter((character) => character.slot !== selected.slot)
    // Only a saved row consumed a slot; deleting a new unsaved draft leaves its slot available.
    const retiredSlots = selected.id
      ? [...new Set([...(cast.retiredSlots ?? []), selected.slot])].sort((a, b) => a - b)
      : cast.retiredSlots ?? []
    changeCast({ ...cast, mode: characters.length === 0 ? 'builtins' : cast.mode, characters, retiredSlots })
    setSelectedSlot(characters[0]?.slot ?? null)
  }

  if (query.isError) return <p role="alert" className="rounded-2xl border border-hairline bg-surface p-4 text-sm text-ink-muted">Could not load this quiz&rsquo;s cast.</p>
  if (query.isLoading) return <p className="rounded-2xl border border-hairline bg-surface p-4 text-sm text-ink-muted">Loading character cast…</p>

  const duplicates = selected
    ? [
        ...Array.from({ length: 50 }, (_, id) => avatarInfo(id)).filter((builtin) => sameDesign(selected, builtin)).map((builtin) => builtin.name),
        ...cast.characters.filter((character) => character.slot !== selected.slot && sameDesign(selected, character)).map((character) => character.name),
      ]
    : []
  const color = selected?.spec.color ?? DEFAULT_MOOD.color.main
  const contrast = contrastWithWhite(deriveColour(color).dark)
  const allocatedSlots = cast.characters.length + (cast.retiredSlots?.length ?? 0)
  const hasInvalidName = cast.characters.some((character) => !character.name.trim())

  return (
    <section className="rounded-2xl border border-hairline bg-surface p-5 shadow-md" aria-label="Character cast editor">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink-900">Your character cast</h2>
          <p className="text-sm text-ink-muted">Each quiz has {MAX_CAST} stable slots. Removing a saved character retires its slot.</p>
        </div>
        <button type="button" onClick={addCharacter} disabled={allocatedSlots >= MAX_CAST} className="min-h-11 rounded-full bg-orange-500 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
          Add character ({allocatedSlots}/{MAX_CAST} slots used)
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Characters in this quiz">
        {cast.characters.map((character) => (
          <button
            key={character.slot}
            type="button"
            aria-pressed={selected?.slot === character.slot}
            onClick={() => setSelectedSlot(character.slot)}
            className={`min-h-10 rounded-full border px-4 text-sm font-semibold ${selected?.slot === character.slot ? 'border-orange-500 bg-orange-500/10 text-ink-900' : 'border-hairline bg-surface text-ink-900 hover:bg-surface-low'}`}
          >
            {character.name || `Slot ${character.slot + 1}`}
          </button>
        ))}
        {cast.characters.length === 0 && <p className="text-sm text-ink-muted">No custom characters yet.</p>}
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Which characters players can choose">
        {[
          ['builtins', 'The 50, as they are'],
          ['all', `The 50 + your ${cast.characters.length}`],
          ['custom', `Your ${cast.characters.length} only`],
        ].map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            aria-pressed={cast.mode === mode}
            disabled={mode !== 'builtins' && cast.characters.length === 0}
            title={mode !== 'builtins' && cast.characters.length === 0 ? 'Add a character first' : undefined}
            onClick={() => changeCast({ ...cast, mode })}
            className={`min-h-10 rounded-full border px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${cast.mode === mode ? 'border-orange-500 bg-orange-500/10 text-ink-900' : 'border-hairline bg-surface text-ink-900 hover:bg-surface-low'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {selected && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[220px_1fr]">
          <aside className="rounded-2xl border border-hairline bg-surface-low p-4 text-center">
            <div className="mx-auto h-40 w-40"><Character spec={spec} mood="idle" title={selected.name} /></div>
            <p className="mt-2 font-bold text-ink-900">{selected.name}</p>
            <p className="text-xs text-ink-muted">Slot {selected.slot + 1} · Player id {50 + selected.slot}</p>
            <div className="mt-3 grid grid-cols-5 gap-1">
              {['idle', 'wave', 'happy', 'dance', 'sad'].map((mood) => (
                <span key={mood} className="h-10 w-10"><Character spec={spec} mood={mood} title={`${selected.name}, ${mood}`} /></span>
              ))}
            </div>
          </aside>

          <div className="flex flex-col gap-2">
            {SECTIONS.map((section) => (
              <section key={section.id} className="overflow-hidden rounded-xl border border-hairline">
                <button
                  type="button"
                  aria-expanded={open === section.id}
                  onClick={() => setOpen(open === section.id ? null : section.id)}
                  className="flex min-h-11 w-full items-center justify-between bg-surface-low px-4 text-left text-sm font-bold text-ink-900"
                >
                  {section.label}<span aria-hidden="true">{open === section.id ? '−' : '+'}</span>
                </button>
                {open === section.id && (
                  <div className="p-3">
                    {section.id === 'name' ? (
                      <label className="block text-sm font-semibold text-ink-900">
                        Character name
                        <input value={selected.name} maxLength={24} onChange={(event) => updateCharacter({ name: event.target.value })} className="mt-1 min-h-11 w-full rounded-md border border-hairline bg-surface px-3 text-base" />
                      </label>
                    ) : section.id === 'color' ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {COLOUR_SWATCHES.map((hex) => (
                          <button key={hex} type="button" aria-label={`Character colour ${hex}`} aria-pressed={color === hex} onClick={() => updateSpec('color', hex)} className={`h-9 w-9 rounded-full border-2 ${color === hex ? 'border-ink-900 ring-2 ring-orange-500' : 'border-transparent'}`} style={{ backgroundColor: hex }} />
                        ))}
                        <label className="flex items-center gap-2 rounded-full border border-hairline px-3 py-1.5 text-sm font-semibold">
                          Custom <input type="color" aria-label="Custom character colour" value={color} onChange={(event) => updateSpec('color', event.target.value)} className="h-7 w-10" />
                        </label>
                        {contrast < 4.5 && <p role="status" className="w-full rounded-lg bg-orange-500/10 p-3 text-sm">White details may be hard to read on this colour; try a darker shade.</p>}
                      </div>
                    ) : section.id === 'moves' ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {MOVE_SECTIONS.map((move) => (
                          <label key={move.id} className="text-sm font-semibold text-ink-900">
                            {move.label}
                            <select value={selected.moves[move.id]} onChange={(event) => updateCharacter({ moves: { ...selected.moves, [move.id]: event.target.value } })} className="mt-1 min-h-11 w-full rounded-md border border-hairline bg-surface px-3">
                              {move.moves.map((name) => <option key={name} value={name}>{name}</option>)}
                            </select>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                        {PART_SECTIONS.find((item) => item.id === section.id).parts.map((part) => (
                          <button
                            key={part}
                            type="button"
                            onClick={() => updateSpec(section.id, part)}
                            aria-label={part}
                            aria-pressed={selected.spec[section.id] === part}
                            className={`flex aspect-square cursor-pointer flex-col items-center rounded-xl border p-1 ${selected.spec[section.id] === part ? 'border-orange-500 ring-2 ring-orange-500/40' : 'border-hairline hover:bg-surface-low'}`}
                          >
                            <Character spec={{ ...spec, [section.id]: part }} mood="static" className="h-full w-full" />
                            <span className="w-full truncate text-[10px] text-ink-muted">{part}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            ))}
            {duplicates.length > 0 && <p role="status" className="rounded-lg bg-orange-500/10 p-3 text-sm text-ink-900">This design matches {duplicates.join(', ')}. You can still save it.</p>}
          </div>
        </div>
      )}
      {(draft || selected) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {selected && <button type="button" onClick={deleteCharacter} className="min-h-11 rounded-full border border-hairline px-4 text-sm font-semibold text-ink-900">Delete character</button>}
          <button type="button" onClick={() => saveMutation.mutate(cast, { onSuccess: () => setDraft(null) })} disabled={saveMutation.isPending || hasInvalidName} className="min-h-11 rounded-full bg-orange-500 px-5 text-sm font-bold text-white disabled:opacity-50">
            {saveMutation.isPending ? 'Saving…' : 'Save cast'}
          </button>
          {draft && <button type="button" onClick={() => setDraft(null)} className="min-h-11 rounded-full border border-hairline px-4 text-sm font-semibold text-ink-900">Discard changes</button>}
          {hasInvalidName && <p role="status" className="w-full text-sm text-ink-muted">Every character needs a name before the cast can be saved.</p>}
          {saveMutation.isError && <p role="alert" className="w-full text-sm text-red-600">{saveMutation.error.message}</p>}
        </div>
      )}
    </section>
  )
}
