import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { sanitizeTheme } from '../../api/_lib/quizTheme.js'
import { quizImagePath, IMAGE_BUCKET, IMAGE_ALT_MAX } from '../../api/_lib/quizImage.js'
import { sanitizeGameOptions } from '../../api/_lib/quizGrading.js'
import { cleanQuestion, validateQuestion, cleanTags, MAX_QUESTIONS } from './quizQuestions'
import { validateTeamSettings, cleanTeams } from './quizTeams'

// Live quiz: the four answer colours (the same on the projector and on phones), input rules for the
// editor, timing helpers and the small client for /api/quiz. Spec: docs/superpowers/specs/2026-09-30-live-quiz-design.md

export const OPTION_STYLES = [
  { shape: '▲', bg: 'bg-red-600', text: 'text-red-700' },
  { shape: '◆', bg: 'bg-blue-600', text: 'text-blue-700' },
  { shape: '●', bg: 'bg-amber-600', text: 'text-amber-700' },
  { shape: '■', bg: 'bg-green-600', text: 'text-green-700' },
]

// Every player gets one of the four answer colours, chosen from their nickname so it never changes.
export function avatarStyle(nickname) {
  let hash = 0
  for (const ch of String(nickname)) hash = (hash * 31 + ch.codePointAt(0)) >>> 0
  return OPTION_STYLES[hash % OPTION_STYLES.length]
}

// The 50 characters live in quizCharacters.js.
export { AVATAR_COUNT, avatarInfo, normalizeAvatarId, randomAvatarId } from './quizCharacters'

// How long the answer reveal and the leaderboard stay up before the game moves on by itself.
export const AUTO_ADVANCE_MS = 5000

// Whole seconds left before the automatic move on, counting down from `totalMs` (never below zero or above the total,
// even if the clock reading is a moment behind).
export function autoSecondsLeft({ enteredMs, nowMs, totalMs = AUTO_ADVANCE_MS }) {
  const left = Math.ceil((totalMs - (nowMs - enteredMs)) / 1000)
  return Math.min(Math.ceil(totalMs / 1000), Math.max(0, left))
}

export function initialOf(nickname) {
  const first = [...String(nickname).trim()][0]
  return first ? first.toUpperCase() : '?'
}

// Best score first, ties share a rank (the same rule the server uses for phones).
export function rankPlayers(players) {
  const sorted = [...players].sort((a, b) => b.total_score - a.total_score || a.nickname.localeCompare(b.nickname))
  let lastScore = null
  let lastRank = 0
  return sorted.map((p, i) => {
    const rank = p.total_score === lastScore ? lastRank : i + 1
    lastScore = p.total_score
    lastRank = rank
    return { ...p, rank }
  })
}

export function formatScore(n) {
  return Number(n).toLocaleString('en-US')
}

// How many players a game allows. The server enforces it; these are for the admin forms.
export const DEFAULT_MAX_PLAYERS = 50
export const MIN_PLAYERS_LIMIT = 2
export const MAX_PLAYERS_LIMIT = 150
// When the lobby fills up, the game starts by itself after this long (the host can start it sooner).
export const FULL_LOBBY_COUNTDOWN_MS = 10000

// Checks a max-players value typed into a form (a string or a number). Returns an error message, or null when fine.
export function validateMaxPlayers(value) {
  const n = typeof value === 'number' ? value : Number(String(value).trim())
  if (String(value).trim() === '' || !Number.isInteger(n)) return 'Max players must be a whole number.'
  if (n < MIN_PLAYERS_LIMIT || n > MAX_PLAYERS_LIMIT) return `Max players must be between ${MIN_PLAYERS_LIMIT} and ${MAX_PLAYERS_LIMIT}.`
  return null
}

export {
  TIME_LIMIT_CHOICES, POINT_CHOICES, MAX_QUESTIONS, MAX_TAGS, TAG_MAX_LENGTH, cleanTags, QUESTION_TYPE_INFO, blankQuestion, questionFromRow, cleanQuestion, validateQuestion,
} from './quizQuestions'

