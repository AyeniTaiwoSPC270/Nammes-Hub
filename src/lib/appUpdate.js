const listeners = new Set()

const ENTRY_SCRIPT_PATTERN = /\/assets\/index-[\w-]+\.js/

export function notifyUpdateAvailable() {
  listeners.forEach((fn) => fn())
}

export function onUpdateAvailable(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getBaselineEntry() {
  const script = document.querySelector('script[type="module"][src*="/assets/"]')
  return script?.getAttribute('src')?.match(ENTRY_SCRIPT_PATTERN)?.[0]
}

// True only when the deployed index.html points at a different entry bundle
// than the one this tab loaded, i.e. a real new deploy.
export async function hasNewDeploy() {
  const baseline = getBaselineEntry()
  if (!baseline) return false
  try {
    const res = await fetch('/index.html', { cache: 'no-store' })
    const latest = (await res.text()).match(ENTRY_SCRIPT_PATTERN)?.[0]
    return Boolean(latest && latest !== baseline)
  } catch {
    return false
  }
}

export async function notifyIfNewDeploy() {
  if (await hasNewDeploy()) notifyUpdateAvailable()
}
