import { boundedString } from './validate.js'

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/
const MAX_ANSWERS_BYTES = 50_000

// Same limits as the contact_messages database constraint, checked before anything is saved.
export function validateContact(body) {
  const { name, email, message } = body ?? {}
  if (!boundedString(name, 1, 100)) return { ok: false, error: 'Enter your name (up to 100 characters).' }
  if (!boundedString(email, 3, 254) || !EMAIL_RE.test(email.trim())) return { ok: false, error: 'Enter a valid email address.' }
  if (!boundedString(message, 1, 5000)) return { ok: false, error: 'Enter a message (up to 5000 characters).' }
  return { ok: true, value: { name: name.trim(), email: email.trim(), message: message.trim() } }
}

// The four report categories, as a closed list. Shared by the handler and its test so a category
// added on one side cannot leave the other accepting something the database would reject.
export const REPORT_CATEGORIES = ['broken_link', 'wrong_info', 'outdated', 'other']

// A report carries no name and no email: there is nothing to reply to. What it must carry is the
// page it is about, so the admin can go and look -- an absolute or off-site URL would point them
// somewhere else entirely, hence the leading-slash rule.
export function validateReport(body) {
  const { category, page_url: pageUrl, page_title: pageTitle, message } = body ?? {}
  if (!REPORT_CATEGORIES.includes(category)) {
    return { ok: false, error: 'Choose what kind of problem this is.' }
  }
  if (typeof pageUrl !== 'string' || !pageUrl.startsWith('/') || pageUrl.startsWith('//') || pageUrl.length > 300) {
    return { ok: false, error: 'That page address could not be read. Reload the page and try again.' }
  }
  if (!boundedString(pageTitle, 1, 200)) {
    return { ok: false, error: 'The page title is missing. Reload the page and try again.' }
  }
  const note = typeof message === 'string' ? message : ''
  if (note.trim().length > 1000) {
    return { ok: false, error: 'Keep the note to 1000 characters or fewer.' }
  }
  return {
    ok: true,
    value: {
      category,
      page_url: pageUrl.trim(),
      page_title: pageTitle.trim(),
      message: note.trim(),
    },
  }
}

// The five reasons the rating modal offers. Same reasoning as REPORT_CATEGORIES: one list, checked
// here and asserted against its labels by the browser's own test.
export const FEEDBACK_CATEGORIES = ['design', 'content', 'speed', 'bugs', 'other']

// A rating needs no identity, no email and no account -- `user_id` is resolved by the handler from
// a token the caller may or may not have sent, never taken from this payload.
export function validateFeedback(body) {
  const { rating, category, message, page_path: pagePath } = body ?? {}
  const value = Number(rating)
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    return { ok: false, error: 'Choose a rating from 1 to 5.' }
  }
  if (category !== undefined && category !== null && category !== '' && !FEEDBACK_CATEGORIES.includes(category)) {
    return { ok: false, error: 'Choose one of the suggested reasons.' }
  }
  const text = typeof message === 'string' ? message : ''
  if (text.trim().length > 1000) {
    return { ok: false, error: 'Keep your comment to 1000 characters or fewer.' }
  }
  if (typeof pagePath !== 'string' || !pagePath.startsWith('/') || pagePath.startsWith('//') || pagePath.length > 300) {
    return { ok: false, error: 'That page address could not be read. Reload the page and try again.' }
  }
  return {
    ok: true,
    value: {
      rating: value,
      category: category || null,
      message: text.trim() || null,
      page_path: pagePath.trim(),
    },
  }
}

// Answers must be a plain object keyed by this form's own question ids, and not huge.
export function validateAnswers(answers, questionIds) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return false
  const allowed = new Set(questionIds)
  if (!Object.keys(answers).every((key) => allowed.has(key))) return false
  return JSON.stringify(answers).length <= MAX_ANSWERS_BYTES
}
