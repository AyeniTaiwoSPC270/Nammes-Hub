import { useCallback, useEffect, useRef, useState } from 'react'

// navigator.onLine only reports whether an interface is up, which stays true behind a captive portal or a
// dead router, and browsers fire `online` for a connection that cannot reach anything. So every verdict here
// comes from a real request. Same reasoning as lazyRetry, which retries a dropped chunk import rather than
// trusting the browser.
const PROBE_URL = `${import.meta.env.BASE_URL || '/'}favicon.svg`
const POLL_MS = 4000
// Generous, because a slow link is a working link. Only a request that fails on its own counts as absent,
// so a few seconds of mobile data never costs the user a page that was about to arrive.
const PROBE_TIMEOUT_MS = 8000

const REACHABLE = 'reachable'
const ABSENT = 'absent'
const SLOW = 'slow'

async function probe() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return ABSENT
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  try {
    // Any response counts, including a 404 or a 500. Bytes moving is all this asks; a server that is up but
    // unhappy is the app's problem to report, not a missing connection.
    await fetch(PROBE_URL, { method: 'HEAD', cache: 'no-store', signal: controller.signal })
    return REACHABLE
  } catch (err) {
    // An abort is our own timeout expiring, which means the request was still in flight: that is a slow
    // link, not a dead one. A dead link rejects on its own, usually within milliseconds.
    return err?.name === 'AbortError' ? SLOW : ABSENT
  } finally {
    clearTimeout(timer)
  }
}

function initialStatus() {
  if (typeof navigator === 'undefined') return 'online'
  // navigator.onLine is only trusted when it says false: an interface that is down is not a guess.
  return navigator.onLine ? 'online' : 'checking'
}

// 'online' | 'offline' | 'slow' | 'checking'. Only 'offline' is acted on. 'slow' means the link works but is
// struggling, so the caller should carry on and let its own requests retry rather than blocking the user.
// This hook only reports; it never reloads or navigates, because the page it is shown on is one the user is
// already reading and pulling it out from under them is worse than waiting.
export function useOnlineStatus() {
  const [status, setStatus] = useState(initialStatus)
  const wasOffline = useRef(false)
  const isDown = useRef(false)
  const inFlight = useRef(false)

  // showChecking is off for background polls, so the screen doesn't flicker to "Checking..." every 4s. A
  // probe can outlive the interval that started it, so overlapping ones are dropped rather than queued up
  // alongside the app's own requests.
  const settle = useCallback(async (showChecking) => {
    if (inFlight.current) return
    inFlight.current = true
    if (showChecking) setStatus('checking')
    try {
      const verdict = await probe()

      if (verdict === REACHABLE) {
        isDown.current = false
        wasOffline.current = false
        setStatus('online')
        return
      }

      if (verdict === ABSENT) {
        isDown.current = true
        wasOffline.current = true
        setStatus('offline')
        return
      }

      // Slow. If we are already showing the offline notice we keep it, because nothing has come back to
      // prove otherwise and swapping the user onto a page that then stalls is worse than waiting.
      setStatus(isDown.current ? 'offline' : 'slow')
    } finally {
      inFlight.current = false
    }
  }, [])

  const retry = useCallback(() => {
    settle(true)
  }, [settle])

  useEffect(() => {
    const onOffline = () => {
      isDown.current = true
      wasOffline.current = true
      setStatus('offline')
    }
    const onOnline = () => {
      settle(true)
    }
    // A tab left open in the background can come back to a dead connection without ever firing `offline`,
    // because the browser may have brought the interface down quietly. Ask the moment it is looked at again.
    const onVisible = () => {
      if (document.visibilityState === 'visible') settle(false)
    }

    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    settle(false)

    // Keep asking only once we have actually lost the connection, so a page that is merely slow is left
    // alone.
    const timer = setInterval(() => {
      if (wasOffline.current && document.visibilityState === 'visible') settle(false)
    }, POLL_MS)

    return () => {
      clearInterval(timer)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [settle])

  return { status, retry }
}
