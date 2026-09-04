import { QUESTION_TYPES } from '../../../data/forms'
import Button from '../../ui/Button'
import FormField from '../../ui/FormField'

export default function QuestionEditorCard({ question, index, total, onChange, onRemove, onMoveUp, onMoveDown }) {
  const type = QUESTION_TYPES.find((t) => t.value === question.type) ?? QUESTION_TYPES[0]

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

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <input
          value={question.label}
          onChange={(e) => update({ label: e.target.value })}
          placeholder="Question"
          className="flex-1 rounded-md border border-hairline bg-surface px-3 py-2 text-base font-semibold text-ink focus:outline-none focus:border-green-900"
        />
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
        className="rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-ink-muted focus:outline-none focus:border-green-900"
      />

      {type.hasOptions && (
        <div className="flex flex-col gap-2">
          {(question.options || []).map((option, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={option}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
                className="flex-1 rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:border-green-900"
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
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={question.required} onChange={(e) => update({ required: e.target.checked })} />
          Required
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={index === 0}
            onClick={onMoveUp}
            className="p-1.5 text-ink-muted hover:text-ink-900 disabled:opacity-30"
            aria-label="Move up"
          >
            <span className="material-symbols-outlined text-lg">arrow_upward</span>
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={onMoveDown}
            className="p-1.5 text-ink-muted hover:text-ink-900 disabled:opacity-30"
            aria-label="Move down"
          >
            <span className="material-symbols-outlined text-lg">arrow_downward</span>
          </button>
          <button type="button" onClick={onRemove} className="p-1.5 text-ink-muted hover:text-danger" aria-label="Remove question">
            <span className="material-symbols-outlined text-lg">delete</span>
          </button>
        </div>
      </div>
    </div>
  )
}
