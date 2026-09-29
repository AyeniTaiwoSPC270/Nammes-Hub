export function determineWinner(votes, nominees) {
  const counts = {}
  nominees.forEach((n) => {
    counts[n.id] = 0
  })
  votes.forEach((v) => {
    if (counts[v.nominee_id] !== undefined) counts[v.nominee_id] += 1
  })
  let best = null
  for (const n of nominees) {
    const count = counts[n.id] || 0
    if (count > 0 && (!best || count > best.count)) {
      best = { nominee: n, count }
    }
  }
  return best
}

// Same result as determineWinner, but from aggregate rows ({category_id, nominee_id, votes})
// returned by the award_tally function, so raw ballots never leave the database.
export function determineWinnerFromCounts(tallyRows, nominees, categoryId) {
  const counts = {}
  for (const row of tallyRows) {
    if (row.category_id === categoryId) counts[row.nominee_id] = Number(row.votes) || 0
  }
  let best = null
  for (const n of nominees) {
    const count = counts[n.id] || 0
    if (count > 0 && (!best || count > best.count)) best = { nominee: n, count }
  }
  return best
}
