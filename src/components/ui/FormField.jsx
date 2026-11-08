import { useState } from 'react'

export default function FormField({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  helper,
  error,
  options,
  required = false,
  success = false,
  maxLength,
  rows = 5,
  revealable = false,
}) {
  // Only a password has anything to reveal, so the toggle is opt-in per field.
  const [revealed, setRevealed] = useState(false)
  const canReveal = revealable && type === 'password'

  const controlClass = [
    'min-h-11 rounded-md border px-3 py-2.5 text-base bg-surface text-ink transition-colors duration-150',
    'focus:outline-none focus:border-brand',
    error ? 'border-danger' : success ? 'border-success' : 'border-hairline',
    // The input sits in a wrapper once it has a toggle, so it needs its own full width.
    canReveal ? 'w-full pr-11' : '',
  ].join(' ')

  return (
    <label className="flex flex-col gap-1.5 font-body">
      <span className="text-xs font-semibold uppercase tracking-[.05em] text-brand-orange">{label}</span>
      {type === 'select' ? (
        <select value={value} onChange={onChange} required={required} className={controlClass}>
          {(options || []).map((o, i) => (
            <option key={i} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          rows={rows}
          maxLength={maxLength}
          className={controlClass}
        />
      ) : canReveal ? (
        <div className="relative">
          <input
            type={revealed ? 'text' : 'password'}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            required={required}
            maxLength={maxLength}
            className={controlClass}
          />
          <button
            type="button"
            // A button inside a <label> would otherwise forward the click to the input.
            onClick={(event) => {
              event.preventDefault()
              setRevealed((shown) => !shown)
            }}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-sm text-ink-muted transition-colors duration-150 hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <span className="material-symbols-outlined text-lg" aria-hidden="true">
              {revealed ? 'visibility_off' : 'visibility'}
            </span>
          </button>
        </div>
      ) : (
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          maxLength={maxLength}
          className={controlClass}
        />
      )}
      {error ? (
        <span className="text-xs text-danger">{error}</span>
      ) : success ? (
        <span className="text-xs text-success">Looks good</span>
      ) : helper ? (
        <span className="text-xs text-ink-muted">{helper}</span>
      ) : null}
    </label>
  )
}
