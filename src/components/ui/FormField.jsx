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
}) {
  const controlClass = [
    'rounded-sm border px-3 py-2.5 text-base bg-surface text-ink transition-colors duration-150',
    'focus:outline-none focus:border-green-700',
    error ? 'border-danger' : success ? 'border-success' : 'border-hairline',
  ].join(' ')

  return (
    <label className="flex flex-col gap-1.5 font-body">
      <span className="text-sm font-medium text-green-900">{label}</span>
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
      ) : success ? (
        <span className="text-xs text-success">Looks good</span>
      ) : helper ? (
        <span className="text-xs text-ink-muted">{helper}</span>
      ) : null}
    </label>
  )
}
