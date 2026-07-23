export default function FormField({ label, type = 'text', value, onChange, placeholder, helper, error, options }) {
  const controlClass = [
    'rounded-sm border px-3 py-2.5 text-base bg-surface text-ink',
    error ? 'border-danger' : 'border-hairline',
  ].join(' ')

  return (
    <label className="flex flex-col gap-1.5 font-body">
      <span className="text-sm font-medium text-green-900">{label}</span>
      {type === 'select' ? (
        <select value={value} onChange={onChange} className={controlClass}>
          {(options || []).map((o, i) => (
            <option key={i} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
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
