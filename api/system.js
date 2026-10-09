import adminIssues from './_lib/handlers/admin-issues.js'
import systemTest from './_lib/handlers/system-test.js'
import emailWorker from './_lib/handlers/email-worker.js'
import handbookBuild from './_lib/handlers/handbook-build.js'
import calendarReminders from './_lib/handlers/calendar-reminders.js'

// One function for the System page routes, the email worker, the calendar reminder worker and the handbook PDF
// builder (see api/account.js for why routes share functions).
const ACTIONS = {
  'admin-issues': adminIssues,
  'system-test': systemTest,
  'email-worker': emailWorker,
  'handbook-build': handbookBuild,
  'calendar-reminders': calendarReminders,
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
