const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const MAX_TOKEN_LENGTH = 2048

// Asks Cloudflare whether a Turnstile token is genuine. Any doubt (missing input, network failure,
// bad response) counts as "not verified".
export async function verifyTurnstile({ token, secret, ip, fetchImpl = fetch }) {
  if (!token || !secret || typeof token !== 'string' || token.length > MAX_TOKEN_LENGTH) return false
  try {
    const body = new URLSearchParams({ secret, response: token })
    if (ip) body.set('remoteip', ip)
    const response = await fetchImpl(VERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(5000) })
    if (!response.ok) return false
    const result = await response.json()
    return result.success === true
  } catch {
    return false
  }
}
