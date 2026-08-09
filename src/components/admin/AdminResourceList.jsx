import { useState } from 'react'
import Table from '../ui/Table'
import Button from '../ui/Button'

export default function AdminResourceList({ config, rows, onEdit, onDelete, onAddNew }) {
  const [confirmingId, setConfirmingId] = useState(null)

  const tableRows = rows.map((row) => [
    ...config.listColumns.map((col) => String(row[col.field] ?? '')),
    <div key={row.id} className="flex gap-2">
      <Button variant="ghost" size="sm" onClick={() => onEdit(row)}>
        Edit
      </Button>
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
        <Button variant="destructive" size="sm" onClick={() => setConfirmingId(row.id)}>
          Delete
        </Button>
      )}
    </div>,
  ])

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" size="sm" onClick={onAddNew}>
          Add new
        </Button>
      </div>
      {rows.length > 0 ? (
        <Table columns={[...config.listColumns.map((c) => c.label), '']} rows={tableRows} />
      ) : (
        <p className="text-ink-muted">No {config.title.toLowerCase()} yet.</p>
      )}
    </div>
  )
}
