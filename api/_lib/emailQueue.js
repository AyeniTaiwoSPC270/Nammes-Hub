import { chunk } from './chunk.js'

const INSERT_CHUNK = 500

// Saves emails to the outbox instead of sending them from the request. A worker sends them shortly after.
// Each row: { kind, to, subject, html, replyTo?, dedupeKey? }. Rows whose dedupeKey already exists are skipped,
// so a repeated webhook cannot queue the same email twice.
// Returns { queued, error }: queued counts rows handed to the database (skipped duplicates included).
export async function enqueueEmails(supabaseAdmin, rows) {
  let queued = 0
  for (const part of chunk(rows, INSERT_CHUNK)) {
    const { error } = await supabaseAdmin.from('email_outbox').upsert(
      part.map((row) => ({
        kind: row.kind,
        to_email: row.to,
        reply_to: row.replyTo ?? null,
        subject: row.subject,
        html: row.html,
        dedupe_key: row.dedupeKey ?? null,
      })),
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    )
    if (error) return { queued, error }
    queued += part.length
  }
  return { queued, error: null }
}

// Minutes to wait before attempt number n+1 after n failed attempts.
const BACKOFF_MINUTES = [1, 5, 15, 60, 240]
export const MAX_ATTEMPTS = BACKOFF_MINUTES.length

export function nextAttemptAt(attempts, now = new Date()) {
  const minutes = BACKOFF_MINUTES[Math.min(attempts, BACKOFF_MINUTES.length) - 1] ?? BACKOFF_MINUTES.at(-1)
  return new Date(now.getTime() + minutes * 60_000).toISOString()
}
