import { useEffect, useRef } from 'react'
import { useToast } from '../lib/ToastContext'
import { getBaselineEntry, hasNewDeploy, onUpdateAvailable } from '../lib/appUpdate'

const CHECK_INTERVAL = 5 * 60 * 1000

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

    if (!getBaselineEntry()) return unsubscribe

    async function checkForUpdate() {
      if (notifiedRef.current || document.visibilityState !== 'visible') return
      if (await hasNewDeploy()) announce()
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
