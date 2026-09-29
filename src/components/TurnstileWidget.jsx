import { useCallback, useEffect, useRef, useState } from 'react'
import { TURNSTILE_SITE_KEY, captchaEnabled, loadTurnstileScript } from '../lib/turnstile'

// State for a form that uses the check: the current token, and a reset for after a failed attempt
// (a token can only be used once).
export function useTurnstile() {
  const [token, setToken] = useState('')
  const [resetKey, setResetKey] = useState(0)
  const reset = useCallback(() => {
    setToken('')
    setResetKey((k) => k + 1)
  }, [])
  return { token, setToken, resetKey, reset, enabled: captchaEnabled }
}

export default function TurnstileWidget({ onToken, resetKey = 0 }) {
  const containerRef = useRef(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!captchaEnabled) return undefined
    let widgetId
    let cancelled = false
    loadTurnstileScript()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return
        widgetId = turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token) => onToken(token),
          'expired-callback': () => onToken(''),
          'error-callback': () => onToken(''),
        })
      })
      .catch(() => setFailed(true))
    return () => {
      cancelled = true
      if (widgetId !== undefined && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [onToken, resetKey])

  if (!captchaEnabled) return null
  return (
    <div>
      <div ref={containerRef} />
      {failed && (
        <p className="text-xs text-danger">
          The verification check could not load. Disable any content blocker and reload the page.
        </p>
      )}
    </div>
  )
}
