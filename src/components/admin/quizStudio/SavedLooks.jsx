import { useState } from 'react'
import { useQuizLooksQuery, useSaveQuizLookMutation, useDeleteQuizLookMutation } from '../../../data/quiz'
import { applyHolidayLook } from '../../../data/holidays'
import { brandingPaths } from '../../../data/quizBranding'
import { sanitizeTheme } from '../../../../api/_lib/quizTheme.js'
import { generateId } from '../../../lib/adminFields'
import { useToast } from '../../../lib/ToastContext'
import Button from '../../ui/Button'
import { SkeletonText } from '../../ui/Skeleton'

// The designs an admin has made and kept, so they can be put back on this quiz or any other. Before this the studio's
// four THEME_LOOKS were the only choice, and reusing a look you liked meant copying the whole quiz.
//
// Applying a look does not save it. It fills the studio's draft and the admin presses Save as usual, so a look is never
// one stray click away from restyling a quiz.
//
// Pictures are the one thing a look cannot carry across. An uploaded backdrop, logo or sponsor path is
// `<quizId>/<uuid>.webp` inside that quiz's own storage folder, so sanitizeTheme(look.design, { quizId }) drops any
// path belonging to a different quiz -- the same rule that made a hand-edited theme harmless in
// src/data/quizDuplicate.test.js. Applying a look with pictures to another quiz therefore loses them, and says so,
// because a look that looks identical everywhere except for its photograph would be the worse surprise.

function LookChip({ look, onApply, onRename, onDelete, busy }) {
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(look.name)

  if (renaming) {
    return (
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault()
          const next = name.trim()
          if (!next) return
          setRenaming(false)
          onRename(look, next)
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          aria-label={`New name for ${look.name}`}
          className="min-h-9 w-32 rounded-lg border border-hairline bg-surface px-2 py-1 text-sm text-ink-900"
          autoFocus
        />
        <Button type="submit" size="sm" variant="primary" loading={busy} disabled={!name.trim()}>Save</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setRenaming(false)}>Cancel</Button>
      </form>
    )
  }

  return (
    <div className="flex items-center gap-1 rounded-xl border border-hairline bg-surface p-1">
      <button
        type="button"
        onClick={() => onApply(look)}
        className="min-h-9 flex-1 cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-sm font-semibold text-ink-900 hover:bg-surface-low"
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
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-label={`Delete ${look.name}`}
        onClick={() => onDelete(look)}
      >
        Delete
      </Button>
    </div>
  )
}

export default function SavedLooks({ quizId, draft, dirty, onApply }) {
  const toast = useToast()
  const looksQuery = useQuizLooksQuery()
  const saveMutation = useSaveQuizLookMutation()
  const deleteMutation = useDeleteQuizLookMutation()
  const [name, setName] = useState('')

  const looks = looksQuery.data ?? []
  const busy = saveMutation.isPending || deleteMutation.isPending

  function handleSaveAsNew(event) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    // Client-minted id, the same rule as a calendar look (src/pages/admin/AdminCalendarDesign.jsx:125): the table has
    // no sequence to draw from. The design is the draft rather than the saved row, so "save what I am looking at now" is
    // what gets kept even when nothing has been changed since the last save.
    saveMutation.mutate(
      { id: generateId(trimmed), name: trimmed, design: draft },
      {
        onSuccess: (saved) => {
          setName('')
          toast.success(`Saved “${saved.name}”. Pick it from this list on any quiz.`)
        },
        onError: (error) => toast.error(error.message),
      },
    )
  }

  async function handleApply(look) {
    if (dirty && !window.confirm(`Replace your unsaved changes with “${look.name}”?`)) return
    // A holiday look carries its backdrop picture in the holiday bucket, not in this quiz's folder — so
    // it is copied into `<quizId>/` here, BEFORE the one judgement of what a look means on THIS quiz
    // (sanitizeTheme drops foreign paths on purpose, and this honours that rule rather than weakening it).
    // A non-holiday look takes the ordinary path untouched, and a failed copy simply settles to a
    // patternless backdrop instead of pointing at a folder the quiz does not own.
    const holiday = await applyHolidayLook(look, quizId).catch(() => null)
    const applied = holiday ? holiday.theme : sanitizeTheme(look.design, { quizId })
    const lost = holiday
      ? holiday.imageFailed
      : brandingPaths(look.design).length > 0 && brandingPaths(applied).length === 0
    onApply(applied)
    toast.success(
      lost
        ? holiday
          ? `“${look.name}” applied. Its backdrop picture could not be copied over, so the plain backdrop is shown.`
          : `“${look.name}” applied. Its uploaded picture belongs to another quiz, so that part was left out.`
        : `“${look.name}” applied. Press “Save look” to keep it on this quiz.`,
    )
  }

  function handleRename(look, next) {
    saveMutation.mutate(
      // The design travels with the row, because quiz_looks is written whole -- the same reasoning as the calendar's
      // rename (AdminCalendarDesign.jsx:145). A rename that sent only the name would have to read the row back first.
      { id: look.id, name: next, design: look.design },
      { onSuccess: () => toast.success('Look renamed.'), onError: (error) => toast.error(error.message) },
    )
  }

  function handleDelete(look) {
    if (!window.confirm(`Delete “${look.name}”? This cannot be undone. Quizzes already using it keep their look.`)) return
    deleteMutation.mutate(look.id, {
      onSuccess: () => toast.success('Look deleted.'),
      onError: (error) => toast.error(error.message),
    })
  }

  return (
    <section className="rounded-2xl border border-hairline bg-surface p-5 shadow-md">
      <h2 className="text-lg font-bold text-ink-900">Saved looks</h2>
      <p className="mb-3 text-sm text-ink-muted">
        Keep a design you like under a name and put it back on any quiz. Picking one fills the form below &mdash; press
        Save to keep it on this quiz.
      </p>

      {looksQuery.isError && (
        <p role="alert" className="text-sm text-ink-muted">Couldn&rsquo;t load your saved looks right now.</p>
      )}

      {looksQuery.isLoading ? (
        <SkeletonText lines={2} />
      ) : (
        looks.length > 0 && (
          <div className="flex flex-col gap-2">
            {looks.map((look) => (
              <LookChip
                key={look.id}
                look={look}
                busy={busy}
                onApply={handleApply}
                onRename={handleRename}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )
      )}

      <form onSubmit={handleSaveAsNew} className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="Name this design"
          aria-label="Name for the saved look"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-hairline bg-surface px-3 py-2 text-sm text-ink-900"
        />
        <Button type="submit" variant="secondary" size="sm" loading={saveMutation.isPending} disabled={!name.trim()}>
          Save as new
        </Button>
      </form>
    </section>
  )
}
