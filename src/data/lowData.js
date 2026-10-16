import { useSyncExternalStore } from 'react'

// Low-data mode, opted into per device and kept between visits.
//
// It exists because a quiz phone is often on the worst connection in the building, and the two halves of the problem
// are separate. A toggle cannot help the FIRST load -- 263 KB of fonts and backdrop have already arrived by the time
// anybody could press anything -- so that is /play/low's job. What this fixes is everything after the join: the poll
// interval, the backdrop, the characters, and the explanation text in the payload.
//
// Opt-in rather than automatic because the test is the one thing this cannot do: nothing in the browser can tell that
// data is expensive. A student on a metered hotspot knows and a student on campus wifi does not, and guessing wrong
// either way looks like a broken game.

const KEY = 'nammes-low-data'

function read() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    // private mode: the game plays at full quality rather than not at all
    return false
  }
}

let current = read()
const listeners = new Set()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener) {
  listeners.add(listener)
  // Another tab on the same device is a second phone on this game, so it has to agree.
  const onStorage = (event) => {
    if (event.key !== KEY) return
    current = read()
    emit()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function isLowData() {
  return current
}

export function setLowData(on) {
  const next = Boolean(on)
  if (next === current) return
  current = next
  try {
    if (next) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {
    // the setting still applies to this session; it just will not be there next time
  }
  emit()
}

export function useLowData() {
  // Server render always says no: an off-device render cannot know what this student's data costs.
  return useSyncExternalStore(subscribe, isLowData, () => false)
}

// The poll intervals live here rather than at each call site, because the point of the setting is that they move
// together and nobody should be able to change one and forget the other.
export const PLAYER_POLL_MS = 4000
export const PLAYER_POLL_LOW_MS = 8000
export const HOST_POLL_MS = 1500
export const HOST_POLL_LOW_MS = 2500

// Halving a request rate halves the radio's wake-ups too, which on a phone is most of the battery a quiz game costs.
export function playerPollMs(low) {
  return low ? PLAYER_POLL_LOW_MS : PLAYER_POLL_MS
}

export function hostPollMs(low) {
  return low ? HOST_POLL_LOW_MS : HOST_POLL_MS
}