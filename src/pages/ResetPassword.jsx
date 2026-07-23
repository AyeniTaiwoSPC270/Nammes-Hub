import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AuthCard from '../components/AuthCard'
import Button from '../components/ui/Button'
import FormField from '../components/ui/FormField'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  if (!token) {
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

  function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)

    setTimeout(() => {
      setBusy(false)
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

      navigate('/login?reset=1')
    }, 900)
  }

  return (
    <AuthCard>
      <form
        onSubmit={handleSubmit}
        className="flex w-[340px] max-w-[92vw] flex-col gap-4 rounded-[8px] bg-white p-8 shadow-md sm:max-w-[90vw]"
      >
        <h2 className="text-[22px]">Reset password</h2>
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
