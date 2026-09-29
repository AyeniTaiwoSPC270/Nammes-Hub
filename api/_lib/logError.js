// Best-effort error log for routes that need a login, plus the webhooks. Never throws:
// logging must not turn a handled failure into a new one. Public routes are deliberately not
// logged here, because anyone could trigger errors on purpose to fill the table.
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const MATRIC_RE = /\b\d{2}0406\d{3}\b/g
const BEARER_RE = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi
const JWT_RE = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g
const MAX_LENGTH = 500

export function scrubForLog(text) {
  return String(text)
    .replace(BEARER_RE, 'Bearer [token]')
    .replace(JWT_RE, '[token]')
    .replace(EMAIL_RE, '[email]')
    .replace(MATRIC_RE, '[matric]')
    .slice(0, MAX_LENGTH)
}

export async function logError(supabaseAdmin, route, error, status, nowMs = Date.now()) {
  try {
    const raw = typeof error === 'string' ? error : (error?.message ?? String(error))
    await supabaseAdmin.from('error_log').upsert(
      { route, status: status ?? null, message: scrubForLog(raw), bucket: Math.floor(nowMs / 60000) },
      { onConflict: 'route,message,bucket', ignoreDuplicates: true },
    )
  } catch {
    // Swallowed on purpose; the original console.error already recorded the failure in Vercel logs.
  }
}
