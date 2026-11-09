import { getSupabaseAdmin } from '../supabaseAdmin.js'
import { logError } from '../logError.js'
import { sanitizeGameOptions } from '../quiz.js'
import { compareListed, isListed, startsInMs, LIST_LIMIT } from '../quizSchedule.js'

// The quizzes anyone can walk into. Public and unauthenticated: /play is a phone with no account, and the list is
// the only thing that tells it a game exists.
//
// A handler rather than a table read because the session row carries the code and the state but not the quiz's
// title, and `quizzes` is admin-only under RLS. No player name is ever in this payload -- a count is all a card
// needs, and the least a public endpoint should say.
const MAX_ROWS = 60

export function createQuizOpenHandler(getClient, { now = () => Date.now() } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const supabaseAdmin = getClient()
    const { data: rows, error } = await supabaseAdmin
      .from('quiz_sessions')
      .select('id, quiz_id, join_code, state, scheduled_at, lobby_start_at, max_players, game_options, autopilot')
      .eq('open_join', true)
      .neq('state', 'finished')
      .limit(MAX_ROWS)
    if (error) {
      console.error('quiz-open: session read failed', error)
      await logError(supabaseAdmin, 'quiz-open', error, 500)
      res.status(500).json({ error: 'Could not read the open games' })
      return
    }

    const nowMs = now()
    const listed = (rows ?? []).filter((row) => isListed(row, nowMs)).sort(compareListed).slice(0, LIST_LIMIT)
    if (listed.length === 0) {
      res.status(200).json({ serverNow: nowMs, sessions: [] })
      return
    }

    const ids = listed.map((row) => row.id)
    const [{ data: quizzes }, { data: players }] = await Promise.all([
      supabaseAdmin.from('quizzes').select('id, title').in('id', [...new Set(listed.map((row) => row.quiz_id))]),
      supabaseAdmin.from('quiz_players').select('session_id').in('session_id', ids),
    ])
    const titleById = new Map((quizzes ?? []).map((q) => [q.id, q.title]))
    const countBySession = new Map()
    for (const player of players ?? []) countBySession.set(player.session_id, (countBySession.get(player.session_id) ?? 0) + 1)

    res.status(200).json({
      serverNow: nowMs,
      sessions: listed.map((row) => ({
        id: row.id,
        title: titleById.get(row.quiz_id) ?? 'Quiz',
        joinCode: row.join_code,
        state: row.state,
        scheduledAt: row.scheduled_at,
        // Milliseconds to the start, counted from `serverNow`, so a phone with a wrong clock still shows the right
        // countdown by subtracting what has passed since it fetched.
        startsInMs: startsInMs(row, nowMs),
        players: countBySession.get(row.id) ?? 0,
        maxPlayers: row.max_players,
        lateJoin: sanitizeGameOptions(row.game_options).late_join !== false,
        autopilot: row.autopilot === true,
      })),
    })
  }
}

export default createQuizOpenHandler(getSupabaseAdmin)
