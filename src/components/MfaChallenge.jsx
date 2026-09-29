import { useState } from 'react'
import Button from './ui/Button'
import { cleanCode, isCompleteCode, verifyLoginCode } from '../lib/mfa'

// Asks for the six-digit code from the authenticator app. Used after the password at sign-in
// and in front of the admin area for admins who have set up two-factor login.
export default function MfaChallenge({ onVerified, onCancel }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!isCompleteCode(code)) {
      setError('Enter the 6-digit code from your authenticator app.')
      return
    }
    setError('')
    setBusy(true)
    try {
      await verifyLoginCode(code)
      onVerified()
    } catch {
      setError('That code did not work. Check the code and try again.')
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-brand">Two-factor check</h1>
        <p className="mt-1 text-sm text-ink-muted">Enter the 6-digit code from your authenticator app.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="mfa-code" className="text-xs font-semibold uppercase tracking-[.05em] text-orange-600">
          Authentication code
        </label>
        <input
          id="mfa-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          value={code}
          onChange={(e) => setCode(cleanCode(e.target.value))}
          placeholder="123456"
          className={[
            'w-full rounded-md border bg-surface px-3 py-2.5 text-center text-xl tracking-[.3em] text-ink outline-none transition-colors',
            error ? 'border-danger' : 'border-hairline focus:border-brand',
          ].join(' ')}
        />
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>

      <Button variant="primary" type="submit" loading={busy} className="justify-center">
        Verify
      </Button>
      {onCancel && (
        <Button variant="ghost" type="button" onClick={onCancel} className="justify-center">
          Sign out
        </Button>
      )}
    </form>
  )
}
