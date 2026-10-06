export default function Toggle({ checked, onChange, label, description, hideLabel = false }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 select-none">
      <span className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="absolute inset-0 rounded-full bg-hairline transition-colors duration-150 peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand" />
        <span className="absolute left-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150 peer-checked:translate-x-5" />
      </span>
      {/* A switch that sits inside a list of rows already labelled by the row, so the text is for a screen reader only. */}
      <span className={hideLabel ? 'sr-only' : 'flex flex-col'}>
        <span className="text-sm font-semibold text-ink">{label}</span>
        {description && <span className="text-xs text-ink-muted">{description}</span>}
      </span>
    </label>
  )
}
