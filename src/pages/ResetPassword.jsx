import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthShell, { AuthHeading, AuthSecureNote, AuthSubmit } from '../components/AuthShell'
import AuthNotice from '../components/AuthNotice'
import FormField from '../components/ui/FormField'
import { supabase } from '../lib/supabaseClient'
import { PASSWORD_RULE, validatePassword } from '../lib/passwordRules'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session)
      setChecking(false)
    })
  }, [])

  if (checking) {
    return <AuthShell>{null}</AuthShell>
  }

  if (!hasSession) {
    return (
      <AuthShell>
        <div className="flex flex-col">
          <span className="material-symbols-outlined text-4xl text-danger" aria-hidden="true">
            error_outline
          </span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-ink-900">Link expired</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            This password reset link is invalid or has expired. Request a new one to continue.
          </p>
          <AuthSubmit type="button" className="mt-6" onClick={() => navigate('/forgot-password')}>
            Request a new link
          </AuthSubmit>
        </div>
      </AuthShell>
    )
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')

    const nextErrors = {}
    const passwordError = validatePassword(password)
    if (passwordError) {
      nextErrors.password = passwordError
    }
    if (password !== confirmPassword) {
      nextErrors.confirmPassword = 'Passwords don’t match'
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setBusy(true)

    const { error } = await supabase.auth.updateUser({ password })

    setBusy(false)

    if (error) {
      setFormError(error.message)
      return
    }

    // The recovery link signs the visitor in, so /login would send them home before the confirmation
    // showed. Ending the session first is also what the screen promises: sign in with the new password.
    await supabase.auth.signOut()
    navigate('/login?reset=1')
  }

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="flex flex-col">
        <AuthHeading
          eyebrow="Final step"
          title="Choose a new password"
          description="You'll sign in with it from now on."
        />

        {formError && (
          <AuthNotice tone="danger" className="mt-5">
            {formError}
          </AuthNotice>
        )}

        <div className="mt-5 flex flex-col gap-4">
          <FormField
            label="New password"
            type="password"
            revealable
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            helper={!errors.password ? PASSWORD_RULE : undefined}
            error={errors.password}
          />
          <FormField
            label="Confirm new password"
            type="password"
            revealable
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={errors.confirmPassword}
          />

          <AuthSubmit type="submit" loading={busy}>
            Reset password
          </AuthSubmit>
        </div>

        <AuthSecureNote />
      </form>
    </AuthShell>
  )
}
