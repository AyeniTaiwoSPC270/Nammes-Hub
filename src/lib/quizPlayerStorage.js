// Durable per-room storage for a player's quiz token, so a phone that reloads, loses signal or is force-quit walks back
// into its own seat instead of being told its nickname is taken.
//
// This was sessionStorage, and could not do any of this: the tab took the token with it when it closed. The two live
// routes (/play and /play/low) both need identical behaviour, so it is here rather than inside either page -- a resume
// that works on the full route and silently does not on the data-saver route would be worse than neither.
//
// Every write is wrapped. In private mode a localStorage setItem throws, and it now has to survive longer to do any
// good, so the failure mode is "this phone rejoins by typing" rather than a blank screen.

export const STORAGE_KEY = 'nammes-quiz-player'
const INDEX_KEY = `${STORAGE_KEY}:index`
const INDEX_LIMIT = 6
const ROOM_LIMIT = 24
// How long a seat is offered on the join screen. A day is generous: it covers a student who closes the tab mid-game and
// comes back to it, and stops yesterday's game from sitting above today's code box.
const SEAT_MAX_AGE_MS = 24 * 60 * 60 * 1000

// Keyed by the join code, because that is the one identifier the URL carries: a browser cannot know the session id
// until it has already joined, which is exactly too late to look the token up. The code is also what a student types
// in, so the key and what they typed are the same string and cannot drift.
export const storeKey = (code) => `${STORAGE_KEY}:${code}`

export function readStore(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const value = JSON.parse(raw)
    // Only a shaped record is usable. A half-written or hand-edited entry must read as "nothing", because handing a
    // malformed token to the server turns a resume into a confusing 409.
    return value && typeof value === 'object' && typeof value.token === 'string' && value.token ? value : null
  } catch {
    return null
  }
}

export function writeStore(key, value) {
  try {
    if (value) localStorage.setItem(key, JSON.stringify(value))
    else localStorage.removeItem(key)
  } catch {
    // private mode, or storage full: the game still works, but a reload means rejoining
  }
}

export function forgetSession(code) {
  if (code) writeStore(storeKey(code), null)
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(`${STORAGE_KEY}:`) && k !== INDEX_KEY)
    // A device that has played dozens of games keeps a seat for every one of them, and the server's own 90-day cleanup
    // will have removed some of those long ago. Trim the oldest rather than the newest, and never below twelve, so a
    // device that plays a few games a week is left alone.
    if (keys.length > ROOM_LIMIT) for (const k of keys.slice(0, keys.length - 12)) localStorage.removeItem(k)
  } catch {
    // storage unavailable
  }
}

// Any nickname, not just this game's: the join screen asks who you are before it knows which room you are in, and a
// returning student retyping their name is what turns a resume into a 409. This is only a convenience -- the token is
// what actually buys the seat back -- so it is capped and best-effort.
export function rememberNickname(nickname) {
  if (typeof nickname !== 'string' || !nickname) return
  try {
    const list = knownNicknames()
    writeStore(INDEX_KEY, [nickname, ...list.filter((n) => n.toLowerCase() !== nickname.toLowerCase())].slice(0, INDEX_LIMIT))
  } catch {
    // a nickname we cannot remember is only a small convenience
  }
}

export function knownNicknames() {
  try {
    const raw = JSON.parse(localStorage.getItem(INDEX_KEY) ?? 'null')
    return Array.isArray(raw) ? raw.filter((n) => typeof n === 'string' && n) : []
  } catch {
    return []
  }
}

// Every room this device still holds a seat in, newest first. The join screen uses it to offer a one-tap way back
// instead of making a returning student remember a six-digit code: the seat was stored under the code, and a phone that
// arrived at a bare /play could not read it back, so a refresh put them on this form holding a token they could not use.
//
// A finished game is not offered. The server refuses a join to one ("No game found with that code"), so a dead seat on
// this list is a button that cannot work -- and a list of them trains a student to stop trusting the list. The phone
// flags the seat with `finishSeat` the moment it sees the game end, because nothing on this side can tell a live room
// from a dead one; the day-old cutoff is the backstop for a game the player abandoned before it ended, on the same
// reasoning: a student who played a game yesterday and is joining today is joining a different one.
export function rememberedSeats({ includeFinished = false, maxAgeMs = SEAT_MAX_AGE_MS, now = Date.now() } = {}) {
  try {
    const prefix = `${STORAGE_KEY}:`
    const seats = []
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(prefix) || key === INDEX_KEY) continue
      const record = readStore(key)
      if (!record) continue
      // Seen finishing on this device. The token stays (a reload of the game's own URL still lands on the result), it
      // just stops being advertised as somewhere to go back to. The results history is the one caller that wants
      // these, and it asks for them explicitly rather than through a second storage format.
      if (record.finished === true && !includeFinished) continue
      const at = Number(record.at) || 0
      // No timestamp means a record from a build that predates them. Kept, because a seat is the only way back into a
      // game and it may well be live; it just sorts last.
      if (at > 0 && now - at > maxAgeMs) continue
      seats.push({
        code: record.code ?? key.slice(prefix.length),
        nickname: typeof record.nickname === 'string' ? record.nickname : '',
        at,
        // The history page fetches each result with the seat's own token and needs the session to build a card.
        // Both are already in the record; returning them keeps one storage shape for both audiences.
        token: record.token,
        sessionId: typeof record.sessionId === 'string' ? record.sessionId : null,
        finished: record.finished === true,
      })
    }
    return seats.sort((a, b) => b.at - a.at).slice(0, INDEX_LIMIT)
  } catch {
    return []
  }
}

// Drops one room's seat. Called when the server says the room is gone, so a finished game removes itself from the list
// instead of waiting to be aged out -- otherwise the list fills with buttons that cannot work and the student has to
// learn to ignore the one thing that was meant to help them.
export function forgetSeat(code) {
  if (!code) return
  forgetSession(code)
}

// Marks a room as over instead of deleting it. `quiz-join` refuses `state = 'finished'`, so the seat can never be used
// to get back into that game -- but the token is still what a reload of `/play?code=<that code>` uses to paint the final
// result, and what the result card is drawn from. Deleting it would take that screen away; flagging it takes only the
// button that cannot work.
export function finishSeat(code) {
  if (!code) return
  const record = readStore(storeKey(code))
  if (record) writeStore(storeKey(code), { ...record, finished: true })
}

// Stamped on write so `rememberedSeats` can show the most recent room first. Ignored on read, so a record written by an
// older build (which had no timestamp) still resumes -- it just sorts last.
export function stampSeat(record) {
  return record ? { ...record, at: Date.now() } : record
}