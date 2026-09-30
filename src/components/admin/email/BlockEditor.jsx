import { useRef, useState } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { BLOCK_TYPES, newBlock } from '../../../../api/_lib/emailDesign.js'
import Toggle from '../../ui/Toggle'
import { ColorField, Segmented, Slider } from '../forms/DesignControls'
import EmailImageField from './EmailImageField'

const ALIGN_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
]

const inputClass =
  'min-h-10 w-full rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand'

/** Textarea with bold / italic / link buttons that wrap the selected text in the email's simple markup. */
function RichText({ value, onChange, rows = 5, placeholder }) {
  const ref = useRef(null)

  function wrap(before, after, fallback) {
    const el = ref.current
    if (!el) return
    const { selectionStart: start, selectionEnd: end } = el
    const selected = value.slice(start, end) || fallback
    const next = value.slice(0, start) + before + selected + after + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + before.length, start + before.length + selected.length)
    })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => wrap('**', '**', 'bold text')} aria-label="Bold" title="Bold" className="flex h-9 w-9 items-center justify-center rounded-md border border-hairline bg-surface hover:bg-surface-low">
          <span className="material-symbols-outlined text-lg">format_bold</span>
        </button>
        <button type="button" onClick={() => wrap('*', '*', 'italic text')} aria-label="Italic" title="Italic" className="flex h-9 w-9 items-center justify-center rounded-md border border-hairline bg-surface hover:bg-surface-low">
          <span className="material-symbols-outlined text-lg">format_italic</span>
        </button>
        <button type="button" onClick={() => wrap('[', '](https://)', 'link text')} aria-label="Link" title="Link" className="flex h-9 w-9 items-center justify-center rounded-md border border-hairline bg-surface hover:bg-surface-low">
          <span className="material-symbols-outlined text-lg">link</span>
        </button>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand"
      />
      <span className="text-xs text-ink-muted">**bold**, *italic*, [link text](https://…). Paste a bare link and it becomes clickable.</span>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-ink">{label}</span>
      {children}
    </label>
  )
}

/** The settings for one block. Used directly, and for each side of a two-column block. */
function BlockBody({ block, onChange }) {
  const set = (patch) => onChange({ ...block, ...patch })

  switch (block.type) {
    case 'heading':
      return (
        <div className="flex flex-col gap-3">
          <input value={block.text} onChange={(e) => set({ text: e.target.value })} placeholder="Heading" className={inputClass} />
          <Segmented
            label="Size"
            value={block.level}
            options={[
              { value: 1, label: 'Large' },
              { value: 2, label: 'Medium' },
              { value: 3, label: 'Small' },
            ]}
            onChange={(level) => set({ level })}
          />
          <Segmented label="Alignment" value={block.align} options={ALIGN_OPTIONS} onChange={(align) => set({ align })} />
          <ColorField label="Color" value={block.color} allowClear onChange={(color) => set({ color })} />
        </div>
      )
    case 'text':
      return (
        <div className="flex flex-col gap-3">
          <RichText value={block.text} onChange={(text) => set({ text })} placeholder="Write your message…" />
          <Segmented label="Alignment" value={block.align} options={ALIGN_OPTIONS} onChange={(align) => set({ align })} />
        </div>
      )
    case 'image':
      return <EmailImageField label="Image" value={block.url ? block : null} onChange={(v) => onChange(v ? { ...block, ...v } : { ...block, url: '', src: '', bakeKey: '' })} />
    case 'button':
      return (
        <div className="flex flex-col gap-3">
          <Field label="Button text">
            <input value={block.text} onChange={(e) => set({ text: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Link">
            <input value={block.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://… or site:/events" className={inputClass} />
          </Field>
          <Segmented
            label="Style"
            value={block.style}
            options={[
              { value: 'filled', label: 'Filled' },
              { value: 'outline', label: 'Outline' },
            ]}
            onChange={(style) => set({ style })}
          />
          <Segmented label="Alignment" value={block.align} options={ALIGN_OPTIONS} onChange={(align) => set({ align })} />
        </div>
      )
    case 'quote':
      return (
        <div className="flex flex-col gap-3">
          <RichText value={block.text} onChange={(text) => set({ text })} rows={3} placeholder="A note worth highlighting" />
          <ColorField label="Accent color" value={block.color} allowClear onChange={(color) => set({ color })} />
        </div>
      )
    case 'list':
      return (
        <div className="flex flex-col gap-2">
          {block.items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={item}
                onChange={(e) => set({ items: block.items.map((x, xi) => (xi === i ? e.target.value : x)) })}
                placeholder={`Item ${i + 1}`}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => set({ items: block.items.length > 1 ? block.items.filter((_, xi) => xi !== i) : [''] })}
                aria-label="Remove item"
                className="p-2 text-ink-muted hover:text-danger"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
          ))}
          <button type="button" onClick={() => set({ items: [...block.items, ''] })} className="self-start text-xs font-semibold text-brand hover:underline">
            + Add item
          </button>
          <Toggle checked={block.ordered} onChange={(ordered) => set({ ordered })} label="Numbered list" />
        </div>
      )
    case 'divider':
      return <ColorField label="Line color" value={block.color} allowClear onChange={(color) => set({ color })} />
    case 'spacer':
      return <Slider label="Height" value={block.height} min={4} max={96} unit="px" onChange={(height) => set({ height })} />
    case 'columns':
      return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {['left', 'right'].map((side) => (
            <div key={side} className="flex flex-col gap-3 rounded-md border border-hairline p-3">
              <Segmented
                label={side === 'left' ? 'Left column' : 'Right column'}
                value={block[side].type}
                options={[
                  { value: 'text', label: 'Text' },
                  { value: 'image', label: 'Image' },
                  { value: 'heading', label: 'Heading' },
                  { value: 'button', label: 'Button' },
                ]}
                onChange={(type) => set({ [side]: type === block[side].type ? block[side] : newBlock(type) })}
              />
              <BlockBody block={block[side]} onChange={(next) => set({ [side]: next })} />
            </div>
          ))}
        </div>
      )
    default:
      return null
  }
}

