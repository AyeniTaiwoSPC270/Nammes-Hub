export default function NomineeOption({ nominee, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors',
        selected ? 'border-green-900 bg-surface-low' : 'border-hairline bg-surface hover:bg-surface-low',
      ].join(' ')}
    >
      {nominee.photo_url ? (
        <img src={nominee.photo_url} alt="" className="h-16 w-16 rounded-full object-cover" />
      ) : (
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-low text-ink-muted">
          <span className="material-symbols-outlined text-2xl">person</span>
        </span>
      )}
      <span className="text-sm font-semibold text-ink-900">{nominee.name}</span>
    </button>
  )
}
