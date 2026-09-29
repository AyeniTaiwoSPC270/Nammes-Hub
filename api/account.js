import disableUser from './_lib/handlers/disable-user.js'
import deleteUser from './_lib/handlers/delete-user.js'
import anonymiseUser from './_lib/handlers/anonymise-user.js'
import exportData from './_lib/handlers/export-data.js'

// Vercel's free plan allows 12 serverless functions, so related routes share one function.
// vercel.json rewrites the original URLs (for example /api/disable-user) to /api/account?action=disable-user.
const ACTIONS = {
  'disable-user': disableUser,
  'delete-user': deleteUser,
  'anonymise-user': anonymiseUser,
  'export-data': exportData,
}

export default function handler(req, res) {
  const name = req.query?.action
  const action = typeof name === 'string' && Object.hasOwn(ACTIONS, name) ? ACTIONS[name] : null
  if (!action) {
    res.status(404).json({ error: 'Not found' })
    return
  }
  return action(req, res)
}
