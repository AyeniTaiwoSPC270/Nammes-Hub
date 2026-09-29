// Authenticates calls from the database webhook trigger.
// Preferred: a signed request (timestamp + HMAC), verified inside the database against the Vault secret.
// Legacy: the raw shared secret header. Kept only until the trigger has been switched to signing; remove afterwards.

const SAFE_KEY_RE = /^[A-Za-z0-9_-]{1,200}$/

// Record ids end up in email links and in the signed string, so only plain id characters are allowed.
export const isSafeRecordKey = (value) => typeof value === 'string' && SAFE_KEY_RE.test(value)

export async function isWebhookAuthentic(supabaseAdmin, { headers, table, key }) {
  const sig = headers['x-webhook-signature']
  const rawTs = headers['x-webhook-timestamp']
  if (sig || rawTs) {
    const ts = Number(rawTs)
    if (!sig || !Number.isInteger(ts)) return false
    const { data } = await supabaseAdmin.rpc('verify_webhook_signature', {
      p_ts: ts,
      p_table: table,
      p_key: key,
      p_sig: String(sig),
    })
    return data === true
  }

  const legacy = headers['x-webhook-secret']
  if (!legacy) return false
  const { data } = await supabaseAdmin.rpc('verify_webhook_secret', { candidate: legacy })
  return data === true
}
