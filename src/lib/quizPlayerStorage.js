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
// The server has the final say -- the token is verified on resume -- so a stale entry here costs one failed tap.
export function rememberedSeats() {
  try {
    const prefix = `${STORAGE_KEY}:`
    const seats = []
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(prefix) || key === INDEX_KEY) continue
      const record = readStore(key)
      if (!record) continue
      seats.push({
        code: record.code ?? key.slice(prefix.length),
        nickname: typeof record.nickname === 'string' ? record.nickname : '',
        at: Number(record.at) || 0,
      })
    }
    return seats.sort((a, b) => b.at - a.at).slice(0, INDEX_LIMIT)
  } catch {
    return []
  }
}

// Stamped on write so `rememberedSeats` can show the most recent room first. Ignored on read, so a record written by an
// older build (which had no timestamp) still resumes -- it just sorts last.
export function stampSeat(record) {
  return record ? { ...record, at: Date.now() } : record
}