export default function EmptyState({ icon = 'inbox', title, description, className = '' }) {
  return (
    <div
      className={[
        'flex flex-col items-center gap-3 rounded-lg border border-hairline bg-surface-low px-6 py-16 text-center',
        className,
      ].join(' ')}
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-green-900 shadow-md">
        <span className="material-symbols-outlined text-3xl">{icon}</span>
      </span>
      <h3 className="text-lg font-bold text-ink-900">{title}</h3>
      {description && <p className="max-w-sm text-sm text-ink-muted">{description}</p>}
    </div>
  )
}
