import { getSupabaseAdmin } from '../supabaseAdmin.js'
import { hashToken, rankPlayers, createRateLimiter, sanitizeGameOptions, isComeback, isChoiceType, correctText, fiftyFiftyHidden, POWERUPS } from '../quiz.js'
import { sanitizeTheme } from '../quizTheme.js'
import { publicImageUrl } from '../quizImage.js'
import { rankTeams } from '../quizTeams.js'
import { bracketViewFor } from '../quizBracket.js'
import { sessionQuestionIds, currentQuestion, optionOrderFor } from '../quizSessionQuestions.js'
import { shownOptions, shownIndex } from '../quizDraw.js'

const TOP_N = 10

// What a player's phone shows right now. The correct answer is only included once the game is on the
// reveal step (or later), never while a question is still open.
export function createQuizStateHandler(getClient, { now = () => Date.now(), baseUrl = process.env.VITE_SUPABASE_URL, allow = createRateLimiter({ max: 60, windowMs: 60_000 }) } = {}) {
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
      .select('id, session_id, nickname, streak, powerups_used')
      .eq('id', tokenRow.player_id)
      .maybeSingle()
    const { data: session } = player
      ? await supabaseAdmin.from('quiz_sessions').select('*').eq('id', player.session_id).maybeSingle()
      : { data: null }
    if (!session) {
      res.status(404).json({ error: 'Game not found' })
      return
    }

    const [{ data: players }, questionIds] = await Promise.all([
      supabaseAdmin.from('quiz_players').select('id, nickname, total_score, avatar_id, team_id').eq('session_id', session.id),
      sessionQuestionIds(supabaseAdmin, session),
    ])
    const questionCount = questionIds.length
    const gameOptions = sanitizeGameOptions(session.game_options)
    const ranked = rankPlayers(players ?? [])
    const teamRows = session.team_mode
      ? ((await supabaseAdmin.from('quiz_teams').select('*').eq('session_id', session.id)).data ?? [])
      : []
    const myTeam = teamRows.find((t) => t.id === (players ?? []).find((p) => p.id === player.id)?.team_id) ?? null
    const me = ranked.find((p) => p.id === player.id)
    const bracket = session.bracket_mode
      ? bracketViewFor(((await supabaseAdmin.from('quiz_bracket_matches').select('*').eq('session_id', session.id)).data ?? []), player.id, session)
      : null

    const out = {
      serverNow: now(),
      session: {
        state: session.state,
        index: session.current_question_index,
        questionCount: questionCount ?? 0,
        startedAt: session.question_started_at,
        maxPlayers: session.max_players,
        fullAt: session.full_at ?? null,
        teamMode: Boolean(session.team_mode),
        teamScoring: session.team_scoring ?? 'average',
        paused: Boolean(session.paused_at),
        pausedAt: session.paused_at ?? null,
        pausedTotalMs: session.paused_total_ms ?? 0,
        timeBonusMs: session.time_bonus_ms ?? 0,
        bracket,
      },
      theme: sanitizeTheme(session.theme, { quizId: session.quiz_id }),
      me: {
        nickname: player.nickname,
        score: me?.total_score ?? 0,
        rank: me?.rank ?? null,
        avatarId: me?.avatar_id ?? 0,
        streak: player.streak ?? 0,
        team: myTeam ? { id: myTeam.id, name: myTeam.name, color: myTeam.color } : null,
      },
      gameOptions,
      playerCount: ranked.length,
    }

    if (['question', 'reveal', 'leaderboard'].includes(session.state)) {
      const question = await currentQuestion(supabaseAdmin, session)
      if (question) {
        // Answers go out in the order this game drew, and everything reported back is mapped back to it, so what a
        // phone (and the projector) sees is the same everywhere. Stored answers keep their original positions.
        const optionOrder = optionOrderFor(session, question.id)
        const optionCount = (question.options ?? []).length
        const { data: answer } = await supabaseAdmin
          .from('quiz_answers')
          .select('chosen_index, points_awarded, bonus_points, answer_text, correct')
          .eq('player_id', player.id)
          .eq('question_id', question.id)
          .maybeSingle()
        const type = question.type ?? 'multiple'
        const usedPowerup = await supabaseAdmin
          .from('quiz_powerup_uses')
          .select('kind')
          .eq('player_id', player.id)
          .eq('question_id', question.id)
          .maybeSingle()
        const used = usedPowerup.data?.kind ?? null
        const powerupsLeft = gameOptions.powerups ? POWERUPS.filter((k) => !(player.powerups_used ?? []).includes(k)) : []
        out.question = {
          type,
          text: question.text,
          options: shownOptions(question, optionOrder),
          timeLimitSeconds: question.time_limit_seconds,
          multiplier: question.points_multiplier ?? 1,
          imageUrl: publicImageUrl(baseUrl, question.image_path, session.quiz_id),
          imageAlt: question.image_alt ?? '',
          answered: Boolean(answer),
          // Only this player's own pick, so a phone that reloads mid-question still shows what it chose.
          chosenIndex: answer ? shownIndex(optionOrder, answer.chosen_index, optionCount) : null,
          answerText: answer ? answer.answer_text : null,
          powerup: used,
          // fiftyFiftyHidden works in stored positions, so the option it removes is the one this player actually saw.
          hidden: used === 'fifty'
            ? fiftyFiftyHidden({ playerId: player.id, questionId: question.id, optionCount, correctIndex: question.correct_index })
              .map((i) => shownIndex(optionOrder, i, optionCount))
              .filter((i) => i !== null)
            : [],
          powerupsLeft,
        }
        if (session.state === 'question' && gameOptions.comeback) {
          // Standing when the question opened: totals minus what this question has awarded so far.
          const { data: answered } = await supabaseAdmin.from('quiz_answers').select('player_id, points_awarded').eq('question_id', question.id)
          const gained = new Map((answered ?? []).map((a) => [a.player_id, a.points_awarded]))
          const before = new Map((players ?? []).map((p) => [p.id, p.total_score - (gained.get(p.id) ?? 0)]))
          out.question.comeback = isComeback(before, player.id)
        }
        if (session.state !== 'question') {
          out.reveal = {
            correctIndex: isChoiceType(type) && type !== 'poll' ? shownIndex(optionOrder, question.correct_index, optionCount) : null,
            correctText: correctText(question),
            chosenIndex: answer ? shownIndex(optionOrder, answer.chosen_index, optionCount) : null,
            answerText: answer ? answer.answer_text : null,
            correct: answer ? answer.correct : null,
            pointsAwarded: answer ? answer.points_awarded : 0,
            bonusPoints: answer ? answer.bonus_points ?? 0 : 0,
          }
        }
      }
    }
    if (session.state === 'leaderboard' || session.state === 'finished') out.top = ranked.slice(0, TOP_N)
    if (session.team_mode && (session.state === 'leaderboard' || session.state === 'finished')) {
      out.teams = rankTeams({ teams: teamRows, players: players ?? [], scoring: session.team_scoring })
    }
    // Phones fetch the next picture while the leaderboard is up, so the next question does not wait on it.
    if (session.state === 'leaderboard') {
      const nextId = questionIds[session.current_question_index + 1] ?? null
      const { data: upcoming } = nextId
        ? await supabaseAdmin.from('quiz_questions').select('image_path').eq('id', nextId).maybeSingle()
        : { data: null }
      out.nextImageUrl = upcoming ? publicImageUrl(baseUrl, upcoming.image_path, session.quiz_id) : null
    }

    res.status(200).json(out)
  }
}

export default createQuizStateHandler(getSupabaseAdmin)
