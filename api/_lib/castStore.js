import { sanitizeCast } from './quizCharacterArt.js'

function throwIfError(error, action) {
  if (error) throw new Error(`Could not ${action}: ${error.message ?? 'database error'}`)
}

export async function readQuizCast(db, quizId) {
  const { data: quiz, error: quizError } = await db.from('quizzes').select('cast_mode').eq('id', quizId).maybeSingle()
  throwIfError(quizError, 'read the quiz cast mode')
  if (!quiz) return null
  const { data: rows, error } = await db.from('quiz_characters').select('*').eq('quiz_id', quizId).order('slot', { ascending: true })
  throwIfError(error, 'read the quiz cast')
  return sanitizeCast({ mode: quiz.cast_mode, characters: rows ?? [] })
}

// Validate the full draft against stored ids and occupied slots before writing anything. Slots are identities, so a
// character can be edited in place but cannot be moved into another character's slot.
export async function saveQuizCast(db, quizId, rawCast) {
  const cast = sanitizeCast(rawCast)
  const { data: quiz, error: quizError } = await db.from('quizzes').select('id').eq('id', quizId).maybeSingle()
  throwIfError(quizError, 'read the quiz')
  if (!quiz) throw new Error('No quiz with that id.')

  const { data: existing, error: existingError } = await db.from('quiz_characters').select('id, slot').eq('quiz_id', quizId)
  throwIfError(existingError, 'read the existing cast')
  const byId = new Map((existing ?? []).map((row) => [row.id, row]))
  const bySlot = new Map((existing ?? []).map((row) => [row.slot, row]))

  for (const character of cast.characters) {
    const sameId = character.id ? byId.get(character.id) : null
    if (character.id && !sameId) throw new Error(`Character id is not in this quiz's cast.`)
    if (sameId && sameId.slot !== character.slot) throw new Error(`Character slots cannot be changed.`)
    const occupant = bySlot.get(character.slot)
    if (occupant && occupant.id !== character.id) throw new Error(`Slot ${character.slot} is occupied.`)
  }

  const keptIds = new Set(cast.characters.map((character) => character.id).filter(Boolean))
  const droppedIds = (existing ?? []).filter((row) => !keptIds.has(row.id)).map((row) => row.id)
  if (droppedIds.length) {
    const { error } = await db.from('quiz_characters').delete().in('id', droppedIds).eq('quiz_id', quizId)
    throwIfError(error, 'delete removed characters')
  }

  for (const character of cast.characters) {
    const row = {
      quiz_id: quizId,
      slot: character.slot,
      name: character.name,
      spec: character.spec,
      moves: character.moves,
    }
    const result = character.id
      ? await db.from('quiz_characters').update(row).eq('id', character.id).eq('quiz_id', quizId)
      : await db.from('quiz_characters').insert(row)
    throwIfError(result.error, 'save a character')
  }

  const { error: modeError } = await db.from('quizzes').update({ cast_mode: cast.mode }).eq('id', quizId)
  throwIfError(modeError, 'save the cast mode')
  return readQuizCast(db, quizId)
}
