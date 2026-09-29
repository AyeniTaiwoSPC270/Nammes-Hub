// Cloudflare Turnstile helpers. The check is optional: with no site key configured the widget renders
// nothing and forms behave exactly as before, so local development and the rollout order stay safe.
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''
export const captchaEnabled = Boolean(TURNSTILE_SITE_KEY)

export const captchaOptions = (token) => (token ? { captchaToken: token } : {})
export const canSubmitWithCaptcha = ({ enabled, token }) => !enabled || Boolean(token)

let scriptPromise = null
export function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.onload = () => resolve(window.turnstile)
      script.onerror = () => {
        scriptPromise = null
        reject(new Error('Could not load the verification check.'))
      }
      document.head.appendChild(script)
    })
  }
  return scriptPromise
}
