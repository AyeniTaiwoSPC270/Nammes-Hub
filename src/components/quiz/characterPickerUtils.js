import { castIds } from '../../../api/_lib/quizCharacterArt.js'

export function randomCastId(cast) {
  const ids = castIds(cast)
  return ids[Math.floor(Math.random() * ids.length)] ?? 0
}