export function validateQuizDraft({ title, questions, maxPlayers = DEFAULT_MAX_PLAYERS, teamSettings }) {
  if (!title || !title.trim()) return 'A title is required.'
  if (title.trim().length > 120) return 'The title must be 120 characters or fewer.'
  const limitProblem = validateMaxPlayers(maxPlayers)
  if (limitProblem) return limitProblem
  const teamProblem = teamSettings ? validateTeamSettings(teamSettings) : null
  if (teamProblem) return teamProblem
  if (questions.length === 0) return 'Add at least one question.'
  if (questions.length > MAX_QUESTIONS) return `A quiz can have at most ${MAX_QUESTIONS} questions.`
  for (const [i, raw] of questions.entries()) {
    const problem = validateQuestion(raw, i + 1)
    if (problem) return problem
  }
  return null
}

// Seconds left on the clock, never below zero. `nowMs` should already be corrected to the server's clock.
// `bonusMs` is time the host added, `pausedMs` time spent paused so far, and `frozenElapsedMs` (while paused) is how
// long the question had run when it was paused; it replaces the clock so the countdown stands still.
export function secondsRemaining({ startedAtMs, timeLimitSeconds, nowMs, bonusMs = 0, pausedMs = 0, frozenElapsedMs = null }) {
  const elapsedMs = frozenElapsedMs ?? nowMs - startedAtMs - pausedMs
  const left = timeLimitSeconds + bonusMs / 1000 - elapsedMs / 1000
  return Math.max(0, Math.ceil(left))
}

// How long a paused question had been running when it was paused, from the two server timestamps (no clock drift).
export function elapsedAtPauseMs(session) {
  if (!session || !session.paused_at) return null
  return Math.max(0, new Date(session.paused_at).getTime() - new Date(session.question_started_at).getTime() - (session.paused_total_ms ?? 0))
}

