import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthCard from '../components/AuthCard'
import Button from '../components/ui/Button'
import FormField from '../components/ui/FormField'
import { supabase } from '../lib/supabaseClient'

export default function Signup() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')

    const nextErrors = {}
    if (!email.endsWith('.edu.ng')) {
      nextErrors.email = 'Use your university email (@unilag.edu.ng)'
    }
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

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/login?created=1`,
      },
    })

    setBusy(false)

    if (error) {
      setFormError(error.message)
      return
    }

    setSent(true)
  }

  if (sent) {
    return (
      <AuthCard>
        <div className="flex w-[340px] max-w-[92vw] flex-col gap-4 rounded-[8px] bg-white p-8 shadow-md sm:max-w-[90vw]">
          <h2 className="text-[22px]">Check your email</h2>
          <p className="text-sm leading-relaxed text-ink-muted">
            We&rsquo;ve sent a confirmation link to <span className="font-medium text-ink">{email}</span>. Click it
            to activate your account, then sign in.
          </p>
          <Button variant="primary" type="button" onClick={() => navigate('/login')}>
            Back to sign in
          </Button>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard>
      <form
        onSubmit={handleSubmit}
        className="flex w-[340px] max-w-[92vw] flex-col gap-4 rounded-[8px] bg-white p-8 shadow-md sm:max-w-[90vw]"
      >
        <h2 className="text-[22px]">Create account</h2>

        {formError && (
          <p className="rounded-sm bg-danger-bg px-3 py-2 text-sm text-danger">{formError}</p>
        )}

        <FormField label="Full name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Okafor" />
        <FormField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@unilag.edu.ng"
          error={errors.email}
        />
        <FormField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          helper={!errors.password ? 'At least 8 characters' : undefined}
          error={errors.password}
        />
        <FormField
          label="Confirm password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={errors.confirmPassword}
          success={confirmPassword.length > 0 && confirmPassword === password && !errors.confirmPassword}
        />

        <Button variant="primary" type="submit" loading={busy}>
          Create account
        </Button>
        <Button variant="ghost" type="button" onClick={() => navigate('/')}>
          Cancel
        </Button>

        <p className="text-center text-sm text-ink-muted">
          Already have an account?{' '}
          <Link to="/login" className="text-green-700 no-underline hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthCard>
  )
}
