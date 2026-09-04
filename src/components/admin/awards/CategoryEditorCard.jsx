import Button from '../../ui/Button'
import FormField from '../../ui/FormField'

export default function CategoryEditorCard({ category, index, total, onChange, onRemove, onMoveUp, onMoveDown }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[.05em] text-orange-600">
          Category {index + 1}
        </span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" type="button" disabled={index === 0} onClick={onMoveUp}>
            <span className="material-symbols-outlined text-base">arrow_upward</span>
          </Button>
          <Button variant="ghost" size="sm" type="button" disabled={index === total - 1} onClick={onMoveDown}>
            <span className="material-symbols-outlined text-base">arrow_downward</span>
          </Button>
          <Button variant="destructive" size="sm" type="button" onClick={onRemove}>
            <span className="material-symbols-outlined text-base">delete</span>
          </Button>
        </div>
      </div>
      <FormField
        label="Title"
        value={category.title}
        onChange={(e) => onChange({ ...category, title: e.target.value })}
        placeholder="Best Dressed"
        required
      />
      <FormField
        label="Description (optional)"
        type="textarea"
        value={category.description || ''}
        onChange={(e) => onChange({ ...category, description: e.target.value })}
        placeholder="What this award recognizes"
      />
    </div>
  )
}
