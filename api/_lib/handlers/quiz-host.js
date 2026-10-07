import { getSupabaseAdmin } from '../supabaseAdmin.js'
import { logError } from '../logError.js'
import { getCaller, bearerToken } from '../authz.js'
import { isUuid } from '../validate.js'
import {
  stepUpdate, EXTEND_STEP_MS, MAX_EXTEND_MS, effectiveElapsedMs, questionLimitMs, scoreAnswer, gradeAnswer, computeAward,
  isComeback, sanitizeGameOptions, ANSWER_GRACE_MS, DEFAULT_MAX_PLAYERS, AVATAR_COUNT,
} from '../quiz.js'
import { botDecision, botNicknames, skillForBot, BOT_SKILL_CHOICES, MAX_BOTS_AT_ONCE } from '../quizBots.js'
import { BRACKET_LENGTHS, isRoundEnd, roundOfQuestion, fitsBracketLength, bracketLengthsThatFit } from '../quizBracket.js'
import { settleRound } from '../quizBracketEngine.js'
import { sessionQuestionIds, currentQuestion } from '../quizSessionQuestions.js'

const OPS = ['kick', 'lock', 'unlock', 'pause', 'resume', 'extend', 'skip', 'rename', 'addBots', 'removeBots', 'botsPlay', 'setBracket', 'end']
const STEP_OPS = ['pause', 'resume', 'extend', 'skip', 'botsPlay']
const GUARDED_OPS = [...STEP_OPS, 'end'] // ops that say which step they mean

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
    const { sessionId, op, playerId, block, expectedState, expectedIndex, count, skill, enabled, length, botSkill } = req.body ?? {}
    if (!isUuid(sessionId) || !OPS.includes(op)) {
      res.status(400).json({ error: 'sessionId and a valid op are required' })
      return
    }
    if ((op === 'kick' || op === 'rename') && !isUuid(playerId)) {
      res.status(400).json({ error: 'playerId is required' })
      return
    }
    if (GUARDED_OPS.includes(op) && (typeof expectedState !== 'string' || !Number.isInteger(expectedIndex))) {
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

    // End the game now, from any step after the lobby: everyone sees the final results, and the report keeps what was played.
    if (op === 'end') {
      if (session.state !== expectedState || session.current_question_index !== expectedIndex) {
        res.status(409).json({ error: 'The game has already moved on', session })
        return
      }
      if (session.state === 'lobby') {
        res.status(409).json({ error: 'Nothing has been played yet. Delete the game instead.', session })
        return
      }
      return done(
        { state: 'finished', finished_at: nowIso, paused_at: null, ...(session.bracket_mode && !session.bracket_done ? { bracket_done: true } : {}) },
        { endedAt: session.state, index: session.current_question_index },
      )
    }

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
      const questionIds = await sessionQuestionIds(supabaseAdmin, session)
      const count = questionIds.length
      const currentId = questionIds[session.current_question_index] ?? null
      if (currentId) {
        const { error } = await supabaseAdmin.rpc('quiz_skip_question', { p_session: sessionId, p_question: currentId })
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
      // Skipping the last question of a bracket round still has to settle the round.
      if (session.bracket_mode && isRoundEnd(expectedIndex, session.bracket_length)) {
        try {
          await settleRound(supabaseAdmin, updated, roundOfQuestion(expectedIndex, session.bracket_length), nowIso)
        } catch (bracketError) {
          console.error('quiz-host: bracket step failed', bracketError)
          await logError(supabaseAdmin, 'quiz-host', bracketError, 500)
        }
      }
      res.status(200).json({ session: updated })
      return
    }

    // Turn the knockout bracket on or off (lobby only).
    if (op === 'setBracket') {
      if (session.state !== 'lobby') {
        res.status(409).json({ error: 'The bracket can only be set up in the lobby', session })
        return
      }
      const on = enabled === true
      const size = Number(length ?? session.bracket_length)
      const botLevel = botSkill ?? session.bracket_bot_skill
      if (!BRACKET_LENGTHS.includes(size) || !BOT_SKILL_CHOICES.includes(botLevel)) {
        res.status(400).json({ error: 'Pick a match length of 1, 3 or 5 questions and a bot level' })
        return
      }
      if (on) {
        if (session.team_mode) {
          res.status(409).json({ error: 'A team game cannot also be a bracket', session })
          return
        }
        const questionCount = (await sessionQuestionIds(supabaseAdmin, session)).length
        const { count: playerCount } = await supabaseAdmin
          .from('quiz_players')
          .select('id', { count: 'exact', head: true })
          .eq('session_id', sessionId)
        // Not "is there a match worth having" but "will this get down to one player". A bracket that runs out of
        // questions early crowns the highest scorer overall rather than a winner by elimination, which is not what a host
        // asking for a knockout expects. The lobby only offers lengths that pass this.
        if (!fitsBracketLength(playerCount, questionCount, size)) {
          const fitting = bracketLengthsThatFit(playerCount, questionCount)
          res.status(409).json({
            error: fitting.length > 0
              ? `This game draws ${questionCount} questions, which is not enough for matches of ${size} to knock ${playerCount} players down to one. Use ${fitting.map((n) => (n === 1 ? '1 question' : `${n} questions`)).join(' or ')} a match.`
              : `This game draws ${questionCount} questions, which is too few for any bracket with ${playerCount} players. Ask for more questions first.`,
            session,
          })
          return
        }
      }
      return done({ bracket_mode: on, bracket_length: size, bracket_bot_skill: botLevel }, { bracket: on, length: size, botSkill: botLevel })
    }

    // ---- Test bots ----
    if (op === 'addBots') {
      const wanted = Number(count)
      if (!Number.isInteger(wanted) || wanted < 1 || wanted > MAX_BOTS_AT_ONCE || !BOT_SKILL_CHOICES.includes(skill)) {
        res.status(400).json({ error: `Pick 1 to ${MAX_BOTS_AT_ONCE} bots and a skill level` })
        return
      }
      if (session.state !== 'lobby') {
        res.status(409).json({ error: 'Bots can only be added while the lobby is open', session })
        return
      }
      const { data: existing } = await supabaseAdmin.from('quiz_players').select('id, nickname').eq('session_id', sessionId)
      const free = (session.max_players ?? DEFAULT_MAX_PLAYERS) - (existing ?? []).length
      if (free <= 0) {
        res.status(409).json({ error: 'The lobby is full', session })
        return
      }
      const added = Math.min(wanted, free)
      const names = botNicknames(added, [...(existing ?? []).map((p) => p.nickname), ...(session.blocked_nicknames ?? [])])
      const offset = (existing ?? []).length
      const rows = names.map((nickname, i) => ({
        session_id: sessionId, nickname, avatar_id: (offset + i * 7 + 2) % AVATAR_COUNT, bot_skill: skillForBot(skill, offset + i),
      }))
      const { data: made, error } = await supabaseAdmin.from('quiz_players').insert(rows).select('id')
      if (error) return fail(error, 'Could not add the bots')
      if (session.team_mode) {
        // In team mode the bots are spread over the teams one at a time, like "put me anywhere" joins.
        for (const row of made ?? []) {
          const { data: team, error: teamError } = await supabaseAdmin.rpc('quiz_assign_auto_team', { p_session: sessionId, p_player: row.id })
          if (teamError || !team) {
            await supabaseAdmin.from('quiz_players').delete().in('id', (made ?? []).map((m) => m.id))
            return fail(teamError ?? new Error('no team'), 'Could not add the bots')
          }
        }
      }
      await log({ added, skill })
      res.status(200).json({ added, session })
      return
    }

    if (op === 'removeBots') {
      if (session.state !== 'lobby') {
        res.status(409).json({ error: 'Bots can only be removed while the lobby is open', session })
        return
      }
      const { data: gone, error } = await supabaseAdmin.from('quiz_players').delete().eq('session_id', sessionId).not('bot_skill', 'is', null).select('id')
      if (error) return fail(error, 'Could not remove the bots')
      const removed = (gone ?? []).length
      const patch = session.full_at ? { full_at: null } : null
      await log({ removed })
      if (patch) {
        const updated = await save(patch)
        if (!updated) return
        res.status(200).json({ removed, session: updated })
        return
      }
      res.status(200).json({ removed, session })
      return
    }

    // The host page asks about once a second; every bot whose thinking time has passed answers the open question.
    // What a bot answers and when is fixed by its id (see quizBots.js), so asking again never changes anything.
    if (op === 'botsPlay') {
      if (session.paused_at) {
        res.status(200).json({ answered: 0 })
        return
      }
      const { data: bots } = await supabaseAdmin.from('quiz_players').select('id, streak, bot_skill').eq('session_id', sessionId).not('bot_skill', 'is', null)
      if ((bots ?? []).length === 0) {
        res.status(200).json({ answered: 0 })
        return
      }
      const question = await currentQuestion(supabaseAdmin, session)
      if (!question) {
        res.status(200).json({ answered: 0 })
        return
      }
      const elapsedMs = effectiveElapsedMs(session, now().getTime())
      const limitMs = questionLimitMs(session, question)
      if (elapsedMs > limitMs + ANSWER_GRACE_MS) {
        res.status(200).json({ answered: 0 })
        return
      }
      const { data: answeredRows } = await supabaseAdmin.from('quiz_answers').select('player_id, points_awarded').eq('question_id', question.id)
      const answeredIds = new Set((answeredRows ?? []).map((a) => a.player_id))
      const due = bots
        .filter((b) => !answeredIds.has(b.id))
        .map((bot) => ({ bot, decision: botDecision({ botId: bot.id, skill: bot.bot_skill, question, limitMs }) }))
        .filter(({ decision }) => decision.thinkMs <= elapsedMs)
      if (due.length === 0) {
        res.status(200).json({ answered: 0 })
        return
      }

      const options = sanitizeGameOptions(session.game_options)
      let before = null
      if (options.comeback) {
        const { data: players } = await supabaseAdmin.from('quiz_players').select('id, total_score').eq('session_id', sessionId)
        const gained = new Map((answeredRows ?? []).map((a) => [a.player_id, a.points_awarded]))
        before = new Map((players ?? []).map((p) => [p.id, p.total_score - (gained.get(p.id) ?? 0)]))
      }
      const results = await Promise.all(due.map(async ({ bot, decision }) => {
        const graded = gradeAnswer(question, decision.submission)
        if (!graded.ok) return false
        const base = scoreAnswer({ correct: graded.correct === true, points: question.points, timeLimitSeconds: limitMs / 1000, elapsedMs: decision.thinkMs })
        const award = computeAward({
          correct: graded.correct,
          base,
          streakBefore: bot.streak ?? 0,
          multiplier: question.points_multiplier ?? 1,
          comeback: Boolean(before && graded.correct && isComeback(before, bot.id)),
          options,
        })
        const { data: recorded, error } = await supabaseAdmin.rpc('quiz_record_answer', {
          p_session: sessionId,
          p_player: bot.id,
          p_question: question.id,
          p_index: session.current_question_index,
          p_chosen: graded.chosenIndex,
          p_points: award.points,
          p_bonus: award.bonus,
          p_correct: graded.correct,
          p_text: graded.answerText,
          p_powerup: null,
          p_streak: award.streakAfter,
          p_elapsed: decision.thinkMs,
        })
        if (error) console.error('quiz-host: bot answer failed', error)
        return !error && recorded === true
      }))
      res.status(200).json({ answered: results.filter(Boolean).length })
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
