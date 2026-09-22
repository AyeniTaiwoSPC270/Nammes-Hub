export default function NomineeOption({ nominee, selected, onSelect, onShare }) {
  return (
    <div
      className={[
        'flex flex-col overflow-hidden rounded-lg border bg-surface text-left shadow-sm transition-shadow hover:shadow-md',
        selected ? 'border-brand' : 'border-hairline',
      ].join(' ')}
    >
      <button type="button" onClick={onSelect} className="relative flex aspect-[4/5] w-full items-center justify-center bg-surface-low">
        {nominee.photo_url ? (
          <img src={nominee.photo_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-ink-muted">
            <span className="material-symbols-outlined text-4xl">person</span>
          </span>
        )}
        {selected && (
          <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-green-900 text-white shadow-sm">
            <span className="material-symbols-outlined text-sm">check</span>
          </span>
        )}
        {onShare && (
          <span
            role="button"
            aria-label={`Share campaign card for ${nominee.name}`}
            onClick={(e) => {
              e.stopPropagation()
              onShare()
            }}
            className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-surface/90 text-ink shadow-sm hover:bg-surface"
          >
            <span className="material-symbols-outlined text-base">share</span>
          </span>
        )}
      </button>
      <div className="flex flex-col gap-1 p-3 text-center">
        <span className="truncate text-sm font-semibold text-ink-900">{nominee.name}</span>
        {selected && (
          <span className="mx-auto rounded bg-green-900/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[.05em] text-brand">
            Selected
          </span>
        )}
      </div>
    </div>
  )
}
