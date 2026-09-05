import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthCard from '../components/AuthCard'
import Button from '../components/ui/Button'
import FormField from '../components/ui/FormField'
import { supabase } from '../lib/supabaseClient'
import { validateStudentId, isStudentIdTaken } from '../data/profiles'

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

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')

    const nextErrors = {}
    const studentIdError = validateStudentId(studentId)
    if (studentIdError) {
      nextErrors.studentId = studentIdError
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

    const taken = await isStudentIdTaken(studentId)
    if (taken) {
      setBusy(false)
      setErrors({ studentId: 'This matric number is already registered to another account.' })
      return
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name, student_id: studentId.trim() },
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
      <AuthCard maxWidth="max-w-[480px]">
        <div className="flex w-full flex-col gap-4">
          <h2 className="text-2xl font-bold text-ink-900">Check your email</h2>
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
    <AuthCard maxWidth="max-w-[480px]">
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
        <h2 className="text-2xl font-bold text-ink-900">Create account</h2>

        {formError && (
          <p className="rounded-sm bg-danger-bg px-3 py-2 text-sm text-danger">{formError}</p>
        )}

        <FormField label="Full name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Okafor" />
        <FormField
          label="Student ID"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          placeholder="e.g. 240406012"
          error={errors.studentId}
        />
        <FormField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
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
          <Link to="/login" className="text-green-900 no-underline hover:text-orange-500 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthCard>
  )
}
