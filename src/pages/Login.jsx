import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthCard from '../components/AuthCard'
import Button from '../components/ui/Button'
import FormField from '../components/ui/FormField'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const navigate = useNavigate()
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

    navigate('/')
  }

  return (
    <AuthCard>
      <form
        onSubmit={handleSubmit}
        className="flex w-[340px] max-w-[92vw] flex-col gap-4 rounded-[8px] bg-white p-8 shadow-md sm:max-w-[90vw]"
      >
        <h2 className="text-[22px]">Sign in</h2>

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

        <FormField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@unilag.edu.ng"
        />
        <div className="flex flex-col gap-1.5">
          <FormField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error || undefined}
          />
          <Link to="/forgot-password" className="self-end text-xs text-green-700 no-underline hover:underline">
            Forgot password?
          </Link>
        </div>

        <Button variant="primary" type="submit" loading={busy}>
          Sign in
        </Button>
        <Button variant="ghost" type="button" onClick={() => navigate('/')}>
          Cancel
        </Button>

        <p className="text-center text-sm text-ink-muted">
          Don&rsquo;t have an account?{' '}
          <Link to="/signup" className="text-green-700 no-underline hover:underline">
            Create one
          </Link>
        </p>
      </form>
    </AuthCard>
  )
}
