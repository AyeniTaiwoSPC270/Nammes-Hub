import { Resend } from 'resend'

export const FROM_ADDRESS = 'NAMMES Hub <no-reply@nammeshub.com.ng>'

export function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('Missing RESEND_API_KEY')
  return new Resend(apiKey)
}
