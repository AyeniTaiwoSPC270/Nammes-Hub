// The hosted Supabase project rejects anything shorter, so this number is not a style choice: it is
// the server's rule, and every screen that sets a password has to state it or the form says 8 while
// the server refuses 9. One constant, so the message and the check cannot drift apart again.
export const MIN_PASSWORD_LENGTH = 10

export const PASSWORD_RULE = `At least ${MIN_PASSWORD_LENGTH} characters`
export const PASSWORD_TOO_SHORT = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`

export function validatePassword(value) {
  return String(value ?? '').length < MIN_PASSWORD_LENGTH ? PASSWORD_TOO_SHORT : ''
}
