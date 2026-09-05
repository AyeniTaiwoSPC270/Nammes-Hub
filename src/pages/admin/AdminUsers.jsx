import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/ToastContext'
import { useAllUsersQuery, setUserDisabled } from '../../data/users'
import { assignAdmin, revokeAdmin, transferOwnership } from '../../data/admins'
import Table from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonTable } from '../../components/ui/Skeleton'

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : '—'
}

export default function AdminUsers() {
  const { user } = useAuth()
  const usersQuery = useAllUsersQuery()
  const queryClient = useQueryClient()
  const toast = useToast()
  const users = usersQuery.data ?? []
  const me = users.find((u) => u.user_id === user.id)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['users', 'all'] })
    queryClient.invalidateQueries({ queryKey: ['admins', 'all'] })
    queryClient.invalidateQueries({ queryKey: ['admins', 'mine', user.id] })
  }

  const assignMutation = useMutation({
    mutationFn: assignAdmin,
    onSuccess: () => {
      invalidate()
      toast.success('Admin access granted.')
    },
    onError: (error) => toast.error(error.message),
  })
  const revokeMutation = useMutation({
    mutationFn: revokeAdmin,
    onSuccess: () => {
      invalidate()
      toast.success('Admin access removed.')
    },
    onError: (error) => toast.error(error.message),
  })
  const disableMutation = useMutation({
    mutationFn: ({ userId, disabled }) => setUserDisabled(userId, disabled),
    onSuccess: (_result, { disabled }) => {
      invalidate()
      toast.success(disabled ? 'Account disabled.' : 'Account enabled.')
    },
    onError: (error) => toast.error(error.message),
  })
  const transferMutation = useMutation({
    mutationFn: transferOwnership,
    onSuccess: () => {
      invalidate()
      toast.success('Ownership transferred.')
    },
    onError: (error) => toast.error(error.message),
  })

  if (usersQuery.isError && !usersQuery.data) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load users right now." onRetry={usersQuery.refetch} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-ink-900">Users</h1>
      <p className="mt-1 text-ink-muted">Every registered account, admin access, and activity.</p>

      {usersQuery.isLoading ? (
        <div className="mt-6">
          <SkeletonTable columns={7} rows={5} />
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-hairline bg-surface shadow-md">
          <Table
            columns={['Name', 'Matric', 'Joined', 'Last seen', 'Status', 'Role', 'Actions']}
            rows={users.map((u) => [
              u.full_name || '—',
              u.student_id,
              formatDate(u.created_at),
              formatDate(u.last_seen_at),
              <Badge key="status" tone={u.active ? 'updated' : 'neutral'}>
                {u.active ? 'Active' : 'Inactive'}
              </Badge>,
              u.isOwner ? (
                <Badge key="role" tone="restricted">Owner</Badge>
              ) : u.isAdmin ? (
                <Badge key="role" tone="new">Admin</Badge>
              ) : (
                <span key="role" className="text-ink-muted">—</span>
              ),
              <div key="actions" className="flex flex-wrap gap-2">
                {u.user_id !== user.id && !u.isAdmin && (
                  <Button variant="secondary" size="sm" onClick={() => assignMutation.mutate(u.user_id)}>
                    Make admin
                  </Button>
                )}
                {u.user_id !== user.id && u.isAdmin && !u.isOwner && me?.isOwner && (
                  <Button variant="destructive" size="sm" onClick={() => revokeMutation.mutate(u.user_id)}>
                    Remove admin
                  </Button>
                )}
                {u.user_id !== user.id && !u.isOwner && (
                  <Button
                    variant={u.is_disabled ? 'secondary' : 'destructive'}
                    size="sm"
                    onClick={() => disableMutation.mutate({ userId: u.user_id, disabled: !u.is_disabled })}
                  >
                    {u.is_disabled ? 'Enable' : 'Disable'}
                  </Button>
                )}
                {u.user_id !== user.id && u.isAdmin && !u.isOwner && me?.isOwner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm(`Make ${u.full_name || u.student_id} the owner? You will lose owner status.`)) {
                        transferMutation.mutate(u.user_id)
                      }
                    }}
                  >
                    Make owner
                  </Button>
                )}
              </div>,
            ])}
          />
        </div>
      )}
    </div>
  )
}
