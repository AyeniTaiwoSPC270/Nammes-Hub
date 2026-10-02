import { useCallback, useEffect, useRef, useState } from 'react'

// navigator.onLine only reports whether an interface is up, which stays true behind a captive portal or a
// dead router, and browsers fire `online` for a connection that cannot reach anything. So every verdict
// here comes from a real request; the flag is only used to avoid asking when we already know it's hopeless.
// Same reasoning as lazyRetry, which retries a dropped chunk import rather than trusting the browser.
const PROBE_URL = `${import.meta.env.BASE_URL || '/'}favicon.svg`
const POLL_MS = 4000
const PROBE_TIMEOUT_MS = 5000
const RELOAD_DELAY_MS = 1200

async function confirmReachable() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  try {
    await fetch(PROBE_URL, { cache: 'no-store', signal: controller.signal })
    // Any response at all counts, including a 404 or a 500. Bytes moving is all this is asking; a server
    // that is up but unhappy is the app's problem to report, not a missing connection.
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

function initialStatus() {
  if (typeof navigator === 'undefined') return 'online'
  // navigator.onLine is only ever trusted when it says false: an interface that is down is not a guess,
  // so we skip the round trip that would otherwise flash a screen of failing queries on a cold load.
  return navigator.onLine ? 'online' : 'offline'
}

// status is one of 'online' | 'offline' | 'checking'. Callers gate on 'offline' and can treat 'checking'
// as the transient "we're verifying" state, which is why the screen has three looks and not two.
export function useOnlineStatus() {
  const [status, setStatus] = useState(initialStatus)
  const hasBeenOffline = useRef(false)
  const inFlight = useRef(false)

  // showChecking is off for background polls, so the screen doesn't flicker to "Checking..." every 4s.
  // A probe can outlive the interval that started it (it waits up to PROBE_TIMEOUT_MS on a dead network),
  // so overlapping ones are dropped rather than allowed to queue up against the app's own requests.
  const settle = useCallback(async (showChecking) => {
    if (inFlight.current) return false
    inFlight.current = true
    if (showChecking) setStatus('checking')
    try {
      const reachable = await confirmReachable()
      if (!reachable) hasBeenOffline.current = true
      setStatus(reachable ? 'online' : 'offline')
      return reachable
    } finally {
      inFlight.current = false
    }
  }, [])

  const retry = useCallback(() => {
    settle(true)
  }, [settle])

  useEffect(() => {
    const onOffline = () => {
      hasBeenOffline.current = true
      setStatus('offline')
    }
    const onOnline = () => {
      settle(true)
    }

    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    settle(false)

    // Keep asking for as long as we're down. A tab that sat idle in the background can come back to a
    // dead connection without ever firing `offline`, and the poll is what notices.
    const timer = setInterval(() => {
      if (hasBeenOffline.current && document.visibilityState === 'visible') settle(false)
    }, POLL_MS)

    return () => {
      clearInterval(timer)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [settle])

  // Once a real request has succeeded after an outage, put the user back on the page they asked for
  // rather than leaving them on a screen about having no connection.
  useEffect(() => {
    if (status !== 'online' || !hasBeenOffline.current) return undefined
    const timer = setTimeout(() => window.location.reload(), RELOAD_DELAY_MS)
    return () => clearTimeout(timer)
  }, [status])

  return { status, retry }
}