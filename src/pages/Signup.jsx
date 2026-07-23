import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthCard from '../components/AuthCard'
import Button from '../components/ui/Button'
import FormField from '../components/ui/FormField'

export default function Signup() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)

    setTimeout(() => {
      setBusy(false)
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

      navigate('/login?created=1')
    }, 900)
  }

  return (
    <AuthCard>
      <form
        onSubmit={handleSubmit}
        className="flex w-[340px] max-w-[92vw] flex-col gap-4 rounded-[8px] bg-white p-8 shadow-md sm:max-w-[90vw]"
      >
        <h2 className="text-[22px]">Create account</h2>

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
