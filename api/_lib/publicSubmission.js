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

// Answers must be a plain object keyed by this form's own question ids, and not huge.
export function validateAnswers(answers, questionIds) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return false
  const allowed = new Set(questionIds)
  if (!Object.keys(answers).every((key) => allowed.has(key))) return false
  return JSON.stringify(answers).length <= MAX_ANSWERS_BYTES
}
