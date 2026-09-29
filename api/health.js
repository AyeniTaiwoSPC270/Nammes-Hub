import { createClient } from '@supabase/supabase-js'

// Uptime probe: confirms the API runs and the database answers. Uses the public key and returns no data.
export default async function handler(_req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const started = Date.now()
  try {
    const db = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { error } = await db.from('site_content').select('id', { head: true, count: 'exact' }).limit(1)
    res.status(error ? 503 : 200).json({ ok: !error, latencyMs: Date.now() - started })
  } catch {
    res.status(503).json({ ok: false, latencyMs: Date.now() - started })
  }
}
