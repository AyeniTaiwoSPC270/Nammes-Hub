import { getSupabaseAdmin } from '../supabaseAdmin.js'
import { getCaller as checkCaller, bearerToken } from '../authz.js'
import { isUuid } from '../validate.js'
import { sanitizeCast } from '../quizCharacterArt.js'
import { readQuizCast, saveQuizCast } from '../castStore.js'

// `roster` is public data used before a player joins; a join code reads the frozen session copy, while a quiz id reads
// the live cast used by battles and practice. `cast` is the single admin write operation.
export function createQuizCastHandler(getClient, { getCaller = checkCaller } = {}) {
  return async function quizCast(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    const { op, code, quizId, mode, characters } = req.body ?? {}
    const db = getClient()

    if (op === 'roster') {
      if (typeof code === 'string' && code.trim()) {
        const { data: session, error } = await db.from('quiz_sessions')
          .select('quiz_id, characters').eq('join_code', code.trim()).maybeSingle()
        if (error) return res.status(500).json({ error: 'Could not load the character roster.' })
        if (!session) return res.status(404).json({ error: 'No game with that code.' })
        return res.status(200).json(cleanRoster(session.characters))
      }
      if (isUuid(quizId)) {
        try {
          const cast = await readQuizCast(db, quizId)
          if (!cast) return res.status(404).json({ error: 'No quiz with that id.' })
          return res.status(200).json(cast)
        } catch {
          return res.status(500).json({ error: 'Could not load the character roster.' })
        }
      }
      return res.status(400).json({ error: 'Send a join code or a quiz id.' })
    }

    if (op === 'cast') {
      const caller = await getCaller(db, bearerToken(req))
      if (caller.error) return res.status(caller.error[0]).json({ error: caller.error[1] })
      if (!caller.isAdmin) return res.status(403).json({ error: 'Admin access required.' })
      if (!isUuid(quizId)) return res.status(400).json({ error: 'A valid quiz id is required.' })

      let cast
      try {
        cast = sanitizeCast({ mode, characters })
        const saved = await saveQuizCast(db, quizId, cast)
        return res.status(200).json(saved)
      } catch (error) {
        const message = error?.message ?? 'Could not save the character cast.'
        const code = message.startsWith('Could not ') ? 500 : 400
        return res.status(code).json({ error: code === 400 ? message : 'Could not save the character cast.' })
      }
    }

    return res.status(400).json({ error: 'Unknown character cast operation.' })
  }
}

function cleanRoster(raw) {
  try {
    return sanitizeCast(raw)
  } catch {
    return { mode: 'builtins', characters: [] }
  }
}

export default createQuizCastHandler(() => getSupabaseAdmin())
