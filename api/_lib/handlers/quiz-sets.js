import { getSupabaseAdmin } from '../supabaseAdmin.js'
import { logError } from '../logError.js'
import { newPlayerToken, hashToken, createRateLimiter, clientIp } from '../quiz.js'
import { generateBattleCode, isBattleCode } from '../quizBattle.js'
import { sanitizeCustomQuestions, cleanTitle, CUSTOM_DAYS } from '../quizCustom.js'

// Community question sets: anyone can import their own questions and play them in practice and battles, no account needed.
// A set is stored as a normal quiz marked `is_custom`, found by a private 6-character code, and removed after 30 days.
// It never appears in the admin quiz list or the public practice and battle lists. The person who made it gets a secret
// that lets them delete it early; only its hash is stored.
//
// One route with an `op`: create, info, remove.
const OPS = ['create', 'info', 'remove']
const MAX_ACTIVE_SETS = 500

export function createQuizSetsHandler(
  getClient,
  {
    now = () => Date.now(),
    allowCreate = createRateLimiter({ max: 5, windowMs: 60 * 60_000 }),
    allow = createRateLimiter({ max: 60, windowMs: 60_000 }),
    cleanupChance = 0.05,
    random = Math.random,
  } = {},
) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    const { op, title, questions, code, manageToken } = req.body ?? {}
    if (!OPS.includes(op)) {
      res.status(400).json({ error: 'Unknown request' })
      return
    }
    const ip = clientIp(req)
    if (!allow(`${op}:${ip}`)) {
      res.status(429).json({ error: 'Slow down' })
      return
    }
    const supabaseAdmin = getClient()
    const iso = (ms) => new Date(ms).toISOString()
    const fail = async (error, message) => {
      console.error(`quiz-sets: ${op} failed`, error)
      await logError(supabaseAdmin, 'quiz-sets', error, 500)
      res.status(500).json({ error: message })
    }
    const find = async () => {
      if (!isBattleCode(code)) return null
      const { data } = await supabaseAdmin.from('quizzes').select('id, title, is_custom, expires_at, owner_hash').eq('custom_code', code.toUpperCase()).maybeSingle()
      if (!data || !data.is_custom || (data.expires_at && new Date(data.expires_at).getTime() < now())) return null
      return data
    }

    if (op === 'info') {
      const set = await find()
      if (!set) {
        res.status(404).json({ error: 'No quiz found with that code. It may have expired.' })
        return
      }
      const { data: rows } = await supabaseAdmin.from('quiz_questions').select('id').eq('quiz_id', set.id)
      res.status(200).json({ quizId: set.id, title: set.title, questionCount: (rows ?? []).length, expiresAt: set.expires_at })
      return
    }

    if (op === 'remove') {
      const set = await find()
      if (!set || typeof manageToken !== 'string' || !set.owner_hash || set.owner_hash !== hashToken(manageToken)) {
        res.status(404).json({ error: 'No quiz found with that code, or you did not make it.' })
        return
      }
      const { error } = await supabaseAdmin.from('quizzes').delete().eq('id', set.id)
      if (error) return fail(error, 'Could not delete the quiz')
      res.status(200).json({ removed: true })
      return
    }

    // create
    if (!allowCreate(ip)) {
      res.status(429).json({ error: 'You have made a lot of quizzes. Try again later.' })
      return
    }
    const checkedTitle = cleanTitle(title)
    if (checkedTitle.error) {
      res.status(400).json({ error: checkedTitle.error })
      return
    }
    const clean = sanitizeCustomQuestions(questions)
    if (clean.problems.length > 0) {
      res.status(400).json({ error: `Question ${clean.problems[0].line}: ${clean.problems[0].message}`, problems: clean.problems })
      return
    }
    const { count } = await supabaseAdmin.from('quizzes').select('id', { count: 'exact', head: true }).eq('is_custom', true)
    if ((count ?? 0) >= MAX_ACTIVE_SETS) {
      res.status(503).json({ error: 'There are too many community quizzes right now. Try again in a few days.' })
      return
    }

    const secret = newPlayerToken()
    const nowMs = now()
    let quiz = null
    let setCode = ''
    for (let attempt = 0; attempt < 6 && !quiz; attempt++) {
      setCode = generateBattleCode(random)
      const { data, error } = await supabaseAdmin
        .from('quizzes')
        .insert({
          title: checkedTitle.title,
          max_players: 2,
          game_options: {},
          theme: {},
          tags: ['community'],
          practice_enabled: true,
          battle_enabled: true,
          is_custom: true,
          custom_code: setCode,
          owner_hash: hashToken(secret),
          expires_at: iso(nowMs + CUSTOM_DAYS * 86_400_000),
        })
        .select('id, expires_at')
        .single()
      if (!error) quiz = data
      else if (error.code !== '23505') return fail(error, 'Could not save your quiz')
    }
    if (!quiz) {
      res.status(503).json({ error: 'Could not make a code. Try again.' })
      return
    }
    const rows = clean.questions.map((q, position) => ({ id: crypto.randomUUID(), quiz_id: quiz.id, position, ...q }))
    const { error: questionError } = await supabaseAdmin.from('quiz_questions').insert(rows)
    if (questionError) {
      await supabaseAdmin.from('quizzes').delete().eq('id', quiz.id)
      return fail(questionError, 'Could not save your quiz')
    }
    if (random() < cleanupChance) await supabaseAdmin.rpc('quiz_custom_cleanup') // housekeeping, best effort
    res.status(200).json({ quizId: quiz.id, code: setCode, title: checkedTitle.title, questionCount: rows.length, expiresAt: quiz.expires_at, manageToken: secret })
  }
}

export default createQuizSetsHandler(getSupabaseAdmin)
