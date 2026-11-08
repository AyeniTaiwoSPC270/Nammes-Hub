import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthShell, { AuthHeading, AuthSecureNote, AuthSubmit } from '../components/AuthShell'
import FormField from '../components/ui/FormField'
import { supabase } from '../lib/supabaseClient'
import TurnstileWidget, { useTurnstile } from '../components/TurnstileWidget'
import { captchaOptions, canSubmitWithCaptcha } from '../lib/turnstile'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const captcha = useTurnstile()

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)

    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
      ...captchaOptions(captcha.token),
    })

    setBusy(false)
    setSent(true)
  }

  return (
    <AuthShell>
      {sent ? (
        <div className="flex flex-col">
          <span className="material-symbols-outlined text-4xl text-success" aria-hidden="true">
            check_circle
          </span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-ink-900">Check your email</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            If an account exists for <span className="font-medium text-ink">{email}</span>, we&rsquo;ve sent instructions
            to reset your password.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-flex items-center justify-center gap-1.5 self-start text-sm font-semibold text-brand no-underline hover:text-orange-600 hover:underline"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              arrow_back
            </span>
            Return to sign in
          </Link>
          <AuthSecureNote />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col">
          <AuthHeading
            eyebrow="Password help"
            title="Reset your password"
            description="Enter your email and we'll send a reset link. It expires in an hour."
          />

          <div className="mt-5 flex flex-col gap-4">
            <FormField
              label="Email address"
              icon="mail"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />

            <TurnstileWidget onToken={captcha.setToken} resetKey={captcha.resetKey} />

            <AuthSubmit type="submit" loading={busy} disabled={!canSubmitWithCaptcha(captcha)}>
              Send reset link
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                arrow_forward
              </span>
            </AuthSubmit>
          </div>

          <p className="mt-5 text-center text-sm">
            <Link to="/login" className="font-semibold text-brand no-underline hover:text-orange-600 hover:underline">
              Back to sign in
            </Link>
          </p>

          <AuthSecureNote />
        </form>
      )}
    </AuthShell>
  )
}
