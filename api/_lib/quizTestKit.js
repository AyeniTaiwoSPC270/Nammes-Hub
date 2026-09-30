// Shared test doubles for the live quiz handlers: a tiny in-memory stand-in for the Supabase client and a fake response.

export const QUIZ = '11111111-1111-4111-8111-111111111111'
export const ADMIN = '22222222-2222-4222-8222-222222222222'
export const SESSION = '33333333-3333-4333-8333-333333333333'

export function fakeRes() {
  const res = { statusCode: null, body: null, headers: {} }
  res.status = (c) => { res.statusCode = c; return res }
  res.json = (b) => { res.body = b; return res }
  res.setHeader = (k, v) => { res.headers[k] = v }
  return res
}

// A tiny in-memory stand-in for the parts of the Supabase client these handlers use.
export function fakeDb(seed = {}) {
  const tables = {
    admins: [{ user_id: ADMIN, is_owner: true }],
    feature_flags: [],
    quizzes: [{ id: QUIZ, max_players: 40 }],
    quiz_questions: [
      { id: 'q1', quiz_id: QUIZ, position: 0, text: 'Q1?', options: ['a', 'b', 'c'], correct_index: 1, time_limit_seconds: 20, points: 1000 },
      { id: 'q2', quiz_id: QUIZ, position: 1, text: 'Q2?', options: ['a', 'b'], correct_index: 0, time_limit_seconds: 10, points: 1000 },
    ],
    quiz_sessions: [],
    quiz_players: [],
    quiz_player_tokens: [],
    quiz_answers: [],
    quiz_host_log: [],
    quiz_powerup_uses: [],
    quiz_teams: [],
    quiz_practice_runs: [],
    quiz_practice_answers: [],
    quiz_bracket_matches: [],
    quiz_battles: [],
    quiz_battle_sides: [],
    quiz_battle_answers: [],
    quiz_battle_ratings: [],
    ...seed,
  }
  let n = 0
  const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`
  const uniqueViolation = (table, row) => {
    if (table === 'quiz_players') return tables.quiz_players.some((p) => p.session_id === row.session_id && p.nickname.toLowerCase() === row.nickname.toLowerCase())
    if (table === 'quiz_sessions') return tables.quiz_sessions.some((s) => s.join_code === row.join_code && s.state !== 'finished')
    if (table === 'quiz_bracket_matches') return tables.quiz_bracket_matches.some((m) => m.session_id === row.session_id && m.round === row.round && m.slot === row.slot)
    if (table === 'quiz_battles') return tables.quiz_battles.some((b) => b.code === row.code)
    if (table === 'quiz_battle_ratings') return tables.quiz_battle_ratings.some((r) => r.tag_hash === row.tag_hash)
    if (table === 'quiz_battle_sides') return tables.quiz_battle_sides.some((s) => (s.battle_id === row.battle_id && s.slot === row.slot) || (row.token_hash && s.token_hash === row.token_hash))
    if (table === 'quiz_powerup_uses') return tables.quiz_powerup_uses.some((u) => u.player_id === row.player_id && u.question_id === row.question_id)
    return false
  }

  function query(table) {
    const filters = []
    let op = 'select'
    let payload = null
    let head = false
    let selectAfter = false
    let limitN = Infinity
    const run = () => {
      const match = (r) =>
        filters.every(([kind, col, val]) => (kind === 'eq' ? r[col] === val : kind === 'is' ? r[col] == null : kind === 'notnull' ? r[col] != null : kind === 'in' ? val.includes(r[col]) : kind === 'gte' ? r[col] >= val : kind === 'gt' ? r[col] > val : r[col] !== val))
      const rows = tables[table].filter(match)
      if (op === 'insert' && Array.isArray(payload)) {
        const made = payload.map((p) => ({ id: uid(), ...(table === 'quiz_players' ? { total_score: 0, streak: 0 } : {}), ...p }))
        tables[table].push(...made)
        return { rows: made }
      }
      if (op === 'insert') {
        if (uniqueViolation(table, payload)) return { rows: [], error: { code: '23505' } }
        const row = { id: uid(), ...payload }
        if (table === 'quiz_sessions') Object.assign(row, { state: 'lobby', current_question_index: -1, question_started_at: null, finished_at: null })
        if (table === 'quiz_players') row.total_score = 0
        if (table === 'quiz_practice_runs') Object.assign(row, { total_score: 0, finished_at: null })
        if (table === 'quiz_battle_sides') Object.assign(row, { finished_at: null, bot_skill: null, ...payload })
        if (table === 'quiz_battles') Object.assign(row, { winner_slot: null, question_started_at: null, reveal_started_at: null, bot_skill: null, rated: false, ...payload })
        tables[table].push(row)
        return { rows: [row] }
      }
      if (op === 'update') {
        if (table === 'quiz_players' && payload.nickname && rows.some((r) => tables.quiz_players.some((o) => o !== r && o.session_id === r.session_id && o.nickname.toLowerCase() === payload.nickname.toLowerCase()))) {
          return { rows: [], error: { code: '23505' } }
        }
        rows.forEach((r) => Object.assign(r, payload))
        return { rows }
      }
      if (op === 'delete') {
        tables[table] = tables[table].filter((r) => !match(r))
        if (table === 'quiz_battles') {
          const gone = new Set(rows.map((r) => r.id))
          tables.quiz_battle_sides = tables.quiz_battle_sides.filter((s) => !gone.has(s.battle_id))
          tables.quiz_battle_answers = tables.quiz_battle_answers.filter((a) => !gone.has(a.battle_id))
        }
        // Deleting a player also removes their token and answers (on delete cascade in the real database).
        if (table === 'quiz_players') {
          const gone = new Set(rows.map((r) => r.id))
          tables.quiz_player_tokens = tables.quiz_player_tokens.filter((t) => !gone.has(t.player_id))
          tables.quiz_answers = tables.quiz_answers.filter((a) => !gone.has(a.player_id))
        }
        return { rows }
      }
      return { rows: rows.slice(0, limitN) }
    }
    const api = {
      select: (_cols, opts) => { if (op === 'select') { head = Boolean(opts?.head) } else selectAfter = true; api.count = opts?.count; return api },
      insert: (p) => { op = 'insert'; payload = p; return api },
      update: (p) => { op = 'update'; payload = p; return api },
      delete: () => { op = 'delete'; return api },
      eq: (c, v) => { filters.push(['eq', c, v]); return api },
      neq: (c, v) => { filters.push(['neq', c, v]); return api },
      in: (c, v) => { filters.push(['in', c, v]); return api },
      gte: (c, v) => { filters.push(['gte', c, v]); return api },
      gt: (c, v) => { filters.push(['gt', c, v]); return api },
      is: (c) => { filters.push(['is', c]); return api },
      not: (c) => { filters.push(['notnull', c]); return api },
      order: () => api,
      limit: (n) => { limitN = n; return api },
      maybeSingle: async () => { const r = run(); return { data: r.rows[0] ?? null, error: r.error ?? null } },
      single: async () => { const r = run(); return { data: r.rows[0] ?? null, error: r.error ?? null } },
      then: (resolve) => {
        const r = run()
        resolve(head || api.count ? { data: r.rows, count: r.rows.length, error: r.error ?? null } : { data: r.rows, error: r.error ?? null })
      },
    }
    void selectAfter
    return api
  }

  const client = {
    tables,
    auth: { getUser: async (t) => (t === 'good' ? { data: { user: { id: ADMIN } }, error: null } : { data: null, error: { message: 'bad' } }) },
    from: (t) => query(t),
    rpc: async (name, a) => {
      if (name === 'quiz_assign_auto_team') {
        const teams = tables.quiz_teams.filter((t) => t.session_id === a.p_session).sort((x, y) => x.position - y.position)
        const count = (t) => tables.quiz_players.filter((p) => p.team_id === t.id && p.id !== a.p_player).length
        const pick = [...teams].sort((x, y) => count(x) - count(y) || x.position - y.position)[0]
        if (!pick) return { data: null, error: null }
        tables.quiz_players.find((p) => p.id === a.p_player).team_id = pick.id
        return { data: pick.id, error: null }
      }
      if (name === 'quiz_practice_cleanup' || name === 'quiz_battle_cleanup') return { data: 0, error: null }
      if (name === 'quiz_battle_record') {
        if (tables.quiz_battle_answers.some((x) => x.battle_id === a.p_battle && x.slot === a.p_slot && x.question_id === a.p_question)) return { data: false, error: null }
        tables.quiz_battle_answers.push({ battle_id: a.p_battle, slot: a.p_slot, question_id: a.p_question, chosen_index: a.p_chosen, answer_text: a.p_text, correct: a.p_correct, points_awarded: a.p_points, elapsed_ms: a.p_elapsed })
        tables.quiz_battle_sides.find((s) => s.battle_id === a.p_battle && s.slot === a.p_slot).total_score += a.p_points
        return { data: true, error: null }
      }
      if (name === 'quiz_practice_record') {
        if (tables.quiz_practice_answers.some((x) => x.run_id === a.p_run && x.question_id === a.p_question)) return { data: false, error: null }
        tables.quiz_practice_answers.push({ run_id: a.p_run, question_id: a.p_question, chosen_index: a.p_chosen, answer_text: a.p_text, correct: a.p_correct, points_awarded: a.p_points })
        tables.quiz_practice_runs.find((r) => r.id === a.p_run).total_score += a.p_points
        return { data: true, error: null }
      }
      if (name === 'quiz_skip_question') {
        const dropped = tables.quiz_answers.filter((x) => x.session_id === a.p_session && x.question_id === a.p_question)
        for (const d of dropped) tables.quiz_players.find((p) => p.id === d.player_id).total_score -= d.points_awarded
        tables.quiz_answers = tables.quiz_answers.filter((x) => !dropped.includes(x))
        return { data: dropped.length, error: null }
      }
      if (name !== 'quiz_record_answer') return { data: null, error: { message: 'unknown' } }
      const s = tables.quiz_sessions.find((x) => x.id === a.p_session)
      if (!s || s.state !== 'question' || s.current_question_index !== a.p_index) return { data: false, error: null }
      if (tables.quiz_answers.some((x) => x.player_id === a.p_player && x.question_id === a.p_question)) return { data: false, error: null }
      tables.quiz_answers.push({
        session_id: a.p_session, player_id: a.p_player, question_id: a.p_question, chosen_index: a.p_chosen, points_awarded: a.p_points,
        bonus_points: a.p_bonus ?? 0, correct: a.p_correct ?? null, answer_text: a.p_text ?? null, powerup: a.p_powerup ?? null, elapsed_ms: a.p_elapsed ?? null,
      })
      const who = tables.quiz_players.find((p) => p.id === a.p_player)
      who.total_score += a.p_points
      if (a.p_streak !== undefined) who.streak = a.p_streak
      return { data: true, error: null }
    },
  }
  return client
}

export const admin = (body, method = 'POST') => ({ method, headers: { authorization: 'Bearer good' }, body })
export const anon = (body, method = 'POST') => ({ method, headers: {}, body })

