import adminIssues from './_lib/handlers/admin-issues.js'
import systemTest from './_lib/handlers/system-test.js'
import emailWorker from './_lib/handlers/email-worker.js'
import handbookBuild from './_lib/handlers/handbook-build.js'
import calendarReminders from './_lib/handlers/calendar-reminders.js'
import calendarIcs from './_lib/handlers/calendar-ics.js'
// The named export, not the default: og.js's default is the already-built handler, so importing it and calling it
// would fire the handler with no request.
import { createOgHandler } from './_lib/handlers/og.js'

// One function for the System page routes, the email worker, the calendar reminder worker, the handbook PDF
// builder (see api/account.js for why routes share functions) and the Open Graph previews.
//
// The OG tags ride along here because a function slot is not free: the Hobby plan allows twelve and all twelve are
// taken, so an OG endpoint of its own would have to displace a working one. Moving it later is a one-entry change
// should previews turn out to cold-start slowly, and nothing else depends on it being here.
const ACTIONS = {
  'admin-issues': adminIssues,
  'system-test': systemTest,
  'email-worker': emailWorker,
  'handbook-build': handbookBuild,
  'calendar-reminders': calendarReminders,
  'calendar-ics': calendarIcs,
  og: createOgHandler(),
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
