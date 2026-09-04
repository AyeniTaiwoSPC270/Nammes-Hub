export default function NominationCategoryField({ category, index, value, onChange }) {
  const filled = Boolean((value || '').trim())

  return (
    <div className="rounded-lg bg-surface-low p-5 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-[.05em] text-orange-600">
          Category {String(index + 1).padStart(2, '0')}
        </span>
        <span
          className={[
            'inline-flex items-center gap-1 text-xs font-semibold',
            filled ? 'text-green-900' : 'text-ink-muted',
          ].join(' ')}
        >
          <span className="material-symbols-outlined text-base">{filled ? 'check_circle' : 'radio_button_unchecked'}</span>
          {filled ? 'Nominated' : 'Pending'}
        </span>
      </div>
      <h2 className="text-lg font-bold text-ink-900">{category.title}</h2>
      {category.description && <p className="mt-1 text-sm text-ink-muted">{category.description}</p>}
      <div className="relative mt-3 flex items-center">
        <span className="material-symbols-outlined pointer-events-none absolute left-3 text-ink-muted">person</span>
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Who do you nominate for ${category.title}?`}
          className="w-full rounded-md border border-hairline bg-surface py-2.5 pl-10 pr-10 text-base text-ink transition-colors focus:border-green-900 focus:outline-none"
        />
        <span
          className={['material-symbols-outlined pointer-events-none absolute right-3', filled ? 'text-green-900' : 'text-hairline'].join(' ')}
        >
          {filled ? 'check_circle' : 'edit'}
        </span>
      </div>
    </div>
  )
}
