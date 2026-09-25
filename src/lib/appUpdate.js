const listeners = new Set()

export function notifyUpdateAvailable() {
  listeners.forEach((fn) => fn())
}

export function onUpdateAvailable(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
