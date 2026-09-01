import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthCard from '../components/AuthCard'
import Button from '../components/ui/Button'
import { supabase } from '../lib/supabaseClient'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)

    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setBusy(false)
    setSent(true)
  }

  return (
    <AuthCard maxWidth="max-w-[480px]">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-green-900">Forgot Password</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Enter your email address and we&rsquo;ll send you instructions to reset your password.
        </p>
      </div>

      {!sent && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-semibold uppercase tracking-[.05em] text-orange-600">
              Email Address
            </label>
            <div className="relative">
              <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">
                mail
              </span>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                required
                className="w-full rounded-md border border-hairline bg-surface py-2.5 pl-10 pr-3 text-base text-ink outline-none transition-colors focus:border-green-900"
              />
            </div>
          </div>

          <Button variant="primary" type="submit" loading={busy} className="justify-center">
            Reset Password
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </Button>
        </form>
      )}

      {sent && (
        <div className="flex flex-col items-center gap-2 rounded-md border border-hairline bg-surface-low p-6 text-center">
          <span className="material-symbols-outlined text-4xl text-green-900">check_circle</span>
          <h3 className="text-lg font-bold text-green-900">Check your email</h3>
          <p className="text-sm leading-relaxed text-ink-muted">
            If an account exists for <span className="font-medium text-ink">{email}</span>, we&rsquo;ve sent
            instructions to reset your password.
          </p>
        </div>
      )}

      <div className="mt-6 text-center">
        <Link
          to="/login"
          className="inline-flex items-center gap-1 text-sm font-semibold text-green-900 no-underline hover:text-orange-500 hover:underline"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Return to Sign In
        </Link>
      </div>
    </AuthCard>
  )
}
