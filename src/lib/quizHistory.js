// One row of the results history: a seat the phone holds, plus the `quiz-state` payload that finished it.
//
// Pure and total on purpose. The payload comes from a live server whose session may have been hand-edited or
// half-migrated, and one missing field must cost a "—" in that row, not the whole page. A seat with no usable state
// is `gone`, which the page uses to remove it -- the same rule the join form applies to a chip that cannot work.
const numberOrNull = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function summariseSeat(seat, state) {
  const summary = {
    code: typeof seat?.code === 'string' ? seat.code : '',
    nickname: typeof seat?.nickname === 'string' ? seat.nickname : '',
    playedAt: Number(seat?.at) || 0,
    status: 'gone',
    rank: null,
    score: null,
    players: null,
    winner: null,
  }

  if (!state || typeof state !== 'object' || !state.session || typeof state.session !== 'object') return summary

  const top = Array.isArray(state.top) ? state.top : []
  return {
    ...summary,
    status: state.session.state === 'finished' ? 'finished' : 'live',
    rank: numberOrNull(state.me?.rank),
    score: numberOrNull(state.me?.score),
    players: numberOrNull(state.playerCount),
    // The top row is the winner only when there is one; a lobby payload has no `top`, and that leaves null rather
    // than undefined so the row can test it like any other missing value.
    winner: typeof top[0]?.nickname === 'string' ? top[0].nickname : null,
  }
}
