import { getSupabaseAdmin } from '../supabaseAdmin.js'
import { logError } from '../logError.js'
import { getCaller, bearerToken } from '../authz.js'
import { isUuid } from '../validate.js'
import { generateJoinCode, isMaxPlayers, DEFAULT_MAX_PLAYERS } from '../quiz.js'

const CODE_ATTEMPTS = 8

// Admin starts a game for a quiz: a session in the lobby with a fresh 6-digit join code.
export function createQuizCreateHandler(getClient, { makeCode = generateJoinCode } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    const { quizId, maxPlayers } = req.body ?? {}
    if (!isUuid(quizId)) {
      res.status(400).json({ error: 'quizId (uuid) is required' })
      return
    }
    if (maxPlayers !== undefined && !isMaxPlayers(maxPlayers)) {
      res.status(400).json({ error: 'Max players must be a whole number from 2 to 150' })
      return
    }

    const supabaseAdmin = getClient()
    const caller = await getCaller(supabaseAdmin, bearerToken(req))
    if (caller.error) {
      res.status(caller.error[0]).json({ error: caller.error[1] })
      return
    }
    if (!caller.isAdmin) {
      res.status(403).json({ error: 'Admin access required' })
      return
    }

    const { count, error: countError } = await supabaseAdmin
      .from('quiz_questions')
      .select('id', { count: 'exact', head: true })
      .eq('quiz_id', quizId)
    if (countError) {
      console.error('quiz-create: question count failed', countError)
      await logError(supabaseAdmin, 'quiz-create', countError, 500)
      res.status(500).json({ error: 'Could not start the game' })
      return
    }
    if (!count) {
      res.status(400).json({ error: 'Add at least one question before hosting this quiz' })
      return
    }

    // No limit given: use the quiz's own default. The game keeps its own copy, so later edits never change a running game.
    let limit = maxPlayers
    if (limit === undefined) {
      const { data: quiz } = await supabaseAdmin.from('quizzes').select('max_players').eq('id', quizId).maybeSingle()
      limit = quiz?.max_players ?? DEFAULT_MAX_PLAYERS
    }

    // The code only has to be unique among running games, so a clash is rare; retry a few times if it happens.
    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
      const { data, error } = await supabaseAdmin
        .from('quiz_sessions')
        .insert({ quiz_id: quizId, join_code: makeCode(), max_players: limit })
        .select('id, join_code')
        .single()
      if (!error) {
        res.status(200).json({ sessionId: data.id, joinCode: data.join_code, maxPlayers: limit })
        return
      }
      if (error.code !== '23505') {
        console.error('quiz-create: insert failed', error)
        await logError(supabaseAdmin, 'quiz-create', error, 500)
        res.status(500).json({ error: 'Could not start the game' })
        return
      }
    }
    res.status(503).json({ error: 'Could not find a free join code. Try again.' })
  }
}

export default createQuizCreateHandler(getSupabaseAdmin)
