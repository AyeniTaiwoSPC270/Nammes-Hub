import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import AdminResourceList from './AdminResourceList'
import AdminResourceForm from './AdminResourceForm'
import ErrorState from '../ui/ErrorState'
import { SkeletonTable } from '../ui/Skeleton'
import { generateId } from '../../lib/adminFields'
import { useToast } from '../../lib/ToastContext'

async function loadRows(table, orderBy) {
  let query = supabase.from(table).select('*')
  if (orderBy) query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true })
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export default function AdminResourceManager({ table, title, config, orderBy }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [view, setView] = useState({ mode: 'list' })

  const { data: rows = [], isLoading, isError, refetch } = useQuery({
    queryKey: [table],
    queryFn: () => loadRows(table, orderBy),
  })

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (view.mode === 'edit') {
        const result = await supabase.from(table).update(payload).eq('id', view.record.id).select()
        if (result.error) throw result.error
        if (!result.data || result.data.length === 0) {
          throw new Error('No changes were saved — your account may not have admin access to make this change.')
        }
        return result.data
      }
      const id = generateId(payload[config.idField])
      const result = await supabase.from(table).insert({ ...payload, id })
      if (result.error) throw result.error
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [table] })
      toast.success(view.mode === 'edit' ? `${title} updated.` : `${title} added.`)
      setView({ mode: 'list' })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (row) => {
      const { data, error } = await supabase.from(table).delete().eq('id', row.id).select()
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('No changes were saved — your account may not have admin access to make this change.')
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [table] })
      toast.success(`${title} deleted.`)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  return (
    <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
      <Link to="/admin" className="text-sm font-semibold text-green-700 no-underline hover:underline">
        ← Back to Admin
      </Link>
      <h1 className="text-[32px]">{title}</h1>

      {isError ? (
        <div className="mt-6">
          <ErrorState message={`Couldn't load ${title.toLowerCase()} right now.`} onRetry={refetch} />
        </div>
      ) : isLoading ? (
        <div className="mt-6">
          <SkeletonTable columns={config.listColumns.length + 1} rows={5} />
        </div>
      ) : view.mode === 'list' ? (
        <div className="mt-6">
          <AdminResourceList
            config={config}
            rows={rows}
            onEdit={(record) => setView({ mode: 'edit', record })}
            onDelete={(row) => deleteMutation.mutate(row)}
            onAddNew={() => setView({ mode: 'new' })}
          />
        </div>
      ) : (
        <div className="mt-6">
          <AdminResourceForm
            config={config}
            record={view.mode === 'edit' ? view.record : undefined}
            onSubmit={(payload) => saveMutation.mutate(payload)}
            onCancel={() => setView({ mode: 'list' })}
            saving={saveMutation.isPending}
          />
        </div>
      )}
    </div>
  )
}
