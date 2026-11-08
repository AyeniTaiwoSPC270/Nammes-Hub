import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import AuthShell, { AuthHeading, AuthSecureNote, AuthSubmit } from '../components/AuthShell'
import AuthNotice from '../components/AuthNotice'
import FormField from '../components/ui/FormField'
import MfaChallenge from '../components/MfaChallenge'
import { supabase } from '../lib/supabaseClient'
import { getAalStatus } from '../lib/mfa'
import TurnstileWidget, { useTurnstile } from '../components/TurnstileWidget'
import { captchaOptions, canSubmitWithCaptcha } from '../lib/turnstile'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [needsCode, setNeedsCode] = useState(false)
  const captcha = useTurnstile()

  const justCreated = searchParams.get('created') === '1'
  const justReset = searchParams.get('reset') === '1'
  const justDisabled = searchParams.get('disabled') === '1'

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaOptions(captcha.token),
    })

    if (signInError) {
      setBusy(false)
      captcha.reset()
      setError('Wrong email or password')
      return
    }

    // Accounts with two-factor login enabled must enter a code before continuing.
    const status = await getAalStatus()
    setBusy(false)
    if (status === 'challenge') {
      setNeedsCode(true)
      return
    }

    navigate(location.state?.from?.pathname ?? '/')
  }

  if (needsCode) {
    return (
      <AuthShell>
        <MfaChallenge
          onVerified={() => navigate(location.state?.from?.pathname ?? '/')}
          onCancel={async () => {
            await supabase.auth.signOut()
            setNeedsCode(false)
            setPassword('')
          }}
        />
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="flex flex-col">
        <AuthHeading
          eyebrow="Member sign in"
          title="Welcome back"
          description="Sign in with the email you registered with."
        />

        {(justCreated || justReset || justDisabled) && (
          <div className="mt-5 flex flex-col gap-3">
            {justCreated && <AuthNotice tone="success">Account created. Sign in below.</AuthNotice>}
            {justReset && <AuthNotice tone="success">Password reset. Sign in with your new password.</AuthNotice>}
            {justDisabled && <AuthNotice tone="danger">This account has been disabled. Contact an admin for help.</AuthNotice>}
          </div>
        )}

        <div className="mt-5 flex flex-col gap-4">
          <FormField
            label="Email address"
            icon="mail"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@university.edu"
            required
          />

          <div>
            <FormField
              label="Password"
              icon="lock"
              type="password"
              revealable
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              error={error}
            />
            <p className="mt-1.5 text-right">
              <Link to="/forgot-password" className="text-xs font-semibold text-brand no-underline hover:text-orange-600 hover:underline">
                Forgot password?
              </Link>
            </p>
          </div>

          <TurnstileWidget onToken={captcha.setToken} resetKey={captcha.resetKey} />

          <AuthSubmit
            type="submit"
            loading={busy}
            disabled={!canSubmitWithCaptcha(captcha)}
          >
            Sign in
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              arrow_forward
            </span>
          </AuthSubmit>
        </div>

        <p className="mt-5 text-center text-sm text-ink-muted">
          New to NAMMES Hub?{' '}
          <Link to="/signup" className="font-semibold text-brand no-underline hover:text-orange-600 hover:underline">
            Create an account
          </Link>
        </p>

        <AuthSecureNote />
      </form>
    </AuthShell>
  )
}
