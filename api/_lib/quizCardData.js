// What one result contributes to a card. Pure, so the shaping is testable without a database and so the renderer
// receives the same shape whichever of the four endpoints produced it.

// The renderer reads avatarId and score, while the database and rankPlayers both say avatar_id and total_score.
// Passing a row straight through draws "undefined" for every score and the first character for every face, which a
// PNG-magic-number assertion cannot see, so the renaming happens here and is tested on its own.
export function toBoardRow(player) {
  return {
    rank: player.rank,
    nickname: player.nickname,
    avatarId: player.avatar_id ?? 0,
    score: player.total_score ?? 0,
  }
}

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