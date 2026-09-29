import { getSupabaseAdmin } from '../supabaseAdmin.js'
import { bearerToken, getCaller } from '../authz.js'
import { logError } from '../logError.js'

// Owner-only self-test used by the System page: writes one labelled row to the server error log,
// proving the API can reach the database with the service role and that the log is readable.
export function createSystemTestHandler({ getClient = getSupabaseAdmin } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    const supabaseAdmin = getClient()
    const caller = await getCaller(supabaseAdmin, bearerToken(req))
    if (caller.error) {
      res.status(caller.error[0]).json({ error: caller.error[1] })
      return
    }
    if (!caller.isOwner) {
      res.status(403).json({ error: 'Owner access required' })
      return
    }

    const logged = await logError(supabaseAdmin, 'system-test', 'Test error triggered from the System page', 500)
    res.status(logged ? 200 : 500).json({ logged })
  }
}

export default createSystemTestHandler()
