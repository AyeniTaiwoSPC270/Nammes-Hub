import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthCard from '../components/AuthCard'
import Button from '../components/ui/Button'
import FormField from '../components/ui/FormField'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setTimeout(() => {
      setBusy(false)
      setSent(true)
    }, 900)
  }

  if (sent) {
    return (
      <AuthCard>
        <div className="flex w-[340px] max-w-[92vw] flex-col gap-4 rounded-[8px] bg-white p-8 shadow-md sm:max-w-[90vw]">
          <h2 className="text-[22px]">Check your email</h2>
          <p className="text-sm leading-relaxed text-ink-muted">
            If an account exists for <span className="font-medium text-ink">{email}</span>, we&rsquo;ve sent a link
            to reset your password.
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
        <h2 className="text-[22px]">Forgot password</h2>
        <p className="text-sm leading-relaxed text-ink-muted">
          Enter your email and we&rsquo;ll send you a link to reset your password.
        </p>

        <FormField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@unilag.edu.ng"
        />

        <Button variant="primary" type="submit" loading={busy}>
          Send reset link
        </Button>
        <Button variant="ghost" type="button" onClick={() => navigate('/login')}>
          Cancel
        </Button>

        <p className="text-center text-sm text-ink-muted">
          Remembered it?{' '}
          <Link to="/login" className="text-green-700 no-underline hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthCard>
  )
}
