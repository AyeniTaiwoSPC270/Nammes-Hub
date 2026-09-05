import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/ToastContext'
import { useNotificationPrefQuery, useSetNotificationPrefMutation } from '../data/notificationPrefs'

export default function Account() {
  const { user, loading } = useAuth()
  const toast = useToast()
  const prefQuery = useNotificationPrefQuery(user?.id)
  const setPrefMutation = useSetNotificationPrefMutation(user?.id)

  if (loading || (user && prefQuery.isLoading)) return null
  if (!user) return <Navigate to="/login" replace />

  const enabled = prefQuery.data ?? true

  function toggle() {
    setPrefMutation.mutate(!enabled, {
      onSuccess: () => toast.success(!enabled ? 'Email notifications turned on.' : 'Email notifications turned off.'),
      onError: (error) => toast.error(error.message),
    })
  }

  return (
    <div className="mx-auto max-w-[600px] px-5 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-ink-900">Account</h1>
      <p className="mt-1 text-ink-muted">{user.email}</p>

      <div className="mt-8 flex items-center justify-between gap-4 rounded-lg border border-hairline bg-surface p-5 shadow-sm">
        <div>
          <h2 className="font-bold text-ink-900">Email notifications</h2>
          <p className="text-sm text-ink-muted">New News/Events alerts and department broadcasts.</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={toggle}
            disabled={setPrefMutation.isPending}
            className="h-5 w-5 accent-green-900"
          />
        </label>
      </div>
    </div>
  )
}
