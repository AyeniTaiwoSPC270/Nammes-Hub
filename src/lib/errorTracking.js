import { scrubEvent } from './sentryScrub'

// Error reporting is production-only and off unless VITE_SENTRY_DSN is set. The SDK loads lazily
// so it never delays the first paint.
const DSN = import.meta.env.VITE_SENTRY_DSN
const enabled = Boolean(DSN) && import.meta.env.PROD

let sentryPromise = null
function loadSentry() {
  if (!enabled) return null
  if (!sentryPromise) {
    sentryPromise = import('@sentry/react').then((Sentry) => {
      Sentry.init({
        dsn: DSN,
        sendDefaultPii: false,
        tracesSampleRate: 0,
        beforeSend: (event) => scrubEvent(event),
        beforeBreadcrumb: (crumb) => scrubEvent({ breadcrumb: crumb }).breadcrumb,
      })
      return Sentry
    })
  }
  return sentryPromise
}

export function initErrorTracking() {
  loadSentry()
}

export function reportError(error, context) {
  const loading = loadSentry()
  if (!loading) return
  loading.then((Sentry) => Sentry.captureException(error, context ? { extra: context } : undefined)).catch(() => {})
}
