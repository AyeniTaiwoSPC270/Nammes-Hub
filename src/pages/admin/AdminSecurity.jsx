import { useCallback, useEffect, useState } from 'react'
import { useToast } from '../../lib/ToastContext'
import {
  listVerifiedFactors,
  startEnrollment,
  confirmEnrollment,
  removeFactor,
  cleanCode,
  isCompleteCode,
} from '../../lib/mfa'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import ErrorState from '../../components/ui/ErrorState'

export default function AdminSecurity() {
  const toast = useToast()
  const [factors, setFactors] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [enrolling, setEnrolling] = useState(null) // { factorId, qrCode, secret }
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      setLoadError('')
      setFactors(await listVerifiedFactors())
    } catch (e) {
      setLoadError(e.message || 'Could not load your security settings.')
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function begin() {
    setBusy(true)
    setError('')
    try {
      setEnrolling(await startEnrollment())
      setCode('')
    } catch (e) {
      setError(e.message || 'Could not start setup.')
    } finally {
      setBusy(false)
    }
  }

  async function submitCode(event) {
    event.preventDefault()
    if (!isCompleteCode(code)) {
      setError('Enter the 6-digit code shown in your authenticator app.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await confirmEnrollment(enrolling.factorId, code)
      setEnrolling(null)
      setCode('')
      toast.success('Two-factor login is now on.')
      await refresh()
    } catch {
      setError('That code did not work. Wait for a new code and try again.')
    } finally {
      setBusy(false)
    }
  }

  async function turnOff(factorId) {
    if (!window.confirm('Turn off two-factor login? Your account will only be protected by your password.')) return
    try {
      await removeFactor(factorId)
      toast.success('Two-factor login is off.')
      await refresh()
    } catch (e) {
      toast.error(e.message || 'Could not turn it off. Sign in again with your code and retry.')
    }
  }

  if (loadError && !factors) {
    return (
      <div className="mx-auto max-w-[720px] px-5 py-12 sm:px-6">
        <ErrorState message={loadError} onRetry={refresh} />
      </div>
    )
  }

  const enabled = (factors ?? []).length > 0

  return (
    <div className="mx-auto max-w-[720px] px-5 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-ink-900">Security</h1>
      <p className="mt-1 text-ink-muted">Protect your admin account with a second step at sign-in.</p>

      <div className="mt-6 rounded-lg border border-hairline bg-surface p-5 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">Two-factor login</h2>
            <p className="text-sm text-ink-muted">
              After your password you enter a 6-digit code from an authenticator app.
            </p>
          </div>
          {factors && <Badge tone={enabled ? 'updated' : 'neutral'}>{enabled ? 'On' : 'Off'}</Badge>}
        </div>

        {factors && !enabled && !enrolling && (
          <div className="mt-4">
            <Button variant="primary" onClick={begin} loading={busy}>
              Set up two-factor login
            </Button>
          </div>
        )}

        {enrolling && (
          <form onSubmit={submitCode} className="mt-5 flex flex-col gap-4">
            <ol className="list-decimal space-y-2 pl-5 text-sm text-ink">
              <li>Open an authenticator app (Google Authenticator, Microsoft Authenticator or Authy).</li>
              <li>Scan this code, or choose &ldquo;enter a setup key&rdquo; and type the key below it.</li>
              <li>Type the 6-digit code the app shows, then confirm.</li>
            </ol>
            <img src={enrolling.qrCode} alt="Authenticator setup code" className="h-44 w-44 rounded-md border border-hairline bg-white p-2" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.05em] text-orange-600">Setup key</p>
              <code className="mt-1 block break-all rounded-md bg-surface-low px-3 py-2 text-sm text-ink">{enrolling.secret}</code>
              <p className="mt-2 text-xs text-ink-muted">
                Save this key somewhere private, such as a password manager. If you lose your phone, it lets you set up
                a new device.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="enroll-code" className="text-xs font-semibold uppercase tracking-[.05em] text-orange-600">
                Code from the app
              </label>
              <input
                id="enroll-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(cleanCode(e.target.value))}
                placeholder="123456"
                className="w-48 rounded-md border border-hairline bg-surface px-3 py-2.5 text-center text-xl tracking-[.3em] text-ink outline-none focus:border-brand"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" type="submit" loading={busy}>
                Confirm and turn on
              </Button>
              <Button variant="ghost" type="button" onClick={() => setEnrolling(null)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {enabled && (
          <div className="mt-4">
            <Button variant="destructive" size="sm" onClick={() => turnOff(factors[0].id)}>
              Turn off
            </Button>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </div>
    </div>
  )
}