export async function callQuiz(action, body, accessToken) {
  const response = await fetch(`/api/quiz?action=${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  })
  let data = null
  try {
    data = await response.json()
  } catch {
    // not JSON (for example a gateway error page)
  }
  if (!response.ok) {
    const error = new Error(data?.error || 'Something went wrong. Please try again.')
    error.status = response.status
    error.data = data
    throw error
  }
  return data
}

export async function hostAction(action, body) {
  const { data } = await supabase.auth.getSession()
  return callQuiz(action, body, data.session?.access_token)
}

// A host control (kick, lock, pause, extend, skip, rename). See api/_lib/handlers/quiz-host.js.
export function hostOp(op, sessionId, extra = {}) {
  return hostAction('host', { sessionId, op, ...extra })
}

export async function fetchAllQuizzes() {
  const { data, error } = await supabase
    .from('quizzes')
    .select('*, quiz_questions(count)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map((q) => ({ ...q, questionCount: q.quiz_questions?.[0]?.count ?? 0 }))
}

export function useAllQuizzesQuery() {
  return useQuery({ queryKey: ['quizzes', 'all'], queryFn: fetchAllQuizzes })
}

export async function fetchQuizWithQuestions(id) {
  const { data, error } = await supabase
    .from('quizzes')
    .select('*, quiz_questions(*)')
    .eq('id', id)
    .order('position', { referencedTable: 'quiz_questions' })
    .single()
  if (error) throw error
  return { ...data, questions: data.quiz_questions }
}

export function useQuizQuery(id) {
  return useQuery({ queryKey: ['quizzes', id], queryFn: () => fetchQuizWithQuestions(id), enabled: Boolean(id) })
}

// Saves a quiz and its questions. New questions carry a client-made uuid, so one upsert covers new,
// edited and reordered questions; questions the admin removed are deleted first. Pictures are uploaded first
// (under a fresh name, so phones never show a stale cached copy) and the old files are removed afterwards.
export async function saveQuiz({ id, title, questions, maxPlayers = DEFAULT_MAX_PLAYERS, gameOptions = {}, tags = [], teamSettings = null, practiceEnabled, battleEnabled }) {
  const cleaned = questions.map(cleanQuestion)
  const teamFields = teamSettings
    ? {
        team_mode: Boolean(teamSettings.teamMode),
        team_scoring: teamSettings.teamScoring === 'total' ? 'total' : 'average',
        team_presets: cleanTeams(teamSettings.teams).teams ?? [],
      }
    : {}
  const quizFields = {
    title: title.trim(),
    max_players: maxPlayers,
    game_options: sanitizeGameOptions(gameOptions),
    tags: cleanTags(tags),
    ...teamFields,
    ...(practiceEnabled === undefined ? {} : { practice_enabled: Boolean(practiceEnabled) }),
    ...(battleEnabled === undefined ? {} : { battle_enabled: Boolean(battleEnabled) }),
  }
  const staleFiles = []
  let quizId = id
  if (quizId) {
    const { error } = await supabase.from('quizzes').update(quizFields).eq('id', quizId)
    if (error) throw error
    const { data: existing, error: listError } = await supabase.from('quiz_questions').select('id, image_path').eq('quiz_id', quizId)
    if (listError) throw listError
    const keep = new Set(cleaned.map((q) => q.id))
    const removed = existing.filter((q) => !keep.has(q.id))
    if (removed.length > 0) {
      const { error: deleteError } = await supabase.from('quiz_questions').delete().in('id', removed.map((q) => q.id))
      if (deleteError) throw deleteError
      staleFiles.push(...removed.map((q) => q.image_path).filter(Boolean))
    }
  } else {
    const { data, error } = await supabase.from('quizzes').insert(quizFields).select('id').single()
    if (error) throw error
    quizId = data.id
  }

  const rows = []
  for (const [position, q] of cleaned.entries()) {
    let imagePath = q.image_path ?? null
    if (q.imageBlob) {
      const path = quizImagePath({ quizId, questionId: q.id, ext: q.imageExt, stamp: Date.now() + position })
      const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, q.imageBlob, { contentType: q.imageBlob.type, upsert: true })
      if (error) throw new Error(`Could not upload the picture for question ${position + 1}: ${error.message}`)
      if (imagePath) staleFiles.push(imagePath)
      imagePath = path
    } else if (q.removeImage && imagePath) {
      staleFiles.push(imagePath)
      imagePath = null
    } else if (q.copyImageFrom && !imagePath) {
      // A question copied from another quiz: copy its picture into this quiz's folder.
      const ext = q.copyImageFrom.split('.').pop()
      const path = quizImagePath({ quizId, questionId: q.id, ext, stamp: Date.now() + position })
      const { error } = await supabase.storage.from(IMAGE_BUCKET).copy(q.copyImageFrom, path)
      imagePath = error ? null : path
    }
    rows.push({
      id: q.id,
      quiz_id: quizId,
      position,
      type: q.type,
      text: q.text,
      options: q.options,
      correct_index: q.correct_index,
      numeric_answer: q.numeric_answer,
      numeric_tolerance: q.numeric_tolerance,
      accepted_answers: q.accepted_answers,
      time_limit_seconds: q.time_limit_seconds,
      points: q.points,
      points_multiplier: q.points_multiplier,
      difficulty: q.difficulty ?? null,
      image_path: imagePath,
      image_alt: imagePath ? String(q.image_alt ?? '').trim().slice(0, IMAGE_ALT_MAX) : null,
    })
  }
  const { error } = await supabase.from('quiz_questions').upsert(rows, { onConflict: 'id' })
  if (error) throw error
  if (staleFiles.length > 0) await supabase.storage.from(IMAGE_BUCKET).remove(staleFiles) // best effort
  return quizId
}

// Makes a copy of a quiz (questions, pictures, settings, look) called "Copy of ...". Returns the new quiz id.
export async function duplicateQuiz(id) {
  const source = await fetchQuizWithQuestions(id)
  const { data: created, error } = await supabase
    .from('quizzes')
    .insert({
      title: `Copy of ${source.title}`.slice(0, 120),
      max_players: source.max_players,
      game_options: sanitizeGameOptions(source.game_options),
      theme: sanitizeTheme(source.theme),
      tags: cleanTags(source.tags),
    })
    .select('id')
    .single()
  if (error) throw error
  const newId = created.id
  try {
    const rows = []
    for (const [position, q] of source.questions.entries()) {
      const questionId = crypto.randomUUID()
      let imagePath = null
      if (q.image_path) {
        const path = quizImagePath({ quizId: newId, questionId, ext: q.image_path.split('.').pop(), stamp: Date.now() + position })
        const { error: copyError } = await supabase.storage.from(IMAGE_BUCKET).copy(q.image_path, path)
        imagePath = copyError ? null : path
      }
      rows.push({
        id: questionId,
        quiz_id: newId,
        position,
        type: q.type ?? 'multiple',
        text: q.text,
        options: q.options,
        correct_index: q.correct_index,
        numeric_answer: q.numeric_answer,
        numeric_tolerance: q.numeric_tolerance ?? 0,
        accepted_answers: q.accepted_answers ?? [],
        time_limit_seconds: q.time_limit_seconds,
        points: q.points,
        points_multiplier: q.points_multiplier ?? 1,
        difficulty: q.difficulty ?? null,
        image_path: imagePath,
        image_alt: imagePath ? q.image_alt : null,
      })
    }
    if (rows.length > 0) {
      const { error: insertError } = await supabase.from('quiz_questions').insert(rows)
      if (insertError) throw insertError
    }
  } catch (e) {
    await supabase.from('quizzes').delete().eq('id', newId) // leave nothing half-made
    throw e
  }
  return newId
}

// Archived quizzes are hidden from the main list but keep their games and results.
export async function setQuizArchived(id, archived) {
  const { data, error } = await supabase.from('quizzes').update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', id).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('No changes were saved — your account may not have admin access to make this change.')
}

// Every question from every quiz (newest first), so questions can be reused. Capped so the list stays quick.
export async function fetchQuestionBank({ limit = 600 } = {}) {
  const { data, error } = await supabase
    .from('quiz_questions')
    .select('*, quizzes(title)')
    .order('id', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

// Saves the look designed in the Quiz Design Studio. Games started after this use it; running games keep theirs.
export async function saveQuizTheme(id, theme) {
  const clean = sanitizeTheme(theme, { quizId: id })
  const { data, error } = await supabase.from('quizzes').update({ theme: clean }).eq('id', id).select('id')
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('No changes were saved — your account may not have admin access to make this change.')
  }
  return clean
}

export async function deleteQuiz(id) {
  const { data, error } = await supabase.from('quizzes').delete().eq('id', id).select()
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('No changes were saved — your account may not have admin access to make this change.')
  }
  // Tidy up the quiz's pictures (best effort: a leftover file is harmless).
  const { data: files } = await supabase.storage.from(IMAGE_BUCKET).list(id)
  if (files && files.length) await supabase.storage.from(IMAGE_BUCKET).remove(files.map((f) => `${id}/${f.name}`))
  const { data: branding } = await supabase.storage.from('quiz-branding').list(id)
  if (branding && branding.length) await supabase.storage.from('quiz-branding').remove(branding.map((f) => `${id}/${f.name}`))
}

// Everything the results report needs for one game (admin only: the summary views inherit the answers' admin-only access).
export async function fetchGameReport(sessionId) {
  const { data: session, error } = await supabase.from('quiz_sessions').select('*, quizzes(title)').eq('id', sessionId).maybeSingle()
  if (error) throw error
  if (!session) throw new Error('Game not found')
  const [questions, players, questionStats, distribution, playerStats, teams] = await Promise.all([
    supabase.from('quiz_questions').select('*').eq('quiz_id', session.quiz_id).order('position'),
    supabase.from('quiz_players').select('id, nickname, total_score, avatar_id, team_id').eq('session_id', sessionId),
    supabase.from('quiz_question_stats').select('*').eq('session_id', sessionId),
    supabase.from('quiz_answer_distribution').select('*').eq('session_id', sessionId),
    supabase.from('quiz_player_stats').select('*').eq('session_id', sessionId),
    supabase.from('quiz_teams').select('*').eq('session_id', sessionId).order('position'),
  ])
  for (const result of [questions, players, questionStats, distribution, playerStats, teams]) if (result.error) throw result.error
  return {
    session,
    questions: questions.data,
    players: players.data,
    questionStats: questionStats.data,
    distribution: distribution.data,
    playerStats: playerStats.data,
    teams: teams.data,
    teamScoring: session.team_scoring,
  }
}

export async function deleteQuizSession(sessionId) {
  const { data, error } = await supabase.from('quiz_sessions').delete().eq('id', sessionId).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('No changes were saved — your account may not have admin access to make this change.')
}

export async function fetchQuizSessions(quizId) {
  const { data, error } = await supabase
    .from('quiz_sessions')
    .select('id, join_code, state, created_at, finished_at')
    .eq('quiz_id', quizId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return data
}
