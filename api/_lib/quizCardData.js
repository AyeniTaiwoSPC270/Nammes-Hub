// What one result contributes to a card. Pure, so the shaping is testable without a database and so the renderer
// receives the same shape whichever of the four endpoints produced it.

export function buildPracticeMe(run, answers, total) {
  return {
    nickname: run.nickname,
    avatarId: run.avatar_id ?? 0,
    score: run.total_score ?? 0,
    // Practice has no leaderboard, so there is no rank and no "placed N of M" line to invent.
    rank: null,
    playerCount: null,
    correctCount: (answers ?? []).filter((a) => a.correct === true).length,
    totalQuestions: total || null,
    // Practice scoring explicitly runs without streaks (quiz-practice.js), so this stays null rather than a fake 0.
    bestStreak: null,
    teamName: null,
  }
}