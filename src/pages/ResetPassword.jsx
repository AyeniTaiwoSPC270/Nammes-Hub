import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthCard from '../components/AuthCard'
import Button from '../components/ui/Button'
import FormField from '../components/ui/FormField'
import { supabase } from '../lib/supabaseClient'

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
    return <AuthCard>{null}</AuthCard>
  }

  if (!hasSession) {
    return (
      <AuthCard>
        <div className="flex w-[340px] max-w-[92vw] flex-col gap-4 rounded-[8px] bg-white p-8 shadow-md sm:max-w-[90vw]">
          <h2 className="text-[22px]">Link expired</h2>
          <p className="text-sm leading-relaxed text-ink-muted">
            This password reset link is invalid or has expired. Request a new one to continue.
          </p>
          <Button variant="primary" type="button" onClick={() => navigate('/forgot-password')}>
            Request a new link
          </Button>
        </div>
      </AuthCard>
    )
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')

    const nextErrors = {}
    if (password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters'
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

    navigate('/login?reset=1')
  }

  return (
    <AuthCard>
      <form
        onSubmit={handleSubmit}
        className="flex w-[340px] max-w-[92vw] flex-col gap-4 rounded-[8px] bg-white p-8 shadow-md sm:max-w-[90vw]"
      >
        <h2 className="text-[22px]">Reset password</h2>

        {formError && (
          <p className="rounded-sm bg-danger-bg px-3 py-2 text-sm text-danger">{formError}</p>
        )}

        <p className="text-sm leading-relaxed text-ink-muted">Choose a new password for your account.</p>

        <FormField
          label="New password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          helper={!errors.password ? 'At least 8 characters' : undefined}
          error={errors.password}
        />
        <FormField
          label="Confirm new password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={errors.confirmPassword}
        />

        <Button variant="primary" type="submit" loading={busy}>
          Reset password
        </Button>
      </form>
    </AuthCard>
  )
}