function summary(block) {
  switch (block.type) {
    case 'heading':
    case 'text':
    case 'quote':
      return block.text.trim().slice(0, 60) || 'Empty'
    case 'button':
      return block.text
    case 'list':
      return block.items.filter(Boolean).slice(0, 2).join(', ') || 'Empty'
    case 'image':
      return block.url ? 'Picture' : 'No picture yet'
    default:
      return ''
  }
}

function BlockCard({ block, onChange, onRemove, onDuplicate, startOpen }) {
  const [open, setOpen] = useState(startOpen)
  const meta = BLOCK_TYPES.find((t) => t.type === block.type)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={['rounded-lg border border-hairline bg-surface shadow-sm', isDragging ? 'opacity-50' : ''].join(' ')}
    >
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button
          type="button"
          className="cursor-grab touch-none p-1.5 text-ink-muted hover:text-ink-900 active:cursor-grabbing"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <span className="material-symbols-outlined text-lg">drag_indicator</span>
        </button>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex min-h-10 min-w-0 flex-1 items-center gap-2 text-left">
          <span className="material-symbols-outlined text-lg text-ink-muted">{meta?.icon}</span>
          <span className="shrink-0 text-sm font-semibold text-ink-900">{meta?.label}</span>
          {!open && <span className="truncate text-sm text-ink-muted">{summary(block)}</span>}
        </button>
        <button type="button" onClick={onDuplicate} aria-label="Duplicate block" title="Duplicate" className="p-2 text-ink-muted hover:text-ink-900">
          <span className="material-symbols-outlined text-lg">content_copy</span>
        </button>
        <button type="button" onClick={onRemove} aria-label="Remove block" title="Remove" className="p-2 text-ink-muted hover:text-danger">
          <span className="material-symbols-outlined text-lg">delete</span>
        </button>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-label={open ? 'Collapse' : 'Expand'} className="p-2 text-ink-muted hover:text-ink-900">
          <span className="material-symbols-outlined text-lg">{open ? 'expand_less' : 'expand_more'}</span>
        </button>
      </div>
      {open && (
        <div className="border-t border-hairline p-3">
          <BlockBody block={block} onChange={onChange} />
        </div>
      )}
    </div>
  )
}

/** The email's content: a reorderable list of blocks plus an "add" row. */
export default function BlockEditor({ blocks, onChange }) {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const [justAdded, setJustAdded] = useState(null)

  function add(type) {
    const block = newBlock(type)
    setJustAdded(block.id)
    onChange([...blocks, block])
  }

  function duplicate(index) {
    const copy = JSON.parse(JSON.stringify(blocks[index]))
    const fresh = newBlock(copy.type)
    copy.id = fresh.id
    if (copy.type === 'columns') {
      copy.left.id = newBlock('text').id
      copy.right.id = newBlock('text').id
    }
    onChange([...blocks.slice(0, index + 1), copy, ...blocks.slice(index + 1)])
  }

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const from = blocks.findIndex((b) => b.id === active.id)
    const to = blocks.findIndex((b) => b.id === over.id)
    onChange(arrayMove(blocks, from, to))
  }

  return (
    <div className="flex flex-col gap-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          {blocks.map((b, i) => (
            <BlockCard
              key={b.id}
              block={b}
              startOpen={b.id === justAdded || blocks.length === 1}
              onChange={(next) => onChange(blocks.map((x, xi) => (xi === i ? next : x)))}
              onRemove={() => onChange(blocks.filter((_, xi) => xi !== i))}
              onDuplicate={() => duplicate(i)}
            />
          ))}
        </SortableContext>
      </DndContext>
      {blocks.length === 0 && <p className="rounded-md bg-surface-low px-3 py-4 text-center text-sm text-ink-muted">Add your first block below.</p>}
      <div className="mt-1 flex flex-wrap gap-1.5">
        {BLOCK_TYPES.map((t) => (
          <button
            key={t.type}
            type="button"
            onClick={() => add(t.type)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-hairline bg-surface-low px-3 text-xs font-semibold text-ink transition-colors hover:bg-hairline/20"
          >
            <span className="material-symbols-outlined text-base">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
