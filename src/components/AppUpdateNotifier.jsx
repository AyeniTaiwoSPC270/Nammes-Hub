import { useEffect, useRef } from 'react'
import { useToast } from '../lib/ToastContext'
import { onUpdateAvailable } from '../lib/appUpdate'

const CHECK_INTERVAL = 5 * 60 * 1000
const ENTRY_SCRIPT_PATTERN = /\/assets\/index-[\w-]+\.js/

export default function AppUpdateNotifier() {
  const toast = useToast()
  const notifiedRef = useRef(false)

  useEffect(() => {
    function announce() {
      if (notifiedRef.current) return
      notifiedRef.current = true
      toast.info('A new version of NAMMES Hub is available.', {
        sticky: true,
        actionLabel: 'Refresh',
        onAction: () => window.location.reload(),
      })
    }

    const unsubscribe = onUpdateAvailable(announce)

    const currentScript = document.querySelector('script[type="module"][src*="/assets/"]')
    const baseline = currentScript?.getAttribute('src')?.match(ENTRY_SCRIPT_PATTERN)?.[0]
    if (!baseline) return unsubscribe

    async function checkForUpdate() {
      if (notifiedRef.current || document.visibilityState !== 'visible') return
      try {
        const res = await fetch('/index.html', { cache: 'no-store' })
        const html = await res.text()
        const latest = html.match(ENTRY_SCRIPT_PATTERN)?.[0]
        if (latest && latest !== baseline) announce()
      } catch {
        // network hiccup — try again next interval
      }
    }

    const interval = setInterval(checkForUpdate, CHECK_INTERVAL)
    document.addEventListener('visibilitychange', checkForUpdate)

    return () => {
      unsubscribe()
      clearInterval(interval)
      document.removeEventListener('visibilitychange', checkForUpdate)
    }
  }, [toast])

  return null
}
