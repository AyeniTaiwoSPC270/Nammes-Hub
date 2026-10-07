// What a hosted game asks, and in what order. A game started after quizzes grew question banks has its questions frozen
// onto the session; one started before falls back to the quiz's own order, so a game already running when the feature
// landed carries on unaffected. See docs/superpowers/specs/2026-10-07-quiz-question-banks.md.

export function optionOrderFor(session, questionId) {
  return session?.option_orders?.[questionId] ?? null
}

export function hasFrozenQuestions(session) {
  return Array.isArray(session?.question_ids) && session.question_ids.length > 0
}

// Every id the game will ask, in play order. A frozen game reads its own list; an older one reads the quiz.
export async function sessionQuestionIds(db, session) {
  if (hasFrozenQuestions(session)) return session.question_ids
  const { data } = await db.from('quiz_questions').select('id').eq('quiz_id', session.quiz_id).order('position')
  return (data ?? []).map((q) => q.id)
}

// Every question the game will ask, in play order. Rows are re-sorted onto the frozen list, because the database
// returns them in whatever order it likes.
export async function sessionQuestions(db, session) {
  const ids = await sessionQuestionIds(db, session)
  if (ids.length === 0) return []
  const { data } = await db.from('quiz_questions').select('*').in('id', ids)
  const byId = new Map((data ?? []).map((q) => [q.id, q]))
  return ids.map((id) => byId.get(id)).filter(Boolean)
}

// The one question the game is on, or null before the first. A frozen game reads a single row by id, an older one keeps
// the single-position lookup, so polling costs no more than it did before.
export async function currentQuestion(db, session) {
  const index = session.current_question_index
  if (!Number.isInteger(index) || index < 0) return null
  if (hasFrozenQuestions(session)) {
    const id = session.question_ids[index]
    if (!id) return null
    const { data } = await db.from('quiz_questions').select('*').eq('id', id).maybeSingle()
    return data ?? null
  }
  const { data } = await db
    .from('quiz_questions')
    .select('*')
    .eq('quiz_id', session.quiz_id)
    .eq('position', index)
    .maybeSingle()
  return data ?? null
}