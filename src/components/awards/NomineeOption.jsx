export default function NomineeOption({ nominee, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors',
        selected ? 'border-green-900 bg-green-900/5 shadow-sm' : 'border-hairline bg-surface hover:bg-surface-low',
      ].join(' ')}
    >
      <div className="relative">
        {nominee.photo_url ? (
          <img src={nominee.photo_url} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-low text-ink-muted">
            <span className="material-symbols-outlined text-2xl">person</span>
          </span>
        )}
        {selected && (
          <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-green-900 text-white shadow-sm">
            <span className="material-symbols-outlined text-sm">check</span>
          </span>
        )}
      </div>
      <span className="text-sm font-semibold text-ink-900">{nominee.name}</span>
      {selected && (
        <span className="rounded bg-green-900/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[.05em] text-green-900">
          Selected
        </span>
      )}
    </button>
  )
}
