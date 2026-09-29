import adminIssues from './_lib/handlers/admin-issues.js'
import systemTest from './_lib/handlers/system-test.js'

// One function for the owner's System page routes (see api/account.js for why routes share functions).
const ACTIONS = {
  'admin-issues': adminIssues,
  'system-test': systemTest,
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
