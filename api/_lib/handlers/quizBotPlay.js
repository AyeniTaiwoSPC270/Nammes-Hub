import {
  effectiveElapsedMs, questionLimitMs, scoreAnswer, gradeAnswer, computeAward, isComeback, sanitizeGameOptions, ANSWER_GRACE_MS,
} from '../quiz.js'
import { botDecision } from '../quizBots.js'
import { currentQuestion } from '../quizSessionQuestions.js'

// Test bots answer by themselves. This used to live inside the host page's `botsPlay` op, which meant a bot only ever
// answered while somebody had the projector screen open. An open quiz has no host page at all, so the same job is now
// offered to the player poll (`quiz-state`), which is the engine that is actually running during a hostless game.
//
// Every question's answers are fixed by the bot's id (see quizBots.js), so calling this twice, or once per phone in
// the room, changes nothing: a bot that has already answered is filtered out below, and the record RPC refuses a
// second answer to the same question.
// The instant a server-side caller should ask at. Both autopilot engines can arrive after the question has already
// closed -- the tick is up to a minute late, and a phone coming back to the tab can be hours late -- and `playBots`
// rightly refuses an answer after the grace window. Bots are timed from `question_started_at` and their score comes
// from their think time, so the question's deadline is the honest instant to play them at: their turns are the ones
// they would have taken while it was open, not answers invented now.
//
export function botTurnAt(session, question, nowMs) {
  const startMs = Date.parse(session?.question_started_at ?? '')
  if (!question || !Number.isFinite(startMs)) return nowMs
  return Math.min(nowMs, startMs + questionLimitMs(session, question) + ANSWER_GRACE_MS)
}

export async function playBots(supabaseAdmin, session, { nowMs = Date.now(), question: known = null, bots: knownBots = null } = {}) {
  if (!session || session.state !== 'question' || session.paused_at) return { answered: 0, nextInMs: null }

  // A caller that already has the roster passes the bot rows in, which is one read less on the per-phone poll path.
  let bots = knownBots
  if (bots == null) {
    const { data } = await supabaseAdmin
      .from('quiz_players')
      .select('id, streak, bot_skill')
      .eq('session_id', session.id)
      .not('bot_skill', 'is', null)
    bots = data ?? []
  }
  if (bots.length === 0) return { answered: 0, nextInMs: null }

  // The caller usually has the question already (the clock branch of quiz-state fetches it), so it is passed in.
  const question = known ?? (await currentQuestion(supabaseAdmin, session))
  if (!question) return { answered: 0, nextInMs: null }

  const elapsedMs = effectiveElapsedMs(session, nowMs)
  const limitMs = questionLimitMs(session, question)
  // A late call is a no-op rather than a burst of answers after the reveal: the question is already marked up.
  if (elapsedMs > limitMs + ANSWER_GRACE_MS) return { answered: 0, nextInMs: null }

  const { data: answeredRows } = await supabaseAdmin
    .from('quiz_answers')
    .select('player_id, points_awarded')
    .eq('question_id', question.id)
  const answeredIds = new Set((answeredRows ?? []).map((a) => a.player_id))
  const pending = bots
    .filter((b) => !answeredIds.has(b.id))
    .map((bot) => ({ bot, decision: botDecision({ botId: bot.id, skill: bot.bot_skill, question, limitMs }) }))
  const due = pending.filter(({ decision }) => decision.thinkMs <= elapsedMs)
  // When the next bot is due, so the caller can time a poll to it. Without this a bot that has finished thinking still
  // waits up to a full poll interval to answer, which is most of why the bots looked slow in a hostless game.
  const waiting = pending.filter(({ decision }) => decision.thinkMs > elapsedMs)
  const nextInMs = waiting.length === 0 ? null : Math.min(...waiting.map(({ decision }) => decision.thinkMs)) - elapsedMs
  if (due.length === 0) return { answered: 0, nextInMs }

  const options = sanitizeGameOptions(session.game_options)
  let before = null
  if (options.comeback) {
    const { data: players } = await supabaseAdmin.from('quiz_players').select('id, total_score').eq('session_id', session.id)
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
      credit: graded.credit ?? 1,
      streakBefore: bot.streak ?? 0,
      multiplier: question.points_multiplier ?? 1,
      comeback: Boolean(before && graded.correct && isComeback(before, bot.id)),
      options,
    })
    const { data: recorded, error } = await supabaseAdmin.rpc('quiz_record_answer', {
      p_session: session.id,
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
      // The same two arguments the three human-facing call sites send. quiz_record_answer has one signature, and a
      // payload that omits either of these is not one it can resolve at all, so a bot left out here does not score
      // badly, it does not score at all.
      p_order: graded.order ?? null,
      p_credit: graded.credit ?? null,
    })
    if (error) console.error('quiz-bot-play: bot answer failed', error)
    return !error && recorded === true
  }))

  return { answered: results.filter(Boolean).length, nextInMs }
}
