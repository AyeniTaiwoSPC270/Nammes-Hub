import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import AuthCard from '../components/AuthCard'
import Button from '../components/ui/Button'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const justCreated = searchParams.get('created') === '1'
  const justReset = searchParams.get('reset') === '1'

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    setBusy(false)

    if (signInError) {
      setError('Wrong email or password')
      return
    }

    navigate(location.state?.from?.pathname ?? '/')
  }

  return (
    <AuthCard
      footer={
        <p className="text-sm text-ink-muted">
          Don&rsquo;t have an account?{' '}
          <Link to="/signup" className="font-semibold text-green-900 no-underline hover:text-orange-500 hover:underline">
            Create an account
          </Link>
        </p>
      }
      below={
        <>
          <span className="material-symbols-outlined text-base">shield</span>
          <span>Secure Institution Login</span>
        </>
      }
    >
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-green-900">NAMMES Hub</h1>
        <p className="mt-1 text-sm text-ink-muted">Sign in to your account</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {justCreated && (
          <p className="rounded-sm bg-success-bg px-3 py-2 text-sm text-success">
            Account created — sign in below.
          </p>
        )}
        {justReset && (
          <p className="rounded-sm bg-success-bg px-3 py-2 text-sm text-success">
            Password reset — sign in with your new password.
          </p>
        )}

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
              placeholder="name@university.edu"
              required
              className="w-full rounded-md border border-hairline bg-surface py-2.5 pl-10 pr-3 text-base text-ink outline-none transition-colors focus:border-green-900"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-xs font-semibold uppercase tracking-[.05em] text-orange-600">
              Password
            </label>
            <Link to="/forgot-password" className="text-xs text-green-900 no-underline hover:text-orange-500 hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">
              lock
            </span>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className={[
                'w-full rounded-md border bg-surface py-2.5 pl-10 pr-3 text-base text-ink outline-none transition-colors',
                error ? 'border-danger' : 'border-hairline focus:border-green-900',
              ].join(' ')}
            />
          </div>
          {error && <span className="text-xs text-danger">{error}</span>}
        </div>

        <Button variant="primary" type="submit" loading={busy} className="justify-center">
          Sign In
          <span className="material-symbols-outlined text-base">arrow_forward</span>
        </Button>
      </form>
    </AuthCard>
  )
}
