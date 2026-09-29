import { supabase } from './supabaseClient'

// 'off'       no second factor enrolled
// 'challenge' enrolled, but this session has not passed the second step yet
// 'verified'  this session passed the second step
export function aalStatus(levels) {
  const { currentLevel, nextLevel } = levels ?? {}
  if (currentLevel === 'aal2') return 'verified'
  if (currentLevel === 'aal1' && nextLevel === 'aal2') return 'challenge'
  return 'off'
}

export const cleanCode = (value) => String(value ?? '').replace(/\D/g, '').slice(0, 6)
export const isCompleteCode = (value) => /^\d{6}$/.test(value)

export async function getAalStatus() {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error) return 'off'
  return aalStatus(data)
}

export async function listVerifiedFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) throw error
  return data.totp ?? []
}

// Starts enrolment. Any half-finished attempt from earlier is removed first so the name never clashes.
export async function startEnrollment() {
  const { data: factors } = await supabase.auth.mfa.listFactors()
  for (const factor of factors?.all ?? []) {
    if (factor.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: factor.id })
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
  })
  if (error) throw error
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
}

export async function confirmEnrollment(factorId, code) {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
  if (error) throw error
}

// Verifies the six-digit code for the user's enrolled factor (used at sign-in).
export async function verifyLoginCode(code) {
  const factors = await listVerifiedFactors()
  const factor = factors[0]
  if (!factor) throw new Error('No authenticator is set up for this account.')
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code })
  if (error) throw error
}

export async function removeFactor(factorId) {
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  if (error) throw error
}
