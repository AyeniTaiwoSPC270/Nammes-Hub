import { getSupabaseAdmin } from '../supabaseAdmin.js'
import { logError } from '../logError.js'
import { isWebhookAuthentic } from '../webhookAuth.js'
import { stepUpdate } from '../quiz.js'
import { dueStep } from '../quizSchedule.js'
import { sessionQuestionIds, currentQuestion } from '../quizSessionQuestions.js'

// One tick for every open quiz. Called by pg_cron (run_quiz_tick) and never by a browser: the signature is the
// same one the calendar reminders use, over a table/key pair no other caller signs.
//
// This is not the only engine. A player poll asks the same question (`quiz-state`), because a minute is far too
// coarse for a five-second leaderboard; this tick is what expires an empty lobby and finishes a game nobody is
// watching. Both apply the decision with the same compare-and-swap, so a double fire is a 0-row update.
const MAX_SESSIONS = 50

export function createQuizTickHandler(getClient, { now = () => Date.now(), authentic = isWebhookAuthentic } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const supabaseAdmin = getClient()
    if (!(await authentic(supabaseAdmin, { headers: req.headers ?? {}, table: 'quiz_sessions', key: 'tick' }))) {
      res.status(401).json({ error: 'Not signed' })
      return
    }

    const { data: sessions, error } = await supabaseAdmin
      .from('quiz_sessions')
      .select('*')
      .eq('autopilot', true)
      .neq('state', 'finished')
      .limit(MAX_SESSIONS)
    if (error) {
      console.error('quiz-tick: session read failed', error)
      await logError(supabaseAdmin, 'quiz-tick', error, 500)
      res.status(500).json({ error: 'Could not read the open games' })
      return
    }

    const nowMs = now()
    const nowIso = new Date(nowMs).toISOString()
    let advanced = 0

    for (const session of sessions ?? []) {
      try {
        const questionIds = await sessionQuestionIds(supabaseAdmin, session)
        const question = session.state === 'question' ? await currentQuestion(supabaseAdmin, session) : null
        let playerCount = 0
        if (session.state === 'lobby') {
          const { count } = await supabaseAdmin
            .from('quiz_players')
            .select('id', { count: 'exact', head: true })
            .eq('session_id', session.id)
          playerCount = count ?? 0
        }

        const due = dueStep(session, { nowMs, questionCount: questionIds.length, question, playerCount })
        if (!due) continue

        const { data: updated, error: updateError } = await supabaseAdmin
          .from('quiz_sessions')
          .update(stepUpdate(due.next, nowIso))
          .eq('id', session.id)
          .eq('state', session.state)
          .eq('current_question_index', session.current_question_index)
          .select('id')
          .maybeSingle()
        // A 0-row update is the host screen (or another tick) getting there first. Not an error, and never a
        // reason to retry into the next state.
        if (updateError) {
          console.error('quiz-tick: update failed', updateError)
          await logError(supabaseAdmin, 'quiz-tick', updateError, 500)
        } else if (updated) {
          advanced += 1
        }
      } catch (sessionError) {
        console.error('quiz-tick: session step failed', sessionError)
        await logError(supabaseAdmin, 'quiz-tick', sessionError, 500)
      }
    }

    res.status(200).json({ checked: (sessions ?? []).length, advanced })
  }
}

export default createQuizTickHandler(getSupabaseAdmin)
