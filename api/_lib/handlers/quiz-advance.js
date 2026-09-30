import { getSupabaseAdmin } from '../supabaseAdmin.js'
import { logError } from '../logError.js'
import { getCaller, bearerToken } from '../authz.js'
import { isUuid } from '../validate.js'
import { nextState, stepUpdate } from '../quiz.js'
import { isRoundEnd, roundOfQuestion } from '../quizBracket.js'
import { startBracket, settleRound } from '../quizBracketEngine.js'

const STATES = ['lobby', 'question', 'reveal', 'leaderboard', 'finished']

// Admin moves a game to its next step. The caller says which step it thinks the game is on, and the update only
// goes through if that is still true, so two open host tabs (or a double click) can never skip a step.
export function createQuizAdvanceHandler(getClient, { now = () => new Date() } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    const { sessionId, expectedState, expectedIndex } = req.body ?? {}
    if (!isUuid(sessionId) || !STATES.includes(expectedState) || !Number.isInteger(expectedIndex)) {
      res.status(400).json({ error: 'sessionId, expectedState and expectedIndex are required' })
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

    const { data: session } = await supabaseAdmin.from('quiz_sessions').select('*').eq('id', sessionId).maybeSingle()
    if (!session) {
      res.status(404).json({ error: 'Game not found' })
      return
    }
    if (session.state !== expectedState || session.current_question_index !== expectedIndex) {
      res.status(409).json({ error: 'The game has already moved on', session })
      return
    }

    const { count } = await supabaseAdmin
      .from('quiz_questions')
      .select('id', { count: 'exact', head: true })
      .eq('quiz_id', session.quiz_id)
    const next = nextState(session, count ?? 0)
    if (!next) {
      res.status(400).json({ error: 'This game cannot go any further' })
      return
    }

    const update = stepUpdate(next, now().toISOString())

    const { data: updated, error } = await supabaseAdmin
      .from('quiz_sessions')
      .update(update)
      .eq('id', sessionId)
      .eq('state', expectedState)
      .eq('current_question_index', expectedIndex)
      .select('*')
      .maybeSingle()
    if (error) {
      console.error('quiz-advance: update failed', error)
      await logError(supabaseAdmin, 'quiz-advance', error, 500)
      res.status(500).json({ error: 'Could not advance the game' })
      return
    }
    if (!updated) {
      res.status(409).json({ error: 'The game has already moved on' })
      return
    }
    // In a bracket game, the start pairs everyone up and the end of a round decides who goes through.
    if (session.bracket_mode) {
      try {
        if (expectedState === 'lobby') await startBracket(supabaseAdmin, updated)
        else if (expectedState === 'reveal' && isRoundEnd(expectedIndex, session.bracket_length)) {
          await settleRound(supabaseAdmin, updated, roundOfQuestion(expectedIndex, session.bracket_length), now().toISOString())
        }
      } catch (bracketError) {
        console.error('quiz-advance: bracket step failed', bracketError)
        await logError(supabaseAdmin, 'quiz-advance', bracketError, 500)
      }
      const { data: fresh } = await supabaseAdmin.from('quiz_sessions').select('*').eq('id', sessionId).maybeSingle()
      res.status(200).json({ session: fresh ?? updated })
      return
    }
    res.status(200).json({ session: updated })
  }
}

export default createQuizAdvanceHandler(getSupabaseAdmin)
