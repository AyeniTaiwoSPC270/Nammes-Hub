// Authenticates calls from the database (webhook triggers and the email worker schedule).
// A signed request (timestamp + HMAC over "<timestamp>.<table>.<key>") is verified inside the database against
// the Vault secret. The old raw shared-secret header is no longer accepted.

const SAFE_KEY_RE = /^[A-Za-z0-9_-]{1,200}$/

// Record ids end up in email links and in the signed string, so only plain id characters are allowed.
export const isSafeRecordKey = (value) => typeof value === 'string' && SAFE_KEY_RE.test(value)

export async function isWebhookAuthentic(supabaseAdmin, { headers, table, key }) {
  const sig = headers['x-webhook-signature']
  const ts = Number(headers['x-webhook-timestamp'])
  if (!sig || !Number.isInteger(ts)) return false
  const { data } = await supabaseAdmin.rpc('verify_webhook_signature', {
    p_ts: ts,
    p_table: table,
    p_key: key,
    p_sig: String(sig),
  })
  return data === true
}
