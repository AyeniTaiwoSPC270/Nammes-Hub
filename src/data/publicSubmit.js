// Sends a public submission (contact message, or an anonymous form response) through the server,
// which checks the Turnstile token and saves it.
export async function submitPublic(payload) {
  const response = await fetch('/api/submit-public', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'Could not send that. Please try again.')
  return result
}
