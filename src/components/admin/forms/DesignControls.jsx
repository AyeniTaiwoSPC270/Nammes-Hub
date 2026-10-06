import { FORM_FONTS } from '../../../lib/formTheme'

const LABEL = 'text-xs font-semibold uppercase tracking-[.05em] text-orange-600'

export function ControlSection({ title, children, action }) {
  return (
    <section className="flex flex-col gap-3 border-b border-hairline py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-ink-900">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

// `className` replaces the default accent so a screen themed in another colour (the quiz studio follows the quiz accent)
// can reuse this instead of hand-rolling the same input.
export function Slider({ label, value, min, max, step = 1, unit = '', className = 'accent-green-900', onChange }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center justify-between text-xs text-ink-muted">
        <span className="font-semibold text-ink">{label}</span>
        <span>{Math.round(value * 100) / 100}{unit}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`h-6 w-full cursor-pointer ${className}`}
      />
    </label>
  )
}

export function ColorField({ label, value, onChange, allowClear = false, fallback = '#000000' }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-semibold text-ink">{label}</span>
      <div className="flex items-center gap-2">
        {allowClear && value && (
          <button type="button" onClick={() => onChange('')} className="text-xs font-semibold text-brand hover:underline">
            Reset
          </button>
        )}
        <span className="text-xs tabular-nums text-ink-muted">{value || 'Auto'}</span>
        <input
          type="color"
          value={value || fallback}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="h-9 w-12 cursor-pointer rounded-md border border-hairline bg-surface p-0.5"
        />
      </div>
    </div>
  )
}

export function Segmented({ label, value, options, onChange }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <span className="text-xs font-semibold text-ink">{label}</span>}
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className={[
              'min-h-9 rounded-md border px-3 text-xs font-semibold transition-colors duration-150',
              value === o.value ? 'border-green-900 bg-green-900 text-white' : 'border-hairline bg-surface text-ink hover:bg-surface-low',
            ].join(' ')}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function FontSelect({ label, value, onChange }) {
  const groups = [...new Set(FORM_FONTS.map((f) => f.group))]
  return (
    <label className="flex flex-col gap-1.5">
      <span className={LABEL}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-10 rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand"
      >
        {groups.map((g) => (
          <optgroup key={g} label={g}>
            {FORM_FONTS.filter((f) => f.group === g).map((f) => (
              <option key={f.name} value={f.name}>{f.name}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}

export function ToggleIcon({ active, icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={[
        'flex h-10 w-10 items-center justify-center rounded-md border transition-colors duration-150',
        active ? 'border-green-900 bg-green-900 text-white' : 'border-hairline bg-surface text-ink hover:bg-surface-low',
      ].join(' ')}
    >
      <span className="material-symbols-outlined text-lg">{icon}</span>
    </button>
  )
}

/** Bold / italic / underline, alignment, size and colour for one run of text. */
export function TextStyleControls({ value, onChange, sizeMin = 10, sizeMax = 48, showAlign = true, colorFallback = '#000000' }) {
  const set = (patch) => onChange({ ...value, ...patch })
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        <ToggleIcon icon="format_bold" label="Bold" active={Boolean(value.bold)} onClick={() => set({ bold: !value.bold })} />
        <ToggleIcon icon="format_italic" label="Italic" active={Boolean(value.italic)} onClick={() => set({ italic: !value.italic })} />
        <ToggleIcon icon="format_underlined" label="Underline" active={Boolean(value.underline)} onClick={() => set({ underline: !value.underline })} />
        {showAlign && (
          <>
            <span className="mx-1 w-px self-stretch bg-hairline" />
            <ToggleIcon icon="format_align_left" label="Align left" active={value.align === 'left'} onClick={() => set({ align: 'left' })} />
            <ToggleIcon icon="format_align_center" label="Align center" active={value.align === 'center'} onClick={() => set({ align: 'center' })} />
            <ToggleIcon icon="format_align_right" label="Align right" active={value.align === 'right'} onClick={() => set({ align: 'right' })} />
          </>
        )}
      </div>
      <Slider label="Size" value={value.size} min={sizeMin} max={sizeMax} unit="px" onChange={(size) => set({ size })} />
      <ColorField label="Color" value={value.color} allowClear fallback={colorFallback} onChange={(color) => set({ color })} />
    </div>
  )
}
