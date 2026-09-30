import { getSupabaseAdmin } from '../supabaseAdmin.js'
import { isUuid } from '../validate.js'
import { logError } from '../logError.js'
import {
  validateNickname, isAvatarId, newPlayerToken, hashToken, createRateLimiter, clientIp, gradeAnswer, isChoiceType, correctText,
  ANSWER_GRACE_MS, AVATAR_COUNT,
} from '../quiz.js'
import { sanitizeTheme } from '../quizTheme.js'
import { publicImageUrl } from '../quizImage.js'
import { botDecision, botNicknames, skillForBot, seeded, BOT_SKILL_CHOICES } from '../quizBots.js'
import {
  generateBattleCode, isBattleCode, pickBattleQuestions, battleQuestionPoints, decideWinner, speedOf, headToHead, duelNextStep, presence,
  BATTLE_CHALLENGE_DAYS, DUEL_START_DELAY_MS, DUEL_NEXT_DELAY_MS, DUEL_OPEN_TTL_MS, eloUpdate, RATING_START,
} from '../quizBattle.js'

// Battle mode. Spec: docs/superpowers/specs/2026-10-01-quiz-battle-mode.md
//
// A `challenge` is played by each side on their own time, like practice: the challenger plays first, shares a link, and
// the friend plays the same questions later. A `duel` is played together: both phones get each question at the same server
// time, nobody sees the other's answer until the question closes, and the server moves the duel along as the phones ask
// about it (there is no background timer). A duel can be against a bot.
//
// One route with an `op`: list, info, create, join, state, answer, next. Phones never read the tables.
const OPS = ['list', 'info', 'create', 'join', 'state', 'answer', 'next', 'ranking', 'leave']
const MODES = ['challenge', 'duel']

