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

// Used by the System page's test button. Resolves { sent, eventId? , reason? } and never throws.
export async function sendTestError() {
  if (!enabled) {
    return {
      sent: false,
      reason: import.meta.env.PROD
        ? 'This build has no VITE_SENTRY_DSN. Add it in Vercel and redeploy.'
        : 'Error tracking only runs on the live site, not in local development.',
    }
  }
  try {
    const Sentry = await loadSentry()
    const eventId = Sentry.captureException(new Error('Test error from the System page'))
    const delivered = await Sentry.flush(4000)
    return delivered
      ? { sent: true, eventId }
      : { sent: false, reason: 'Sentry did not confirm receipt. An ad blocker or the security policy may be blocking it.' }
  } catch {
    return { sent: false, reason: 'Could not reach Sentry.' }
  }
}
