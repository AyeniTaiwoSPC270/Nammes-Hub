import { getSupabaseAdmin } from '../supabaseAdmin.js'
import { hashToken, rankPlayers, createRateLimiter } from '../quiz.js'

const TOP_N = 10

// What a player's phone shows right now. The correct answer is only included once the game is on the
// reveal step (or later), never while a question is still open.
export function createQuizStateHandler(getClient, { now = () => Date.now(), allow = createRateLimiter({ max: 60, windowMs: 60_000 }) } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    const { token } = req.body ?? {}
    if (typeof token !== 'string' || !token) {
      res.status(400).json({ error: 'token is required' })
      return
    }
    const tokenHash = hashToken(token)
    if (!allow(tokenHash)) {
      res.status(429).json({ error: 'Slow down' })
      return
    }

    const supabaseAdmin = getClient()
    const { data: tokenRow } = await supabaseAdmin
      .from('quiz_player_tokens')
      .select('player_id')
      .eq('token_hash', tokenHash)
      .maybeSingle()
    if (!tokenRow) {
      res.status(401).json({ error: 'Unknown player. Rejoin the game.' })
      return
    }
    const { data: player } = await supabaseAdmin
      .from('quiz_players')
      .select('id, session_id, nickname')
      .eq('id', tokenRow.player_id)
      .maybeSingle()
    const { data: session } = player
      ? await supabaseAdmin.from('quiz_sessions').select('*').eq('id', player.session_id).maybeSingle()
      : { data: null }
    if (!session) {
      res.status(404).json({ error: 'Game not found' })
      return
    }

    const [{ data: players }, { count: questionCount }] = await Promise.all([
      supabaseAdmin.from('quiz_players').select('id, nickname, total_score, avatar_id').eq('session_id', session.id),
      supabaseAdmin.from('quiz_questions').select('id', { count: 'exact', head: true }).eq('quiz_id', session.quiz_id),
    ])
    const ranked = rankPlayers(players ?? [])
    const me = ranked.find((p) => p.id === player.id)

    const out = {
      serverNow: now(),
      session: {
        state: session.state,
        index: session.current_question_index,
        questionCount: questionCount ?? 0,
        startedAt: session.question_started_at,
        maxPlayers: session.max_players,
        fullAt: session.full_at ?? null,
      },
      me: { nickname: player.nickname, score: me?.total_score ?? 0, rank: me?.rank ?? null, avatarId: me?.avatar_id ?? 0 },
      playerCount: ranked.length,
    }

    if (['question', 'reveal', 'leaderboard'].includes(session.state)) {
      const { data: question } = await supabaseAdmin
        .from('quiz_questions')
        .select('id, text, options, correct_index, time_limit_seconds')
        .eq('quiz_id', session.quiz_id)
        .eq('position', session.current_question_index)
        .maybeSingle()
      if (question) {
        const { data: answer } = await supabaseAdmin
          .from('quiz_answers')
          .select('chosen_index, points_awarded')
          .eq('player_id', player.id)
          .eq('question_id', question.id)
          .maybeSingle()
        out.question = {
          text: question.text,
          options: question.options,
          timeLimitSeconds: question.time_limit_seconds,
          answered: Boolean(answer),
          // Only this player's own pick, so a phone that reloads mid-question still shows what it chose.
          chosenIndex: answer ? answer.chosen_index : null,
        }
        if (session.state !== 'question') {
          out.reveal = {
            correctIndex: question.correct_index,
            chosenIndex: answer ? answer.chosen_index : null,
            pointsAwarded: answer ? answer.points_awarded : 0,
          }
        }
      }
    }
    if (session.state === 'leaderboard' || session.state === 'finished') out.top = ranked.slice(0, TOP_N)

    res.status(200).json(out)
  }
}

export default createQuizStateHandler(getSupabaseAdmin)
