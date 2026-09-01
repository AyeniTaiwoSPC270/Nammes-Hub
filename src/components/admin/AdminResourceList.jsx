import { useState } from 'react'
import Table from '../ui/Table'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'

export default function AdminResourceList({ config, rows, onEdit, onDelete, emptyLabel }) {
  const [confirmingId, setConfirmingId] = useState(null)

  if (rows.length === 0) {
    const label = emptyLabel ?? config.title.toLowerCase()
    return (
      <EmptyState
        icon="inbox"
        title={`No ${label} yet`}
        description={`Add the first ${label.replace(/s$/, '')} using the form.`}
      />
    )
  }

  const tableRows = rows.map((row) => [
    ...config.listColumns.map((col) => String(row[col.field] ?? '')),
    <div key={row.id} className="flex justify-center gap-3">
      <button
        type="button"
        title="Edit"
        onClick={() => onEdit(row)}
        className="text-ink-muted transition-colors hover:text-green-900"
      >
        <span className="material-symbols-outlined text-xl">edit</span>
      </button>
      {confirmingId === row.id ? (
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            setConfirmingId(null)
            onDelete(row)
          }}
        >
          Confirm delete
        </Button>
      ) : (
        <button
          type="button"
          title="Delete"
          onClick={() => setConfirmingId(row.id)}
          className="text-ink-muted transition-colors hover:text-danger"
        >
          <span className="material-symbols-outlined text-xl">delete</span>
        </button>
      )}
    </div>,
  ])

  return (
    <div>
      <Table columns={[...config.listColumns.map((c) => c.label), 'Actions']} rows={tableRows} />
      <div className="flex items-center justify-between border-t border-hairline bg-surface-low px-4 py-2.5">
        <span className="text-xs text-ink-muted">
          Showing {rows.length} of {rows.length} {rows.length === 1 ? 'item' : 'items'}
        </span>
      </div>
    </div>
  )
}
