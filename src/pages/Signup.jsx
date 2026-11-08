import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthShell, { AuthHeading, AuthSubmit } from '../components/AuthShell'
import AuthNotice from '../components/AuthNotice'
import Button from '../components/ui/Button'
import FormField from '../components/ui/FormField'
import { supabase } from '../lib/supabaseClient'
import { validateStudentId } from '../data/profiles'
import { PASSWORD_RULE, validatePassword } from '../lib/passwordRules'
import TurnstileWidget, { useTurnstile } from '../components/TurnstileWidget'
import { captchaOptions, canSubmitWithCaptcha } from '../lib/turnstile'

export default function Signup() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [studentId, setStudentId] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const captcha = useTurnstile()

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')

    const nextErrors = {}
    const studentIdError = validateStudentId(studentId)
    if (studentIdError) {
      nextErrors.studentId = studentIdError
    }
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

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        ...captchaOptions(captcha.token),
        data: { full_name: name, student_id: studentId.trim() },
        emailRedirectTo: `${window.location.origin}/login?created=1`,
      },
    })

    setBusy(false)

    if (error) {
      captcha.reset()
      // A duplicate matric number fails inside the database trigger and surfaces as this generic message.
      setFormError(
        /database error/i.test(error.message)
          ? 'We could not create this account. If you already registered, sign in instead; otherwise check that your matric number is correct.'
          : error.message,
      )
      return
    }

    setSent(true)
  }

  if (sent) {
    return (
      <AuthShell>
        <div className="flex flex-col">
          <span className="material-symbols-outlined text-4xl text-success" aria-hidden="true">
            mark_email_read
          </span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-ink-900">Check your email</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            We&rsquo;ve sent a confirmation link to <span className="font-medium text-ink">{email}</span>. Click it to
            activate your account, then sign in.
          </p>
          <AuthSubmit type="button" className="mt-6" onClick={() => navigate('/login')}>
            Back to sign in
          </AuthSubmit>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="flex flex-col">
        <AuthHeading
          eyebrow="New member"
          title="Create your account"
          description="Use your matric number and the email you check."
        />

        {formError && (
          <AuthNotice tone="danger" className="mt-5">
            {formError}
          </AuthNotice>
        )}

        <div className="mt-5 flex flex-col gap-4">
          <FormField
            label="Full name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ada Okafor"
          />
          <FormField
            label="Matric number"
            autoComplete="off"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="e.g. 240406012 or 260406009"
            error={errors.studentId}
          />
          <FormField
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            error={errors.email}
          />
          <FormField
            label="Password"
            type="password"
            revealable
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            helper={!errors.password ? PASSWORD_RULE : undefined}
            error={errors.password}
          />
          <FormField
            label="Confirm password"
            type="password"
            revealable
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={errors.confirmPassword}
            success={confirmPassword.length > 0 && confirmPassword === password && !errors.confirmPassword}
          />

          <TurnstileWidget onToken={captcha.setToken} resetKey={captcha.resetKey} />

          <AuthSubmit type="submit" loading={busy} disabled={!canSubmitWithCaptcha(captcha)}>
            Create account
          </AuthSubmit>
          <Button variant="ghost" type="button" className="w-full justify-center" onClick={() => navigate('/')}>
            Cancel
          </Button>
        </div>

        <p className="mt-5 text-center text-sm text-ink-muted">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand no-underline hover:text-orange-600 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
