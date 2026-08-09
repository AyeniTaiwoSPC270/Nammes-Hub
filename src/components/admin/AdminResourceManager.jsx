import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import AdminResourceList from './AdminResourceList'
import AdminResourceForm from './AdminResourceForm'
import { generateId } from '../../lib/adminFields'

export default function AdminResourceManager({ table, title, config, orderBy }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState({ mode: 'list' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    let query = supabase.from(table).select('*')
    if (orderBy) query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true })
    const { data, error: fetchError } = await query
    setLoading(false)
    if (fetchError) {
      setError(fetchError.message)
      return
    }
    setRows(data || [])
  }, [table, orderBy])

  useEffect(() => {
    load()
  }, [load])

  async function handleSubmit(payload) {
    setSaving(true)
    setError('')
    let result
    if (view.mode === 'edit') {
      result = await supabase.from(table).update(payload).eq('id', view.record.id)
    } else {
      const id = generateId(payload[config.idField])
      result = await supabase.from(table).insert({ ...payload, id })
    }
    setSaving(false)
    if (result.error) {
      setError(result.error.message)
      return
    }
    setView({ mode: 'list' })
    load()
  }

  async function handleDelete(row) {
    const { error: deleteError } = await supabase.from(table).delete().eq('id', row.id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    load()
  }

  return (
    <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
      <h1 className="text-[32px]">{title}</h1>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {loading ? (
        <p className="mt-6 text-ink-muted">Loading…</p>
      ) : view.mode === 'list' ? (
        <div className="mt-6">
          <AdminResourceList
            config={config}
            rows={rows}
            onEdit={(record) => setView({ mode: 'edit', record })}
            onDelete={handleDelete}
            onAddNew={() => setView({ mode: 'new' })}
          />
        </div>
      ) : (
        <div className="mt-6">
          <AdminResourceForm
            config={config}
            record={view.mode === 'edit' ? view.record : undefined}
            onSubmit={handleSubmit}
            onCancel={() => setView({ mode: 'list' })}
            saving={saving}
          />
        </div>
      )}
    </div>
  )
}
