import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { verifyTurnstile } from './_lib/turnstileVerify.js'
import { validateContact, validateAnswers } from './_lib/publicSubmission.js'
import { isUuid } from './_lib/validate.js'

// Public submissions (contact form, and responses to public forms from people who are not signed in).
// The Turnstile check happens here, on the server, so a bot cannot skip it by talking to the database directly.
export function createSubmitPublicHandler({
  getClient = getSupabaseAdmin,
  verify = verifyTurnstile,
  env = process.env,
} = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const body = req.body ?? {}
    if (body.type !== 'contact' && body.type !== 'form_response') {
      res.status(400).json({ error: 'Unsupported submission type' })
      return
    }

    // Rollout safety: with no site key configured the check is not in use and is skipped.
    // If the site key is set but the secret is missing, refuse rather than quietly skip a check that is meant to run.
    if (env.VITE_TURNSTILE_SITE_KEY) {
      if (!env.TURNSTILE_SECRET) {
        console.error('submit-public: TURNSTILE_SECRET is not set while the site key is')
        res.status(503).json({ error: 'Submissions are temporarily unavailable' })
        return
      }
      if (!body.token) {
        res.status(400).json({ error: 'Please complete the verification check' })
        return
      }
      const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      const verified = await verify({ token: body.token, secret: env.TURNSTILE_SECRET, ip })
      if (!verified) {
        res.status(403).json({ error: 'Verification failed. Reload the page and try again.' })
        return
      }
    }

    const supabaseAdmin = getClient()

    // Same pause switch the database rules honour for direct inserts.
    const { data: flag } = await supabaseAdmin.from('feature_flags').select('enabled').eq('key', 'public_forms').maybeSingle()
    if (flag && flag.enabled === false) {
      res.status(503).json({ error: 'Submissions are temporarily paused' })
      return
    }

    if (body.type === 'contact') {
      const checked = validateContact(body)
      if (!checked.ok) {
        res.status(400).json({ error: checked.error })
        return
      }
      const { error } = await supabaseAdmin.from('contact_messages').insert(checked.value)
      if (error) {
        console.error('submit-public: contact insert failed', error)
        res.status(500).json({ error: 'Could not send your message. Please try again.' })
        return
      }
      res.status(200).json({ ok: true })
      return
    }

    // form_response
    if (!isUuid(body.formId)) {
      res.status(400).json({ error: 'Invalid form' })
      return
    }
    const { data: form } = await supabaseAdmin
      .from('forms')
      .select('id, is_accepting_responses, closes_at, require_signin')
      .eq('id', body.formId)
      .maybeSingle()
    if (!form) {
      res.status(404).json({ error: 'Form not found' })
      return
    }
    const closed = !form.is_accepting_responses || (form.closes_at && new Date(form.closes_at) <= new Date())
    if (closed || form.require_signin) {
      res.status(403).json({ error: 'This form is not accepting anonymous responses' })
      return
    }
    const { data: questions } = await supabaseAdmin.from('form_questions').select('id').eq('form_id', form.id)
    if (!validateAnswers(body.answers, (questions ?? []).map((q) => q.id))) {
      res.status(400).json({ error: 'Your answers could not be read. Reload the form and try again.' })
      return
    }
    const { error } = await supabaseAdmin.from('form_responses').insert({
      form_id: form.id,
      respondent_id: null,
      respondent_email: null,
      answers: body.answers,
    })
    if (error) {
      console.error('submit-public: response insert failed', error)
      res.status(500).json({ error: 'Could not save your response. Please try again.' })
      return
    }
    res.status(200).json({ ok: true })
  }
}

export default createSubmitPublicHandler()
