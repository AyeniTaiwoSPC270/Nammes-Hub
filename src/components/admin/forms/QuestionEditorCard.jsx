import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { QUESTION_TYPES } from '../../../data/forms'
import Button from '../../ui/Button'
import FormField from '../../ui/FormField'
import Toggle from '../../ui/Toggle'

export default function QuestionEditorCard({ question, index, onChange, onRemove }) {
  const [expanded, setExpanded] = useState(!question.label)
  const type = QUESTION_TYPES.find((t) => t.value === question.type) ?? QUESTION_TYPES[0]

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  function update(patch) {
    onChange({ ...question, ...patch })
  }

  function updateOption(i, value) {
    const options = [...(question.options || [])]
    options[i] = value
    update({ options })
  }

  function addOption() {
    update({ options: [...(question.options || []), ''] })
  }

  function removeOption(i) {
    update({ options: (question.options || []).filter((_, oi) => oi !== i) })
  }

  const dragHandle = (
    <button
      type="button"
      className="cursor-grab touch-none p-1 text-ink-muted hover:text-ink-900 active:cursor-grabbing"
      aria-label="Drag to reorder"
      {...attributes}
      {...listeners}
    >
      <span className="material-symbols-outlined text-lg">drag_indicator</span>
    </button>
  )

  if (!expanded) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={[
          'flex items-center justify-between gap-3 rounded-lg border border-hairline bg-surface px-4 py-3 shadow-sm',
          isDragging ? 'opacity-50' : '',
        ].join(' ')}
      >
        <div className="flex min-w-0 items-center gap-2">
          {dragHandle}
          <span className="shrink-0 rounded-md bg-surface-low px-2 py-0.5 text-xs font-semibold text-ink-muted">#{index + 1}</span>
          <span className="truncate font-semibold text-ink-900">{question.label || 'Untitled question'}</span>
          <span className="shrink-0 rounded-full bg-surface-low px-2 py-0.5 text-xs uppercase text-ink-muted">{type.label}</span>
          {question.required && (
            <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-xs uppercase text-orange-600">Required</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => setExpanded(true)} className="p-1.5 text-ink-muted hover:text-ink-900" aria-label="Expand">
            <span className="material-symbols-outlined text-lg">expand_more</span>
          </button>
          <button type="button" onClick={onRemove} className="p-1.5 text-ink-muted hover:text-danger" aria-label="Remove question">
            <span className="material-symbols-outlined text-lg">delete</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={['flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-5 shadow-sm', isDragging ? 'opacity-50' : ''].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-1 items-center gap-2">
          {dragHandle}
          <span className="shrink-0 rounded-md bg-surface-low px-2 py-0.5 text-xs font-semibold text-ink-muted">#{index + 1}</span>
          <input
            value={question.label}
            onChange={(e) => update({ label: e.target.value })}
            placeholder="Question"
            className="flex-1 rounded-md border border-hairline bg-surface px-3 py-2 text-base font-semibold text-ink focus:outline-none focus:border-brand"
          />
        </div>
        <select
          value={question.type}
          onChange={(e) => {
            const nextType = QUESTION_TYPES.find((t) => t.value === e.target.value)
            update({ type: e.target.value, options: nextType?.hasOptions ? [''] : null })
          }}
          className="rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-ink"
        >
          {QUESTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <input
        value={question.helper_text || ''}
        onChange={(e) => update({ helper_text: e.target.value })}
        placeholder="Helper text (optional)"
        className="rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-ink-muted focus:outline-none focus:border-brand"
      />

      {type.hasOptions && (
        <div className="flex flex-col gap-2 rounded-md bg-surface-low p-3">
          {(question.options || []).map((option, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={option}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
                className="flex-1 rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand"
              />
              <button type="button" onClick={() => removeOption(i)} className="text-ink-muted hover:text-danger">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
          ))}
          <Button variant="ghost" size="sm" type="button" onClick={addOption}>+ Add option</Button>
        </div>
      )}

      {type.isScale && (
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Minimum"
            type="number"
            value={question.scale_min ?? 1}
            onChange={(e) => update({ scale_min: Number(e.target.value) })}
          />
          <FormField
            label="Maximum"
            type="number"
            value={question.scale_max ?? 5}
            onChange={(e) => update({ scale_max: Number(e.target.value) })}
          />
          <FormField
            label="Minimum label (optional)"
            value={question.scale_min_label || ''}
            onChange={(e) => update({ scale_min_label: e.target.value })}
          />
          <FormField
            label="Maximum label (optional)"
            value={question.scale_max_label || ''}
            onChange={(e) => update({ scale_max_label: e.target.value })}
          />
        </div>
      )}

      <div className="flex items-center justify-between border-t border-hairline pt-3">
        <Toggle checked={question.required} onChange={(checked) => update({ required: checked })} label="Required" />
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setExpanded(false)} className="p-1.5 text-ink-muted hover:text-ink-900" aria-label="Collapse">
            <span className="material-symbols-outlined text-lg">expand_less</span>
          </button>
          <button type="button" onClick={onRemove} className="p-1.5 text-ink-muted hover:text-danger" aria-label="Remove question">
            <span className="material-symbols-outlined text-lg">delete</span>
          </button>
        </div>
      </div>
    </div>
  )
}
