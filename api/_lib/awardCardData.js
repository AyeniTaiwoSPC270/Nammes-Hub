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
