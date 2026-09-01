export default function FormField({ label, type = 'text', value, onChange, placeholder, helper, error, options, required = false }) {
  const controlClass = [
    'rounded-md border px-3 py-2.5 text-base bg-surface text-ink outline-none transition-colors',
    error ? 'border-danger' : 'border-hairline focus:border-green-900',
  ].join(' ')

  return (
    <label className="flex flex-col gap-1.5 font-body">
      <span className="text-xs font-semibold uppercase tracking-[.05em] text-orange-600">{label}</span>
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
          rows={5}
          className={controlClass}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          className={controlClass}
        />
      )}
      {error ? (
        <span className="text-xs text-danger">{error}</span>
      ) : helper ? (
        <span className="text-xs text-ink-muted">{helper}</span>
      ) : null}
    </label>
  )
}
