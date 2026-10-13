import { useState } from 'react'
import { useFormLooksQuery, useSaveFormLookMutation, useDeleteFormLookMutation } from '../../../data/formLooks'
import { normalizeTheme } from '../../../lib/formTheme'
import { generateId } from '../../../lib/adminFields'
import { useToast } from '../../../lib/ToastContext'
import Button from '../../ui/Button'
import { SkeletonText } from '../../ui/Skeleton'

// The appearances an admin has made and kept, so they can be put back on this form or any other. The fourteen
// FORM_PRESETS above are compiled into the bundle; this is the one an admin built themselves.
//
// Picking one replaces the whole appearance, exactly as picking a built-in theme does, so it asks for no confirmation
// and loses nothing extra: it only changes the draft, and the form editor's own Save is what commits it.
//
// The images are the difference from a quiz look. A form's page background and header are whole https urls
// (safeImageUrl, src/lib/formTheme.js:224), not per-form storage paths, so an appearance carries its pictures to
// another form intact and there is nothing to strip.

function LookRow({ look, onApply, onRename, onDelete, busy }) {
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(look.name)

  if (renaming) {
    return (
      <div className="flex items-center gap-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          aria-label={`New name for ${look.name}`}
          autoFocus
          className="min-h-10 min-w-0 flex-1 rounded-md border border-hairline bg-surface px-2 py-1 text-sm text-ink"
        />
        <Button type="button" size="sm" variant="primary" loading={busy} disabled={!name.trim()} onClick={() => onRename(look, name.trim())}>
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setRenaming(false)}>Cancel</Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onApply(look)}
        aria-label={`Use ${look.name}`}
        className="min-h-10 min-w-0 flex-1 cursor-pointer truncate rounded-md px-2 py-1.5 text-left text-sm font-semibold text-ink hover:bg-surface-low"
      >
        {look.name}
      </button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-label={`Rename ${look.name}`}
        onClick={() => {
          setName(look.name)
          setRenaming(true)
        }}
      >
        Rename
      </Button>
      <Button type="button" size="sm" variant="ghost" aria-label={`Delete ${look.name}`} onClick={() => onDelete(look)}>
        Delete
      </Button>
    </div>
  )
}

export default function SavedFormLooks({ theme, onChange }) {
  const toast = useToast()
  const looksQuery = useFormLooksQuery()
  const saveMutation = useSaveFormLookMutation()
  const deleteMutation = useDeleteFormLookMutation()
  const [name, setName] = useState('')

  const looks = looksQuery.data ?? []
  const busy = saveMutation.isPending || deleteMutation.isPending

  function handleSaveAsNew() {
    const trimmed = name.trim()
    if (!trimmed) return
    // Client-minted id, the same rule as a calendar look (src/pages/admin/AdminCalendarDesign.jsx:125): the table has
    // no sequence to draw from. The design is the theme as it stands, not the saved row, so "keep this" saves what is
    // on screen right now -- which is the modal's DEFAULT_THEME when the form has none yet, and that is worth keeping
    // too, so there is no guard on an empty theme here.
    saveMutation.mutate(
      { id: generateId(trimmed), name: trimmed, design: theme },
      {
        onSuccess: (saved) => {
          setName('')
          toast.success(`Saved “${saved.name}”. Pick it from this list on any form.`)
        },
        onError: (error) => toast.error(error.message),
      },
    )
  }

  function handleApply(look) {
    // normalizeTheme on read as well as on write, so a hand-edited row cannot put a value on a form that the renderer
    // would then have to clamp.
    onChange(normalizeTheme(look.design))
    toast.success(`“${look.name}” applied. Press Save to keep it on this form.`)
  }

  function handleRename(look, next) {
    // The design travels with the row, because form_looks is written whole -- the same reasoning as the calendar's
    // rename (AdminCalendarDesign.jsx:145). A rename that sent only the name would have to read the row back first.
    saveMutation.mutate(
      { id: look.id, name: next, design: look.design },
      {
        onSuccess: () => {
          toast.success('Appearance renamed.')
        },
        onError: (error) => toast.error(error.message),
      },
    )
  }

  function handleDelete(look) {
    if (!window.confirm(`Delete “${look.name}”? This cannot be undone. Forms already using it keep their appearance.`)) return
    deleteMutation.mutate(look.id, {
      onSuccess: () => toast.success('Appearance deleted.'),
      onError: (error) => toast.error(error.message),
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-ink-muted">
        Appearances you have saved. Pick one to use it here or on any other form.
      </p>

      {looksQuery.isError && (
        <p role="alert" className="text-xs text-ink-muted">Couldn&rsquo;t load your saved appearances right now.</p>
      )}

      {looksQuery.isLoading ? (
        <SkeletonText lines={2} />
      ) : (
        looks.map((look) => (
          <LookRow key={look.id} look={look} busy={busy} onApply={handleApply} onRename={handleRename} onDelete={handleDelete} />
        ))
      )}

      <div className="mt-1 flex items-center gap-1.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleSaveAsNew()
            }
          }}
          maxLength={40}
          placeholder="Name this appearance"
          aria-label="Name for the saved appearance"
          className="min-h-10 min-w-0 flex-1 rounded-md border border-hairline bg-surface px-2 py-1.5 text-sm text-ink"
        />
        <Button type="button" size="sm" variant="secondary" loading={saveMutation.isPending} disabled={!name.trim()} onClick={handleSaveAsNew}>
          Save
        </Button>
      </div>
    </div>
  )
}
