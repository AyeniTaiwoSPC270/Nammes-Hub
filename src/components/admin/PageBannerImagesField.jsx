import { useState } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../../lib/supabaseClient'

function BannerImageRow({ url, index, total, onRemove, onMove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: url })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'flex items-center gap-3 rounded-md border border-hairline bg-surface p-3 shadow-sm',
        isDragging ? 'opacity-50' : '',
      ].join(' ')}
    >
      <button
        type="button"
        className="cursor-grab touch-none p-2 text-ink-muted hover:text-ink-900 active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <span className="material-symbols-outlined text-lg">drag_indicator</span>
      </button>
      <div className="aspect-[16/9] w-24 shrink-0 overflow-hidden rounded-md bg-surface-low">
        <img src={url} alt="" className="h-full w-full object-cover" />
      </div>
      <span className="flex-1 truncate text-xs text-ink-muted">{url}</span>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={index === 0}
          className="p-2.5 text-ink-muted hover:text-ink-900 disabled:opacity-30"
          aria-label="Move up"
        >
          <span className="material-symbols-outlined text-lg">arrow_upward</span>
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          className="p-2.5 text-ink-muted hover:text-ink-900 disabled:opacity-30"
          aria-label="Move down"
        >
          <span className="material-symbols-outlined text-lg">arrow_downward</span>
        </button>
        <button type="button" onClick={onRemove} className="p-2.5 text-ink-muted hover:text-danger" aria-label="Remove image">
          <span className="material-symbols-outlined text-lg">delete</span>
        </button>
      </div>
    </div>
  )
}

export default function PageBannerImagesField({ label, urls, onChange }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB.')
      return
    }
    setError('')
    setUploading(true)
    const path = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`
    const { error: uploadError } = await supabase.storage.from('page-banners').upload(path, file)
    setUploading(false)
    e.target.value = ''
    if (uploadError) {
      setError(uploadError.message)
      return
    }
    const { data } = supabase.storage.from('page-banners').getPublicUrl(path)
    onChange([...urls, data.publicUrl])
  }

  function removeAt(i) {
    onChange(urls.filter((_, ui) => ui !== i))
  }

  function moveBy(i, delta) {
    const j = i + delta
    if (j < 0 || j >= urls.length) return
    const next = [...urls]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    onChange(arrayMove(urls, urls.indexOf(active.id), urls.indexOf(over.id)))
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-[.05em] text-brand-orange">{label}</span>

      {urls.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={urls} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {urls.map((url, i) => (
                <BannerImageRow
                  key={url}
                  url={url}
                  index={i}
                  total={urls.length}
                  onRemove={() => removeAt(i)}
                  onMove={(delta) => moveBy(i, delta)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-hairline bg-surface-low p-6 text-center transition-colors hover:bg-hairline/20">
        <span className="material-symbols-outlined text-3xl text-ink-muted">add_photo_alternate</span>
        <span className="text-sm font-semibold text-ink-muted">{uploading ? 'Uploading…' : 'Click to add an image'}</span>
        <span className="text-xs text-ink-muted">JPEG, PNG up to 5MB. Add 2 or more to enable the slideshow.</span>
        <input type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} className="hidden" />
      </label>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  )
}
