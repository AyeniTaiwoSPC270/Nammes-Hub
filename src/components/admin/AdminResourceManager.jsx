import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import AdminResourceList from './AdminResourceList'
import AdminResourceForm from './AdminResourceForm'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import ErrorState from '../ui/ErrorState'
import { SkeletonTable } from '../ui/Skeleton'
import { generateId } from '../../lib/adminFields'
import { useToast } from '../../lib/ToastContext'
import { useAuth } from '../../lib/AuthContext'
import { useOwnAdminRowQuery } from '../../data/admins'
import { submitChangeRequest, useMyPendingRequestsQuery } from '../../data/changeRequests'

async function loadRows(table, orderBy) {
  let query = supabase.from(table).select('*')
  if (orderBy) query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true })
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export default function AdminResourceManager({ table, title, config, orderBy, renderRowExtra }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { user } = useAuth()
  const adminRowQuery = useOwnAdminRowQuery(user?.id)
  const isOwner = Boolean(adminRowQuery.data?.is_owner)
  const gated = Boolean(config.reviewGated) && !isOwner
  const pendingQuery = useMyPendingRequestsQuery(config.reviewGated ? table : null, user?.id)
  const pendingRequests = pendingQuery.data ?? []
  const pendingInserts = pendingRequests.filter((r) => r.action === 'insert')
  const pendingUpdateRecordIds = new Set(pendingRequests.filter((r) => r.action === 'update').map((r) => r.record_id))

  const [editing, setEditing] = useState(null) // null = add-new panel, record = editing that row
  const [confirmingDeleteAll, setConfirmingDeleteAll] = useState(false)
  const [activeGroup, setActiveGroup] = useState('All')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [table],
    queryFn: () => loadRows(table, orderBy),
  })
  const rows = data ?? []

  const groupValues = useMemo(() => {
    if (!config.groupField) return null
    return Array.from(new Set(rows.map((r) => String(r[config.groupField])))).sort()
  }, [rows, config.groupField])

  const filteredRows =
    config.groupField && activeGroup !== 'All'
      ? rows.filter((r) => String(r[config.groupField]) === activeGroup)
      : rows

  useEffect(() => {
    if (config.groupField && activeGroup !== 'All' && !rows.some((r) => String(r[config.groupField]) === activeGroup)) {
      setActiveGroup('All')
    }
  }, [rows, activeGroup, config.groupField])

  function invalidatePending() {
    if (config.reviewGated) queryClient.invalidateQueries({ queryKey: ['change_requests', 'mine', table, user?.id] })
  }

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editing) {
        if (gated) {
          await submitChangeRequest(table, 'update', String(editing.id), payload)
          return null
        }
        const result = await supabase.from(table).update(payload).eq('id', editing.id).select()
        if (result.error) throw result.error
        if (!result.data || result.data.length === 0) {
          throw new Error('No changes were saved — your account may not have admin access to make this change.')
        }
        return result.data
      }
      const id = generateId(payload[config.idField])
      if (gated) {
        await submitChangeRequest(table, 'insert', null, { ...payload, id })
        return null
      }
      const result = await supabase.from(table).insert({ ...payload, id })
      if (result.error) throw result.error
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [table] })
      invalidatePending()
      toast.success(gated ? 'Submitted for review.' : editing ? `${title} updated.` : `${title} added.`)
      setEditing(null)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (row) => {
      const { data: deletedRows, error } = await supabase.from(table).delete().eq('id', row.id).select()
      if (error) throw error
      if (!deletedRows || deletedRows.length === 0) {
        throw new Error('No changes were saved — your account may not have admin access to make this change.')
      }
      return deletedRows
    },
    onSuccess: (_data, row) => {
      queryClient.invalidateQueries({ queryKey: [table] })
      toast.success(`${title} deleted.`)
      if (editing?.id === row.id) setEditing(null)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const { error } =
        config.groupField && activeGroup !== 'All'
          ? await supabase.from(table).delete().in('id', filteredRows.map((r) => r.id))
          : await supabase.from(table).delete().not('id', 'is', null)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [table] })
      toast.success(
        `${activeGroup === 'All' ? 'All' : `${activeGroup} ${config.groupLabel ?? ''}`.trim()} ${title.toLowerCase()} deleted.`,
      )
      setConfirmingDeleteAll(false)
      setEditing(null)
      setActiveGroup('All')
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <Link
        to="/admin"
        className="inline-flex items-center gap-1 text-sm font-semibold text-green-900 no-underline hover:text-orange-500 hover:underline"
      >
        <span className="material-symbols-outlined text-base">arrow_back</span>
        Back to Admin
      </Link>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink-900">{title}</h1>
          <p className="mt-1 text-ink-muted">
            Create, edit, and remove {config.title.toLowerCase()} from the public hub.
            {gated && ' Creates and edits need the owner’s approval before they go live.'}
          </p>
        </div>
        <div className="flex gap-3">
          {filteredRows.length > 0 && (
            <Button variant="destructive" onClick={() => setConfirmingDeleteAll(true)}>
              <span className="material-symbols-outlined text-base">delete_sweep</span>
              Delete {activeGroup === 'All' ? 'All' : `${activeGroup} ${config.groupLabel ?? ''}`.trim()}
            </Button>
          )}
          <Button variant="primary" onClick={() => setEditing(null)}>
            <span className="material-symbols-outlined text-base">add</span>
            Add {config.title}
          </Button>
        </div>
      </div>

      {groupValues && groupValues.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {['All', ...groupValues].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveGroup(value)}
              className={[
                'rounded-full px-4 py-2 text-sm font-semibold border transition-colors',
                value === activeGroup
                  ? 'bg-green-900 text-white border-green-900'
                  : 'bg-surface text-ink border-hairline hover:bg-surface-low',
              ].join(' ')}
            >
              {value === 'All' ? 'All' : `${value} ${config.groupLabel ?? ''}`.trim()}
            </button>
          ))}
        </div>
      )}

      {confirmingDeleteAll && (
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-danger bg-danger-bg p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-danger">
            Delete all {filteredRows.length}{' '}
            {activeGroup !== 'All' ? `${activeGroup} ${config.groupLabel ?? ''} `.trim() + ' ' : ''}
            {config.title.toLowerCase()}? This can&rsquo;t be undone.
          </p>
          <div className="flex shrink-0 gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingDeleteAll(false)}
              disabled={deleteAllMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteAllMutation.mutate()}
              loading={deleteAllMutation.isPending}
            >
              Yes, delete all
            </Button>
          </div>
        </div>
      )}

      {isError && !data ? (
        <div className="mt-6">
          <ErrorState message={`Couldn't load ${title.toLowerCase()} right now.`} onRetry={refetch} />
        </div>
      ) : isLoading ? (
        <div className="mt-6">
          <SkeletonTable columns={config.listColumns.length + 1} rows={5} />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            {pendingInserts.length > 0 && (
              <div className="mb-4 flex flex-col gap-2 rounded-lg border border-hairline bg-surface-low p-4">
                <h3 className="text-sm font-semibold text-ink-900">Awaiting the owner&rsquo;s approval</h3>
                {pendingInserts.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm text-ink-muted">
                    <span>{r.payload.title || r.payload.id}</span>
                    <Badge tone="new">Pending</Badge>
                  </div>
                ))}
              </div>
            )}
            <div className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-md">
              <AdminResourceList
                config={config}
                rows={filteredRows}
                onEdit={setEditing}
                onDelete={(row) => deleteMutation.mutate(row)}
                renderRowExtra={(row) => (
                  <>
                    {renderRowExtra && renderRowExtra(row)}
                    {pendingUpdateRecordIds.has(String(row.id)) && <Badge tone="new">Pending review</Badge>}
                  </>
                )}
                emptyLabel={
                  config.groupField && activeGroup !== 'All'
                    ? `${activeGroup} ${config.groupLabel ?? ''} ${config.title.toLowerCase()}`.replace(/\s+/g, ' ').trim()
                    : undefined
                }
              />
            </div>
          </div>

          <div className="rounded-lg border border-hairline bg-surface p-6 shadow-md lg:sticky lg:top-24 lg:col-span-4">
            <h2 className="mb-4 border-b border-hairline pb-3 text-lg font-bold text-ink-900">
              {editing ? `Edit ${config.title}` : `Add ${config.title}`}
            </h2>
            <AdminResourceForm
              key={editing?.id ?? 'new'}
              config={config}
              record={editing ?? undefined}
              onSubmit={(payload) => saveMutation.mutate(payload)}
              onCancel={() => setEditing(null)}
              saving={saveMutation.isPending}
            />
          </div>
        </div>
      )}
    </div>
  )
}
