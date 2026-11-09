import create from './_lib/handlers/quiz-create.js'
import advance from './_lib/handlers/quiz-advance.js'
import join from './_lib/handlers/quiz-join.js'
import answer from './_lib/handlers/quiz-answer.js'
import state from './_lib/handlers/quiz-state.js'
import host from './_lib/handlers/quiz-host.js'
import powerup from './_lib/handlers/quiz-powerup.js'
import practice from './_lib/handlers/quiz-practice.js'
import battle from './_lib/handlers/quiz-battle.js'
import sets from './_lib/handlers/quiz-sets.js'
import cbt from './_lib/handlers/quiz-cbt.js'
import cast from './_lib/handlers/quiz-cast.js'
import open from './_lib/handlers/quiz-open.js'
import tick from './_lib/handlers/quiz-tick.js'

// One function for the live quiz routes (see api/account.js for why routes share functions).
// Called as /api/quiz?action=join and so on.
// `open` is the public list /play reads and `tick` is the signed autopilot clock pg_cron calls; neither adds a
// Vercel function, which is the reason they live here rather than in api/system.js.
const ACTIONS = { create, advance, join, answer, state, host, powerup, practice, battle, sets, cbt, cast, open, tick }

export default function handler(req, res) {
  const name = req.query?.action
  const action = typeof name === 'string' && Object.hasOwn(ACTIONS, name) ? ACTIONS[name] : null
  if (!action) {
    res.status(404).json({ error: 'Not found' })
    return
  }
  return action(req, res)
}