export function createQuizBattleHandler(
  getClient,
  {
    now = () => Date.now(),
    baseUrl = process.env.VITE_SUPABASE_URL,
    allowCreate = createRateLimiter({ max: 10, windowMs: 60 * 60_000 }),
    allowJoin = createRateLimiter({ max: 15, windowMs: 60_000 }),
    allow = createRateLimiter({ max: 150, windowMs: 60_000 }),
    cleanupChance = 0.02,
    random = Math.random,
  } = {},
) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    const { op, quizId, code, token, nickname, avatarId = 0, mode, vsBot, botSkill = 'average', tag, chosenIndex, answerText, period = 'all' } = req.body ?? {}
    if (!OPS.includes(op)) {
      res.status(400).json({ error: 'Unknown request' })
      return
    }

    const supabaseAdmin = getClient()
    const iso = (ms) => new Date(ms).toISOString()
    const fail = async (error, message) => {
      console.error(`quiz-battle: ${op} failed`, error)
      await logError(supabaseAdmin, 'quiz-battle', error, 500)
      res.status(500).json({ error: message })
    }
    const tagHash = typeof tag === 'string' && tag.length >= 16 && tag.length <= 64 ? hashToken(tag) : null

    // ---- loading ----
    async function enabledQuiz(id) {
      if (!isUuid(id)) return null
      const { data } = await supabaseAdmin.from('quizzes').select('id, title, battle_enabled, theme, expires_at').eq('id', id).maybeSingle()
      const expired = data?.expires_at && new Date(data.expires_at).getTime() < now()
      return data && data.battle_enabled && !expired ? data : null
    }
    async function quizQuestionsFor(id) {
      const { data } = await supabaseAdmin.from('quiz_questions').select('*').eq('quiz_id', id)
      return data ?? []
    }
    async function battleQuestions(battle) {
      const { data } = await supabaseAdmin.from('quiz_questions').select('*').in('id', battle.question_ids)
      const byId = new Map((data ?? []).map((q) => [q.id, q]))
      return battle.question_ids.map((id) => byId.get(id)).filter(Boolean)
    }
    async function sidesOf(battleId) {
      const { data } = await supabaseAdmin.from('quiz_battle_sides').select('*').eq('battle_id', battleId)
      return data ?? []
    }
    async function answersOf(battleId) {
      const { data } = await supabaseAdmin.from('quiz_battle_answers').select('*').eq('battle_id', battleId)
      return data ?? []
    }
    async function battleById(id) {
      const { data } = await supabaseAdmin.from('quiz_battles').select('*').eq('id', id).maybeSingle()
      return data
    }
    const theme = async (quizRow, id) => sanitizeTheme(quizRow?.theme, { quizId: id })

    function questionView(q) {
      const type = q.type ?? 'multiple'
      return {
        type,
        text: q.text,
        options: isChoiceType(type) ? q.options : [],
        timeLimitSeconds: q.time_limit_seconds,
        multiplier: q.points_multiplier ?? 1,
        imageUrl: publicImageUrl(baseUrl, q.image_path, q.quiz_id),
        imageAlt: q.image_alt ?? '',
      }
    }
    function resultFor(q, answer) {
      const type = q.type ?? 'multiple'
      return {
        correct: answer.correct === true,
        pointsAwarded: answer.points_awarded ?? 0,
        chosenIndex: answer.chosen_index ?? null,
        answerText: answer.answer_text ?? null,
        correctIndex: isChoiceType(type) ? q.correct_index : null,
        correctText: correctText(q),
        timedOut: answer.chosen_index == null && answer.answer_text == null,
      }
    }

    // Records the answer a side gives (or a miss, when `graded` is null) with points from the server clock.
    async function record({ battle, side, question, graded, elapsedMs }) {
      const correct = graded ? graded.correct === true : false
      const points = correct ? battleQuestionPoints(question, elapsedMs) : 0
      const { data, error } = await supabaseAdmin.rpc('quiz_battle_record', {
        p_battle: battle.id,
        p_slot: side.slot,
        p_question: question.id,
        p_chosen: graded ? graded.chosenIndex : null,
        p_text: graded ? graded.answerText : null,
        p_correct: correct,
        p_points: points,
        p_elapsed: Math.max(0, Math.round(elapsedMs)),
      })
      return { error, recorded: data === true, correct, points }
    }

    async function finish(battle, sides, answers, { forfeitWinner = null } = {}) {
      const a = sides.find((s) => s.slot === 'a')
      const b = sides.find((s) => s.slot === 'b')
      const winner = forfeitWinner ?? decideWinner(
        { total_score: a?.total_score ?? 0, speedMs: speedOf(answers.filter((x) => x.slot === 'a')) },
        { total_score: b?.total_score ?? 0, speedMs: speedOf(answers.filter((x) => x.slot === 'b')) },
      )
      const { data } = await supabaseAdmin
        .from('quiz_battles')
        .update({ state: 'finished', winner_slot: winner, forfeit: forfeitWinner !== null, finished_at: iso(now()) })
        .eq('id', battle.id)
        .in('state', ['open', 'question', 'reveal'])
        .select('*')
        .maybeSingle()
      if (data) await rateBattle(data, sides)
      return data ?? (await battleById(battle.id))
    }

    // A finished battle between two real players changes both ratings, once. Bots never count.
    async function rateBattle(finished, sides) {
      const a = sides.find((s) => s.slot === 'a')
      const b = sides.find((s) => s.slot === 'b')
      if (!a || !b || a.bot_skill || b.bot_skill || !a.tag_hash || !b.tag_hash || a.tag_hash === b.tag_hash) return
      // Home-made quizzes never count towards the ranking (an easy custom quiz would be too easy to farm).
      const { data: quizRow } = await supabaseAdmin.from('quizzes').select('is_custom').eq('id', finished.quiz_id).maybeSingle()
      if (quizRow?.is_custom) return
      const { data: claimed } = await supabaseAdmin.from('quiz_battles').update({ rated: true }).eq('id', finished.id).eq('rated', false).select('id').maybeSingle()
      if (!claimed) return
      const { data: rows } = await supabaseAdmin.from('quiz_battle_ratings').select('*').in('tag_hash', [a.tag_hash, b.tag_hash])
      const mine = (hash) => (rows ?? []).find((r) => r.tag_hash === hash)
      const next = eloUpdate(mine(a.tag_hash)?.rating ?? RATING_START, mine(b.tag_hash)?.rating ?? RATING_START, finished.winner_slot)
      const outcome = (slot) => (finished.winner_slot === null ? 'draws' : finished.winner_slot === slot ? 'wins' : 'losses')
      for (const [side, rating] of [[a, next.a], [b, next.b]]) {
        const existing = mine(side.tag_hash)
        const field = outcome(side.slot)
        const stamp = iso(now())
        if (existing) {
          await supabaseAdmin.from('quiz_battle_ratings').update({ rating, nickname: side.nickname, avatar_id: side.avatar_id, [field]: existing[field] + 1, updated_at: stamp }).eq('tag_hash', side.tag_hash)
        } else {
          await supabaseAdmin.from('quiz_battle_ratings').insert({ tag_hash: side.tag_hash, nickname: side.nickname, avatar_id: side.avatar_id, rating, wins: 0, losses: 0, draws: 0, [field]: 1, updated_at: stamp })
        }
      }
    }

    // ---- moving a duel along ----
    async function advanceDuel(battle, sides, questions, answers) {
      const nowMs = now()
      if (battle.state === 'open') {
        if (nowMs - new Date(battle.created_at).getTime() > DUEL_OPEN_TTL_MS) {
          const { data } = await supabaseAdmin.from('quiz_battles').update({ state: 'cancelled' }).eq('id', battle.id).eq('state', 'open').select('*').maybeSingle()
          return { battle: data ?? battle, answers }
        }
        return { battle, answers }
      }
      if (battle.state !== 'question' && battle.state !== 'reveal') return { battle, answers }

      // Someone who has stopped responding loses by default.
      const humans = sides.filter((s) => !s.bot_skill)
      const gone = humans.filter((s) => presence(s.last_seen_at, nowMs) === 'gone')
      if (gone.length > 0) {
        if (gone.length === humans.length) {
          const { data } = await supabaseAdmin.from('quiz_battles').update({ state: 'cancelled' }).eq('id', battle.id).in('state', ['question', 'reveal']).select('*').maybeSingle()
          return { battle: data ?? battle, answers }
        }
        const other = sides.find((s) => s.slot !== gone[0].slot)
        return { battle: await finish(battle, sides, answers, { forfeitWinner: other.slot }), answers }
      }

      const question = questions[battle.current_index]
      if (!question) return { battle: await finish(battle, sides, answers), answers }
      const limitMs = question.time_limit_seconds * 1000
      let current = answers

      // A computer opponent answers once it has finished "thinking".
      const botSide = sides.find((s) => s.bot_skill)
      if (botSide && battle.state === 'question' && !current.some((x) => x.slot === botSide.slot && x.question_id === question.id)) {
        const elapsed = nowMs - new Date(battle.question_started_at).getTime()
        const decision = botDecision({ botId: `${battle.id}:${botSide.slot}`, skill: botSide.bot_skill, question, limitMs })
        if (elapsed >= decision.thinkMs) {
          const graded = gradeAnswer(question, decision.submission)
          if (graded.ok) {
            const out = await record({ battle, side: botSide, question, graded, elapsedMs: decision.thinkMs })
            if (out.recorded) current = await answersOf(battle.id)
          }
        }
      }

      const bothAnswered = sides.length === 2 && sides.every((s) => current.some((x) => x.slot === s.slot && x.question_id === question.id))
      const step = duelNextStep({ battle, nowMs, limitMs, bothAnswered, questionCount: questions.length })
      if (step === null) return { battle, answers: current }
      if (step === 'finish') {
        const fresh = await sidesOf(battle.id)
        return { battle: await finish(battle, fresh, current), answers: current }
      }
      const patch = step === 'reveal'
        ? { state: 'reveal', reveal_started_at: iso(nowMs) }
        : { state: 'question', current_index: battle.current_index + 1, question_started_at: iso(nowMs + DUEL_NEXT_DELAY_MS), reveal_started_at: null }
      const { data } = await supabaseAdmin
        .from('quiz_battles')
        .update(patch)
        .eq('id', battle.id)
        .eq('state', battle.state)
        .eq('current_index', battle.current_index)
        .select('*')
        .maybeSingle()
      return { battle: data ?? (await battleById(battle.id)), answers: current }
    }

    // ---- what a seat sees ----
    const oriented = (rows, slot, questions) => rows.map((r) => ({
      questionId: r.questionId,
      text: questions.find((q) => q.id === r.questionId)?.text ?? '',
      mine: slot === 'a' ? r.a : r.b,
      theirs: slot === 'a' ? r.b : r.a,
      winner: r.winner === null ? null : r.winner === slot ? 'me' : 'them',
    }))

    async function view({ battle, sides, questions, answers, me, quiz }) {
      const other = sides.find((s) => s.slot !== me.slot) ?? null
      const total = questions.length
      const base = {
        serverNow: now(),
        code: battle.code,
        mode: battle.mode,
        quizId: battle.quiz_id,
        title: quiz?.title ?? '',
        total,
        theme: await theme(quiz, battle.quiz_id),
        me: { slot: me.slot, nickname: me.nickname, avatarId: me.avatar_id },
        opponent: other ? { nickname: other.nickname, avatarId: other.avatar_id, isBot: Boolean(other.bot_skill) } : null,
      }
      const myAnswers = answers.filter((x) => x.slot === me.slot)
      const theirAnswers = answers.filter((x) => x.slot !== me.slot)

      if (battle.state === 'finished') {
        const rows = headToHead(questions, answers.filter((x) => x.slot === 'a'), answers.filter((x) => x.slot === 'b'))
        const mine = battle.winner_slot === null ? null : battle.winner_slot === me.slot ? 'me' : 'them'
        return {
          ...base,
          state: 'finished',
          me: { ...base.me, score: me.total_score },
          opponent: { ...base.opponent, score: other?.total_score ?? 0 },
          final: { winner: mine, forfeit: battle.forfeit, questions: oriented(rows, me.slot, questions) },
        }
      }
      if (battle.state === 'cancelled') return { ...base, state: 'cancelled', me: { ...base.me, score: me.total_score } }

      if (battle.mode === 'challenge') {
        const settled = me.finished_at || me.current_index >= total
        if (settled) {
          return { ...base, state: 'waiting', me: { ...base.me, score: me.total_score }, opponent: other ? { ...base.opponent, waiting: !other.finished_at } : null }
        }
        const q = questions[me.current_index]
        const answer = myAnswers.find((x) => x.question_id === q.id)
        const out = {
          ...base,
          state: 'question',
          me: { ...base.me, score: me.total_score },
          index: me.current_index,
          startedAt: me.question_started_at,
          question: questionView(q),
        }
        if (answer) out.result = resultFor(q, answer)
        return out
      }

      // duel
      if (battle.state === 'open') return { ...base, state: 'open', opponent: null, me: { ...base.me, score: 0 } }
      const q = questions[battle.current_index]
      const reveal = battle.state === 'reveal'
      // Only finished questions count towards the score bar, so a jump never gives away who answered well.
      const settledCount = reveal ? battle.current_index + 1 : battle.current_index
      const settled = (list) => list.filter((x) => questions.findIndex((qq) => qq.id === x.question_id) < settledCount).reduce((sum, x) => sum + x.points_awarded, 0)
      const out = {
        ...base,
        state: reveal ? 'reveal' : 'question',
        me: { ...base.me, score: settled(myAnswers) },
        opponent: { ...base.opponent, score: settled(theirAnswers), presence: other && !other.bot_skill ? presence(other.last_seen_at, now()) : 'here' },
        index: battle.current_index,
        startsAt: battle.question_started_at,
        question: questionView(q),
        myAnswered: myAnswers.some((x) => x.question_id === q.id),
        opponentAnswered: theirAnswers.some((x) => x.question_id === q.id),
      }
      if (reveal) {
        const mine = myAnswers.find((x) => x.question_id === q.id)
        const theirs = theirAnswers.find((x) => x.question_id === q.id)
        out.reveal = {
          mine: mine ? resultFor(q, mine) : { correct: false, pointsAwarded: 0, chosenIndex: null, answerText: null, correctIndex: isChoiceType(q.type ?? 'multiple') ? q.correct_index : null, correctText: correctText(q), timedOut: true },
          theirs: { correct: theirs?.correct === true, pointsAwarded: theirs?.points_awarded ?? 0, answered: Boolean(theirs) },
        }
      }
      return out
    }

    async function everything(battle, me) {
      const [sides, questions, answers, quizRow] = await Promise.all([
        sidesOf(battle.id),
        battleQuestions(battle),
        answersOf(battle.id),
        supabaseAdmin.from('quizzes').select('id, title, theme').eq('id', battle.quiz_id).maybeSingle().then((r) => r.data),
      ])
      return { sides, questions, answers, quiz: quizRow, me: sides.find((s) => s.slot === me.slot) ?? me }
    }

    async function sideFromToken() {
      if (typeof token !== 'string' || !token) {
        res.status(400).json({ error: 'token is required' })
        return null
      }
      const hash = hashToken(token)
      if (!allow(hash)) {
        res.status(429).json({ error: 'Slow down' })
        return null
      }
      const { data: side } = await supabaseAdmin.from('quiz_battle_sides').select('*').eq('token_hash', hash).maybeSingle()
      if (!side) {
        res.status(401).json({ error: 'Battle not found. Start or join again.' })
        return null
      }
      const battle = await battleById(side.battle_id)
      if (!battle) {
        res.status(404).json({ error: 'That battle is over' })
        return null
      }
      return { side, battle }
    }

    // ---- list: quizzes open for battles ----
    if (op === 'list') {
      const { data: all } = await supabaseAdmin.from('quizzes').select('id, title, theme, is_custom, expires_at').eq('battle_enabled', true)
      // A community set is only listed when asked for by its id (the link someone shared), never to everyone.
      const quizzes = (all ?? []).filter((q) => (!q.is_custom || (q.id === quizId && !(q.expires_at && new Date(q.expires_at).getTime() < now()))))
      const out = []
      for (const q of quizzes) {
        const playable = (await quizQuestionsFor(q.id)).filter((x) => (x.type ?? 'multiple') !== 'poll')
        if (playable.length > 0) out.push({ id: q.id, title: q.title, questionCount: Math.min(playable.length, 10) })
      }
      res.status(200).json({ quizzes: out })
      return
    }

    // ---- ranking: the champions list ----
    if (op === 'ranking') {
      const entry = (r, i) => ({ rank: i + 1, nickname: r.nickname, avatarId: r.avatar_id, rating: r.rating, wins: r.wins, losses: r.losses, draws: r.draws })
      let top
      if (period === 'week') {
        const since = iso(now() - 7 * 86_400_000)
        const { data: battles } = await supabaseAdmin.from('quiz_battles').select('id, winner_slot').eq('state', 'finished').eq('rated', true).gte('finished_at', since).limit(500)
        const { data: sides } = (battles ?? []).length > 0
          ? await supabaseAdmin.from('quiz_battle_sides').select('battle_id, slot, tag_hash').in('battle_id', battles.map((x) => x.id))
          : { data: [] }
        const tally = new Map()
        const bump = (hash, key) => tally.set(hash, { wins: 0, losses: 0, draws: 0, ...tally.get(hash), [key]: (tally.get(hash)?.[key] ?? 0) + 1 })
        for (const battle of battles ?? []) {
          for (const s of (sides ?? []).filter((x) => x.battle_id === battle.id && x.tag_hash)) {
            bump(s.tag_hash, battle.winner_slot === null ? 'draws' : battle.winner_slot === s.slot ? 'wins' : 'losses')
          }
        }
        const hashes = [...tally.keys()]
        const { data: people } = hashes.length > 0 ? await supabaseAdmin.from('quiz_battle_ratings').select('*').in('tag_hash', hashes) : { data: [] }
        top = (people ?? [])
          .map((p) => ({ ...p, ...tally.get(p.tag_hash) }))
          .sort((x, y) => y.wins - x.wins || x.losses - y.losses || y.rating - x.rating)
          .slice(0, 10)
      } else {
        const { data } = await supabaseAdmin.from('quiz_battle_ratings').select('*').order('rating', { ascending: false }).limit(10)
        top = [...(data ?? [])].sort((x, y) => y.rating - x.rating).slice(0, 10)
      }
      let you = null
      if (tagHash) {
        const { data: row } = await supabaseAdmin.from('quiz_battle_ratings').select('*').eq('tag_hash', tagHash).maybeSingle()
        if (row) {
          const { count } = await supabaseAdmin.from('quiz_battle_ratings').select('tag_hash', { count: 'exact', head: true }).gt('rating', row.rating)
          you = { nickname: row.nickname, rating: row.rating, wins: row.wins, losses: row.losses, draws: row.draws, rank: (count ?? 0) + 1 }
        }
      }
      res.status(200).json({ period: period === 'week' ? 'week' : 'all', top: top.map(entry), you })
      return
    }

    // ---- info: what a shared link or code shows before anyone joins ----
    if (op === 'info') {
      if (!isBattleCode(code)) {
        res.status(400).json({ error: 'Enter the 6-character battle code' })
        return
      }
      const { data: battle } = await supabaseAdmin.from('quiz_battles').select('*').eq('code', code.toUpperCase()).maybeSingle()
      if (!battle) {
        res.status(404).json({ error: 'No battle found with that code' })
        return
      }
      const [sides, quizRow] = await Promise.all([
        sidesOf(battle.id),
        supabaseAdmin.from('quizzes').select('id, title, theme').eq('id', battle.quiz_id).maybeSingle().then((r) => r.data),
      ])
      const a = sides.find((s) => s.slot === 'a')
      const expired = battle.state === 'cancelled' || (battle.mode === 'challenge' && new Date(battle.expires_at).getTime() < now())
      const seatFree = sides.length < 2 && !expired && battle.state === 'open' && (battle.mode === 'duel' || Boolean(a?.finished_at))
      res.status(200).json({
        mode: battle.mode,
        title: quizRow?.title ?? '',
        questionCount: battle.question_ids.length,
        state: battle.state,
        seatFree,
        expired,
        notReady: battle.mode === 'challenge' && battle.state === 'open' && !a?.finished_at,
        challenger: a ? { nickname: a.nickname, avatarId: a.avatar_id, ...(battle.mode === 'challenge' && a.finished_at ? { score: a.total_score } : {}) } : null,
        theme: await theme(quizRow, battle.quiz_id),
      })
      return
    }

    // ---- create ----
    if (op === 'create') {
      if (!allowCreate(clientIp(req))) {
        res.status(429).json({ error: 'You have started a lot of battles. Try again later.' })
        return
      }
      if (!MODES.includes(mode)) {
        res.status(400).json({ error: 'Pick a challenge or a duel' })
        return
      }
      const quiz = await enabledQuiz(quizId)
      if (!quiz) {
        res.status(404).json({ error: 'This quiz is not open for battles' })
        return
      }
      const checked = validateNickname(nickname)
      if (!checked.ok) {
        res.status(400).json({ error: checked.error })
        return
      }
      if (!isAvatarId(avatarId)) {
        res.status(400).json({ error: 'Pick one of the characters' })
        return
      }
      const botChoice = BOT_SKILL_CHOICES.includes(botSkill) ? botSkill : 'average'
      if (vsBot === true && mode !== 'duel') {
        res.status(400).json({ error: 'Only a duel can be against a bot' })
        return
      }
      const all = await quizQuestionsFor(quiz.id)
      const picked = pickBattleQuestions(all, `${quiz.id}:${now()}:${random()}`)
      if (picked.length === 0) {
        res.status(404).json({ error: 'This quiz has no questions for a battle yet' })
        return
      }
      const nowMs = now()
      let battle = null
      for (let attempt = 0; attempt < 6 && !battle; attempt++) {
        const { data, error } = await supabaseAdmin
          .from('quiz_battles')
          .insert({
            quiz_id: quiz.id,
            mode,
            code: generateBattleCode(random),
            question_ids: picked.map((q) => q.id),
            state: 'open',
            current_index: 0,
            forfeit: false,
            bot_skill: mode === 'duel' && vsBot === true ? botChoice : null,
            created_at: iso(nowMs),
            expires_at: iso(nowMs + BATTLE_CHALLENGE_DAYS * 86_400_000),
          })
          .select('*')
          .single()
        if (!error) battle = data
        else if (error.code !== '23505') return fail(error, 'Could not start the battle')
      }
      if (!battle) {
        res.status(503).json({ error: 'Could not make a battle code. Try again.' })
        return
      }
      const newToken = newPlayerToken()
      const { error: sideError } = await supabaseAdmin.from('quiz_battle_sides').insert({
        battle_id: battle.id,
        slot: 'a',
        nickname: checked.value,
        avatar_id: avatarId,
        token_hash: hashToken(newToken),
        tag_hash: tagHash,
        total_score: 0,
        current_index: 0,
        question_started_at: mode === 'challenge' ? iso(nowMs) : null,
        last_seen_at: iso(nowMs),
      })
      if (sideError) {
        await supabaseAdmin.from('quiz_battles').delete().eq('id', battle.id)
        return fail(sideError, 'Could not start the battle')
      }
      if (mode === 'duel' && vsBot === true) {
        const skill = skillForBot(botChoice, Math.floor(seeded(battle.id, 4) * 10))
        const botName = botNicknames(50).filter((n) => n.toLowerCase() !== checked.value.toLowerCase())[Math.floor(seeded(battle.id, 6) * 40)]
        const { error: botError } = await supabaseAdmin.from('quiz_battle_sides').insert({
          battle_id: battle.id,
          slot: 'b',
          nickname: botName,
          avatar_id: Math.floor(seeded(battle.id, 8) * AVATAR_COUNT),
          token_hash: null,
          bot_skill: skill,
          total_score: 0,
          current_index: 0,
          last_seen_at: iso(nowMs),
        })
        if (botError) {
          await supabaseAdmin.from('quiz_battles').delete().eq('id', battle.id)
          return fail(botError, 'Could not start the battle')
        }
        const { data: started } = await supabaseAdmin
          .from('quiz_battles')
          .update({ state: 'question', current_index: 0, question_started_at: iso(nowMs + DUEL_START_DELAY_MS), started_at: iso(nowMs) })
          .eq('id', battle.id)
          .select('*')
          .maybeSingle()
        battle = started ?? battle
      }
      if (random() < cleanupChance) await supabaseAdmin.rpc('quiz_battle_cleanup')
      const ctx = await everything(battle, { slot: 'a' })
      res.status(200).json({ token: newToken, ...(await view({ battle, ...ctx })) })
      return
    }

    // ---- join: take the second seat ----
    if (op === 'join') {
      if (!allowJoin(clientIp(req))) {
        res.status(429).json({ error: 'Too many tries. Wait a moment and try again.' })
        return
      }
      if (!isBattleCode(code)) {
        res.status(400).json({ error: 'Enter the 6-character battle code' })
        return
      }
      const checked = validateNickname(nickname)
      if (!checked.ok) {
        res.status(400).json({ error: checked.error })
        return
      }
      if (!isAvatarId(avatarId)) {
        res.status(400).json({ error: 'Pick one of the characters' })
        return
      }
      const { data: found } = await supabaseAdmin.from('quiz_battles').select('*').eq('code', code.toUpperCase()).maybeSingle()
      if (!found) {
        res.status(404).json({ error: 'No battle found with that code' })
        return
      }
      const sides = await sidesOf(found.id)
      const a = sides.find((s) => s.slot === 'a')
      const nowMs = now()
      if (found.state === 'cancelled' || (found.mode === 'challenge' && new Date(found.expires_at).getTime() < nowMs)) {
        res.status(410).json({ error: 'This battle has ended' })
        return
      }
      if (found.state !== 'open' || sides.length >= 2) {
        res.status(409).json({ error: 'This battle already has two players' })
        return
      }
      if (found.mode === 'challenge' && !a?.finished_at) {
        res.status(409).json({ error: 'The challenger has not finished yet. Try again in a moment.' })
        return
      }
      if (a && a.nickname.toLowerCase() === checked.value.toLowerCase()) {
        res.status(409).json({ error: `${a.nickname} is taken. Pick a different nickname.` })
        return
      }
      const newToken = newPlayerToken()
      const { error: seatError } = await supabaseAdmin.from('quiz_battle_sides').insert({
        battle_id: found.id,
        slot: 'b',
        nickname: checked.value,
        avatar_id: avatarId,
        token_hash: hashToken(newToken),
        tag_hash: tagHash,
        total_score: 0,
        current_index: 0,
        question_started_at: found.mode === 'challenge' ? iso(nowMs) : null,
        last_seen_at: iso(nowMs),
      })
      if (seatError) {
        if (seatError.code === '23505') {
          res.status(409).json({ error: 'This battle already has two players' })
          return
        }
        return fail(seatError, 'Could not join the battle')
      }
      let battle = found
      if (found.mode === 'duel') {
        const { data: started } = await supabaseAdmin
          .from('quiz_battles')
          .update({ state: 'question', current_index: 0, question_started_at: iso(nowMs + DUEL_START_DELAY_MS), started_at: iso(nowMs) })
          .eq('id', found.id)
          .eq('state', 'open')
          .select('*')
          .maybeSingle()
        if (!started) {
          await supabaseAdmin.from('quiz_battle_sides').delete().eq('battle_id', found.id).eq('slot', 'b')
          res.status(409).json({ error: 'This battle is no longer open' })
          return
        }
        battle = started
      }
      const ctx = await everything(battle, { slot: 'b' })
      res.status(200).json({ token: newToken, ...(await view({ battle, ...ctx })) })
      return
    }

    // ---- state / answer / next need a seat ----
    const seat = await sideFromToken()
    if (!seat) return
    let { battle } = seat
    const nowMs = now()
    await supabaseAdmin.from('quiz_battle_sides').update({ last_seen_at: iso(nowMs) }).eq('battle_id', battle.id).eq('slot', seat.side.slot)
    let ctx = await everything(battle, { ...seat.side, last_seen_at: iso(nowMs) })

    // leave: walk away from a battle. Nothing is lost if nobody has joined; leaving a duel that is under way loses it.
    if (op === 'leave') {
      if (battle.state === 'finished' || battle.state === 'cancelled') {
        res.status(200).json({ left: true })
        return
      }
      const cancel = () => supabaseAdmin.from('quiz_battles').update({ state: 'cancelled' }).eq('id', battle.id).in('state', ['open', 'question', 'reveal'])
      if (battle.mode === 'duel') {
        const other = ctx.sides.find((s) => s.slot !== seat.side.slot)
        if (battle.state === 'open' || !other || other.bot_skill) await cancel()
        else await finish(battle, ctx.sides, ctx.answers, { forfeitWinner: other.slot })
      } else if (seat.side.slot === 'a') {
        await cancel() // the challenge link stops working
      } else if (!seat.side.finished_at) {
        // the friend changes their mind: the seat is free again for someone else
        await supabaseAdmin.from('quiz_battle_sides').delete().eq('battle_id', battle.id).eq('slot', 'b')
      }
      res.status(200).json({ left: true })
      return
    }

    if (op === 'state') {
      if (battle.mode === 'duel') {
        const moved = await advanceDuel(battle, ctx.sides, ctx.questions, ctx.answers)
        battle = moved.battle
        if (battle.state !== seat.battle.state || battle.current_index !== seat.battle.current_index || moved.answers !== ctx.answers) {
          ctx = await everything(battle, seat.side)
        }
      } else if (battle.state === 'open') {
        // A challenge side that ran out of time on a question gets a miss recorded, like practice.
        const me = ctx.me
        const q = ctx.questions[me.current_index]
        if (q && !me.finished_at && !ctx.answers.some((x) => x.slot === me.slot && x.question_id === q.id)) {
          const elapsed = nowMs - new Date(me.question_started_at).getTime()
          if (elapsed > q.time_limit_seconds * 1000 + ANSWER_GRACE_MS) {
            await record({ battle, side: me, question: q, graded: null, elapsedMs: elapsed })
            ctx = await everything(battle, seat.side)
          }
        }
      }
      res.status(200).json(await view({ battle, ...ctx }))
      return
    }

    if (op === 'answer') {
      const me = ctx.me
      if (battle.state === 'finished' || battle.state === 'cancelled') {
        res.status(409).json({ error: 'This battle is over' })
        return
      }
      let question
      let elapsedMs
      if (battle.mode === 'duel') {
        if (battle.state !== 'question') {
          res.status(409).json({ error: 'There is no question open right now' })
          return
        }
        question = ctx.questions[battle.current_index]
        elapsedMs = nowMs - new Date(battle.question_started_at).getTime()
        if (elapsedMs < 0) {
          res.status(409).json({ error: 'Get ready, the question has not opened yet' })
          return
        }
      } else {
        if (me.finished_at || me.current_index >= ctx.questions.length) {
          res.status(409).json({ error: 'You have finished this challenge' })
          return
        }
        question = ctx.questions[me.current_index]
        elapsedMs = nowMs - new Date(me.question_started_at).getTime()
      }
      if (!question) {
        res.status(409).json({ error: 'There is no question open right now' })
        return
      }
      if (elapsedMs > question.time_limit_seconds * 1000 + ANSWER_GRACE_MS) {
        res.status(409).json({ error: 'Time is up' })
        return
      }
      if (ctx.answers.some((x) => x.slot === me.slot && x.question_id === question.id)) {
        res.status(409).json({ error: 'You already answered this question' })
        return
      }
      const graded = gradeAnswer(question, { chosenIndex, answerText })
      if (!graded.ok) {
        res.status(400).json({ error: graded.error })
        return
      }
      const out = await record({ battle, side: me, question, graded, elapsedMs })
      if (out.error) return fail(out.error, 'Could not save your answer')
      if (!out.recorded) {
        res.status(409).json({ error: 'You already answered this question' })
        return
      }
      if (battle.mode === 'duel') {
        res.status(200).json({ accepted: true })
        return
      }
      const answer = { chosen_index: graded.chosenIndex, answer_text: graded.answerText, correct: out.correct, points_awarded: out.points }
      const { data: fresh } = await supabaseAdmin.from('quiz_battle_sides').select('total_score').eq('battle_id', battle.id).eq('slot', me.slot).maybeSingle()
      res.status(200).json({ result: resultFor(question, answer), score: fresh?.total_score ?? me.total_score + out.points })
      return
    }

    // next (challenge only): move this side to its next question, or finish it
    if (battle.mode !== 'challenge') {
      res.status(409).json({ error: 'Duels move on by themselves' })
      return
    }
    const me = ctx.me
    if (me.finished_at || me.current_index >= ctx.questions.length) {
      res.status(200).json(await view({ battle, ...ctx }))
      return
    }
    const question = ctx.questions[me.current_index]
    const answered = ctx.answers.some((x) => x.slot === me.slot && x.question_id === question.id)
    const elapsed = nowMs - new Date(me.question_started_at).getTime()
    if (!answered && elapsed <= question.time_limit_seconds * 1000 + ANSWER_GRACE_MS) {
      res.status(409).json({ error: 'Answer this question first' })
      return
    }
    if (!answered) await record({ battle, side: me, question, graded: null, elapsedMs: elapsed })
    const last = me.current_index + 1 >= ctx.questions.length
    const patch = last ? { current_index: me.current_index + 1, finished_at: iso(nowMs) } : { current_index: me.current_index + 1, question_started_at: iso(nowMs) }
    await supabaseAdmin.from('quiz_battle_sides').update(patch).eq('battle_id', battle.id).eq('slot', me.slot).eq('current_index', me.current_index)
    ctx = await everything(battle, seat.side)
    if (last && ctx.sides.length === 2 && ctx.sides.every((s) => s.finished_at)) {
      battle = await finish(battle, ctx.sides, ctx.answers)
      ctx = await everything(battle, seat.side)
    }
    res.status(200).json(await view({ battle, ...ctx }))
  }
}

export default createQuizBattleHandler(getSupabaseAdmin)
