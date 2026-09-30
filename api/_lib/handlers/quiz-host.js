import { getSupabaseAdmin } from '../supabaseAdmin.js'
import { logError } from '../logError.js'
import { getCaller, bearerToken } from '../authz.js'
import { isUuid } from '../validate.js'
import { stepUpdate, EXTEND_STEP_MS, MAX_EXTEND_MS } from '../quiz.js'

const OPS = ['kick', 'lock', 'unlock', 'pause', 'resume', 'extend', 'skip', 'rename']
const STEP_OPS = ['pause', 'resume', 'extend', 'skip']

// Admin controls for a running game: kick or rename a player, lock the lobby, pause, add time, skip a question.
// Ops that act on the current question say which question they mean (expectedState / expectedIndex), exactly like
// `advance`, so a stale click or a second host tab can never hit the wrong one. Every op is logged.
export function createQuizHostHandler(getClient, { now = () => new Date(), pickNumber = () => Math.floor(Math.random() * 900) + 100 } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    const { sessionId, op, playerId, block, expectedState, expectedIndex } = req.body ?? {}
    if (!isUuid(sessionId) || !OPS.includes(op)) {
      res.status(400).json({ error: 'sessionId and a valid op are required' })
      return
    }
    if ((op === 'kick' || op === 'rename') && !isUuid(playerId)) {
      res.status(400).json({ error: 'playerId is required' })
      return
    }
    if (STEP_OPS.includes(op) && (typeof expectedState !== 'string' || !Number.isInteger(expectedIndex))) {
      res.status(400).json({ error: 'expectedState and expectedIndex are required' })
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
    if (session.state === 'finished') {
      res.status(409).json({ error: 'This game is finished', session })
      return
    }
    if (STEP_OPS.includes(op)) {
      if (session.state !== expectedState || session.current_question_index !== expectedIndex) {
        res.status(409).json({ error: 'The game has already moved on', session })
        return
      }
      if (session.state !== 'question') {
        res.status(409).json({ error: 'There is no question open right now', session })
        return
      }
    }

    const nowIso = now().toISOString()
    const log = (detail = {}) => supabaseAdmin.from('quiz_host_log').insert({ session_id: sessionId, op, detail })
    const fail = async (error, message) => {
      console.error(`quiz-host: ${op} failed`, error)
      await logError(supabaseAdmin, 'quiz-host', error, 500)
      res.status(500).json({ error: message })
    }
    const save = async (patch) => {
      const { data, error } = await supabaseAdmin.from('quiz_sessions').update(patch).eq('id', sessionId).select('*').maybeSingle()
      if (error) {
        await fail(error, 'Could not update the game')
        return null
      }
      return data
    }
    const done = async (patch, detail) => {
      const updated = await save(patch)
      if (!updated) return
      await log(detail)
      res.status(200).json({ session: updated })
    }

    if (op === 'lock' || op === 'unlock') return done({ locked: op === 'lock' })

    if (op === 'pause') {
      if (session.paused_at) {
        res.status(200).json({ session })
        return
      }
      return done({ paused_at: nowIso })
    }

    if (op === 'resume') {
      if (!session.paused_at) {
        res.status(200).json({ session })
        return
      }
      const pausedFor = Math.max(0, now().getTime() - new Date(session.paused_at).getTime())
      return done({ paused_at: null, paused_total_ms: (session.paused_total_ms ?? 0) + pausedFor }, { pausedFor })
    }

    if (op === 'extend') {
      const bonus = session.time_bonus_ms ?? 0
      if (bonus >= MAX_EXTEND_MS) {
        res.status(409).json({ error: 'You cannot add more time to this question', session })
        return
      }
      const next = Math.min(MAX_EXTEND_MS, bonus + EXTEND_STEP_MS)
      return done({ time_bonus_ms: next }, { bonusMs: next })
    }

    if (op === 'skip') {
      const { data: questions } = await supabaseAdmin.from('quiz_questions').select('id, position').eq('quiz_id', session.quiz_id)
      const count = (questions ?? []).length
      const current = (questions ?? []).find((q) => q.position === session.current_question_index)
      if (current) {
        const { error } = await supabaseAdmin.rpc('quiz_skip_question', { p_session: sessionId, p_question: current.id })
        if (error) return fail(error, 'Could not skip the question')
      }
      // Straight to the next question (or the end), without a reveal or leaderboard for the discarded one.
      const nextIndex = session.current_question_index + 1
      const next =
        nextIndex < count
          ? { state: 'question', current_question_index: nextIndex, startsQuestion: true }
          : { state: 'finished', current_question_index: session.current_question_index }
      const { data: updated, error } = await supabaseAdmin
        .from('quiz_sessions')
        .update(stepUpdate(next, nowIso))
        .eq('id', sessionId)
        .eq('state', 'question')
        .eq('current_question_index', expectedIndex)
        .select('*')
        .maybeSingle()
      if (error) return fail(error, 'Could not skip the question')
      if (!updated) {
        res.status(409).json({ error: 'The game has already moved on' })
        return
      }
      await log({ skipped: expectedIndex })
      res.status(200).json({ session: updated })
      return
    }

    // kick / rename act on one player of this game
    const { data: player } = await supabaseAdmin.from('quiz_players').select('id, session_id, nickname').eq('id', playerId).maybeSingle()
    if (!player || player.session_id !== sessionId) {
      res.status(404).json({ error: 'Player not found in this game' })
      return
    }

    if (op === 'kick') {
      const { error } = await supabaseAdmin.from('quiz_players').delete().eq('id', playerId)
      if (error) return fail(error, 'Could not remove the player')
      const patch = {}
      if (block === true) patch.blocked_nicknames = [...new Set([...(session.blocked_nicknames ?? []), player.nickname.toLowerCase()])]
      // Someone leaving means the lobby is no longer full, so a running "full lobby" countdown stops.
      if (session.full_at) {
        const { count } = await supabaseAdmin.from('quiz_players').select('id', { count: 'exact', head: true }).eq('session_id', sessionId)
        if ((count ?? 0) < (session.max_players ?? Infinity)) patch.full_at = null
      }
      if (Object.keys(patch).length === 0) {
        await log({ nickname: player.nickname, blocked: false })
        res.status(200).json({ session })
        return
      }
      return done(patch, { nickname: player.nickname, blocked: block === true })
    }

    // rename: swap in a neutral "Player 123" name
    for (let attempt = 0; attempt < 6; attempt++) {
      const nickname = `Player ${pickNumber()}`
      const { data, error } = await supabaseAdmin.from('quiz_players').update({ nickname }).eq('id', playerId).select('id, nickname').maybeSingle()
      if (!error) {
        await log({ from: player.nickname, to: nickname })
        res.status(200).json({ player: data })
        return
      }
      if (error.code !== '23505') return fail(error, 'Could not rename the player')
    }
    res.status(503).json({ error: 'Could not find a free name. Try again.' })
  }
}

export default createQuizHostHandler(getSupabaseAdmin)
