import { getCaller, bearerToken } from '../authz.js'
import { isUuid, isAllowedImageUrl } from '../validate.js'
import { hashToken, createRateLimiter, clientIp, rankPlayers } from '../quiz.js'
import { sanitizeTheme } from '../quizTheme.js'
import { sanitizeCard, decodeCardPreview } from '../quizCard.js'
import { buildPracticeMe, toBoardRow } from '../quizCardData.js'
import { renderBoardCard, renderDuelCard, renderPersonalCard } from '../quizCardRender.js'
import { sessionQuestionIds } from '../quizSessionQuestions.js'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024



// Every fetch draws the card again; nothing is stored. A generous limit stops one phone hammering the function
// while the cache headers on the board variant stop everyone else having to.
export function createQuizCardHandler(
  getClient,
  { allow = createRateLimiter({ max: 30, windowMs: 60_000 }), caller = getCaller, baseUrl = process.env.VITE_SUPABASE_URL } = {},
) {
  function sendPng(res, buffer, cacheControl) {
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', cacheControl)
    res.status(200).send(buffer)
  }

  // Backgrounds are fetched only from our own Supabase project, with a timeout and a size cap, exactly like
  // api/award-card.js does for nominee photos. A card must still render when the picture 404s.
  function loadBackground() {
    return async (path) => {
      try {
        const url = `${String(baseUrl).replace(/\/+$/, '')}/storage/v1/object/public/quiz-branding/${path}`
        if (!isAllowedImageUrl(url, [new URL(baseUrl).hostname])) return null
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
        if (!response.ok || Number(response.headers.get('content-length')) > MAX_IMAGE_BYTES) return null
        return Buffer.from(await response.arrayBuffer())
      } catch {
        return null
      }
    }
  }

  async function servePersonal(res, db, sessionId, token) {
    const { data: tokenRow } = await db.from('quiz_player_tokens').select('player_id').eq('token_hash', hashToken(token)).maybeSingle()
    if (!tokenRow) {
      res.status(401).json({ error: 'Unknown player. Rejoin the game.' })
      return
    }
    const { data: players } = await db
      .from('quiz_players')
      .select('id, nickname, total_score, avatar_id, streak, team_id')
      .eq('session_id', sessionId)
    const ranked = rankPlayers(players ?? [])
    const me = ranked.find((p) => p.id === tokenRow.player_id)
    if (!me) {
      res.status(404).json({ error: 'Game not found' })
      return
    }
    const { data: session } = await db.from('quiz_sessions').select('*').eq('id', sessionId).maybeSingle()
    if (!session) {
      res.status(404).json({ error: 'Game not found' })
      return
    }
    if (session.state !== 'finished') {
      res.status(410).json({ error: 'This game is not finished yet.' })
      return
    }
    const { data: quiz } = await db.from('quizzes').select('id, title, theme, card').eq('id', session.quiz_id).maybeSingle()
    // Read with the service role on purpose: quiz_player_stats is granted to `authenticated` only, and this route has
    // already proved the player through quiz_player_tokens, so the view's own gate would only get in the way.
    const { data: stats } = await db
      .from('quiz_player_stats')
      .select('correct_count')
      .eq('session_id', sessionId)
      .eq('player_id', me.id)
      .maybeSingle()
    const team = session.team_mode && me.team_id
      ? (await db.from('quiz_teams').select('name').eq('id', me.team_id).maybeSingle()).data
      : null
    // The session's own count, not the quiz's: a bank means a game can put fewer questions than the quiz holds.
    const total = (await sessionQuestionIds(db, session))?.length ?? 0

    const buffer = await renderPersonalCard({
      card: sanitizeCard(session.card, { quizId: session.quiz_id }),
      theme: sanitizeTheme(session.theme, { quizId: session.quiz_id }),
      quiz,
      me: {
        nickname: me.nickname,
        avatarId: me.avatar_id ?? 0,
        score: me.total_score ?? 0,
        rank: me.rank ?? null,
        playerCount: ranked.length,
        correctCount: stats?.correct_count ?? null,
        totalQuestions: total || null,
        bestStreak: me.streak ?? null,
        teamName: team?.name ?? null,
      },
      loadBackground: loadBackground(),
    })
    sendPng(res, buffer, 'no-store')
  }

  async function serveBoard(res, db, sessionId) {
    const { data: session } = await db.from('quiz_sessions').select('id, quiz_id, state, theme, card, team_mode').eq('id', sessionId).maybeSingle()
    if (!session) {
      res.status(404).json({ error: 'Game not found' })
      return
    }
    if (session.state !== 'finished') {
      res.status(410).json({ error: 'This game is not finished yet.' })
      return
    }
    const [{ data: players }, { data: quiz }, { data: teams }] = await Promise.all([
      db.from('quiz_players').select('id, nickname, total_score, avatar_id, team_id').eq('session_id', sessionId),
      db.from('quizzes').select('id, title, theme, card').eq('id', session.quiz_id).maybeSingle(),
      session.team_mode
        ? db.from('quiz_teams').select('id, name, color').eq('session_id', sessionId)
        : Promise.resolve({ data: [] }),
    ])
    // A team's total is the sum of its players', which is what the projector's own standings show.
    const perTeam = new Map()
    for (const p of players ?? []) {
      if (!p.team_id) continue
      perTeam.set(p.team_id, (perTeam.get(p.team_id) ?? 0) + (p.total_score ?? 0))
    }
    const buffer = await renderBoardCard({
      card: sanitizeCard(session.card, { quizId: session.quiz_id }),
      theme: sanitizeTheme(session.theme, { quizId: session.quiz_id }),
      quiz,
      ranked: rankPlayers(players ?? []).map(toBoardRow),
      teams: (teams ?? []).map((t) => ({ name: t.name, color: t.color, score: perTeam.get(t.id) ?? 0 })),
      loadBackground: loadBackground(),
    })
    // Browser-only: a shared cache would serve every player's nickname and score to anyone who knew the session id,
    // which is exactly the gate the admin check above exists to enforce.
    // no-cache rather than max-age=300. Both keep the image out of a shared cache, but max-age also lets the browser
    // reuse the stored PNG without asking the server, so a fix to the card's drawing reached nobody for five minutes
    // and the host's modal showed the old card. There is no ETag here, so this costs a full re-render on every open -
    // a fair price for a host opening one modal now and then, and the rate limiter above still caps it.
    sendPng(res, buffer, 'private, no-cache')
  }

  async function servePractice(res, db, shareCode) {
    if (!/^[A-Z0-9]{8}$/.test(String(shareCode))) {
      res.status(400).json({ error: 'Invalid share code' })
      return
    }
    if (!allow(hashToken(shareCode))) {
      res.status(429).json({ error: 'Slow down' })
      return
    }
    const { data: run } = await db
      .from('quiz_practice_runs')
      .select('id, quiz_id, nickname, avatar_id, total_score, question_ids')
      .eq('share_code', String(shareCode))
      .maybeSingle()
    if (!run) {
      // The 90-day cleanup removes finished runs, so an old card link lands here rather than rendering blank.
      res.status(410).json({ error: 'This practice run is no longer stored.' })
      return
    }
    const [{ data: answers }, { data: quiz }] = await Promise.all([
      db.from('quiz_practice_answers').select('correct').eq('run_id', run.id),
      db.from('quizzes').select('id, title, theme, card').eq('id', run.quiz_id).maybeSingle(),
    ])
    const buffer = await renderPersonalCard({
      card: sanitizeCard(quiz?.card, { quizId: run.quiz_id }),
      theme: sanitizeTheme(quiz?.theme, { quizId: run.quiz_id }),
      quiz,
      me: buildPracticeMe(run, answers ?? [], run.question_ids?.length ?? 0),
      loadBackground: loadBackground(),
    })
    sendPng(res, buffer, 'no-store')
  }

  async function serveBattle(res, db, code) {
    // Codes go out uppercase but a URL can arrive lowercased, so compare case-insensitively rather than 400ing a
    // link someone retyped.
    const upper = String(code).toUpperCase()
    if (!/^[A-Z0-9]{6}$/.test(upper)) {
      res.status(400).json({ error: 'Invalid battle code' })
      return
    }
    if (!allow(hashToken(code))) {
      res.status(429).json({ error: 'Slow down' })
      return
    }
    const { data: battle } = await db
      .from('quiz_battles')
      .select('id, quiz_id, state, winner_slot, forfeit, question_ids')
      .eq('code', upper)
      .maybeSingle()
    if (!battle) {
      res.status(404).json({ error: 'That duel does not exist' })
      return
    }
    // A duel still running is a conflict, not a gone result: 410 is reserved for things that will never arrive.
    if (battle.state !== 'finished') {
      res.status(409).json({ error: 'This duel is not finished yet.' })
      return
    }
    const [{ data: sides }, { data: quiz }] = await Promise.all([
      db.from('quiz_battle_sides').select('slot, nickname, avatar_id, total_score').eq('battle_id', battle.id),
      db.from('quizzes').select('id, title, theme, card').eq('id', battle.quiz_id).maybeSingle(),
    ])
    const buffer = await renderDuelCard({
      card: sanitizeCard(quiz?.card, { quizId: battle.quiz_id }),
      theme: sanitizeTheme(quiz?.theme, { quizId: battle.quiz_id }),
      quiz,
      sides: (sides ?? []).map((s) => ({ ...s, avatarId: s.avatar_id ?? 0, score: s.total_score ?? 0 })),
      winnerSlot: battle.winner_slot ?? null,
      forfeit: Boolean(battle.forfeit),
      questionCount: battle.question_ids?.length ?? 0,
      loadBackground: loadBackground(),
    })
    sendPng(res, buffer, 'no-store')
  }

  // An <img> cannot send an Authorization header and the preview url is just the quiz id, so this is reachable by
  // anyone who knows one. It renders invented numbers only, never a real player, so nothing leaks.
  // A `d` parameter carries the studio's unsaved draft, so the preview follows the controls before they are saved.
  // It is sanitised against this quiz on the way in, exactly as the saved column is: a hand-made url cannot point the
  // render at another quiz's picture, and an unreadable one is ignored rather than thrown on.
  async function servePreview(res, db, quizId, draft) {
    const { data: quiz } = await db.from('quizzes').select('id, title, theme, card').eq('id', quizId).maybeSingle()
    if (!quiz) {
      res.status(404).json({ error: 'Quiz not found' })
      return
    }
    const buffer = await renderPersonalCard({
      card: draft ?? sanitizeCard(quiz.card, { quizId }),
      theme: sanitizeTheme(quiz.theme, { quizId }),
      quiz,
      me: {
        nickname: 'Ada', avatarId: 13, score: 14200, rank: 3, playerCount: 42,
        correctCount: 12, totalQuestions: 15, bestStreak: 5, teamName: 'Crimson',
      },
      loadBackground: loadBackground(),
    })
    sendPng(res, buffer, 'no-store')
  }

  return async function handler(req, res) {
    // Set first, so every early error (400/401/403/405/409/410/429) goes out uncached too. The board variant is the
    // only one that overrides it, since a finished game's standings never change. A shared cache storing the
    // 401 or the "practice run is gone" body would replay it long after the fact.
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const { session, token, view, practice, battle, preview, d } = req.query ?? {}

    if (preview) {
      if (!isUuid(preview)) {
        res.status(400).json({ error: 'Invalid quiz id' })
        return
      }
      // The one branch anyone can reach, and the most expensive per call (fonts, a React render, a 1080x1920
      // encode), so it is limited even though it needs no token.
      if (!allow(clientIp(req))) {
        res.status(429).json({ error: 'Slow down' })
        return
      }
      await servePreview(res, getClient(), preview, decodeCardPreview(d, { quizId: preview }))
      return
    }

    if (practice) {
      await servePractice(res, getClient(), practice)
      return
    }

    if (battle) {
      await serveBattle(res, getClient(), battle)
      return
    }

    if (!isUuid(session ?? '')) {
      res.status(400).json({ error: 'session is required' })
      return
    }

    // A board card shows every player's name and score, so it needs an admin. A personal card is the player's own
    // result and is gated on the token that already identifies them everywhere else in the quiz. Asking for the
    // board never widens what a player token can reach: view=board goes down the admin path or not at all.
    if (view === 'board') {
      const db = getClient()
      // Throttled on the address rather than the token, so a flood of forged JWTs cannot spend an auth round trip
      // each. getCaller verifies with Supabase, which is the expensive part.
      if (!allow(clientIp(req))) {
        res.status(429).json({ error: 'Slow down' })
        return
      }
      const who = await caller(db, bearerToken(req))
      if (who.error) {
        res.status(who.error[0]).json({ error: who.error[1] })
        return
      }
      if (!who.isAdmin) {
        res.status(403).json({ error: 'Admin access required' })
        return
      }
      await serveBoard(res, db, session)
      return
    }

    if (typeof token !== 'string' || !token) {
      res.status(400).json({ error: 'token is required' })
      return
    }
    if (!allow(hashToken(token))) {
      res.status(429).json({ error: 'Slow down' })
      return
    }
    await servePersonal(res, getClient(), session, token)
  }
}