import Button from './Button'

export default function ErrorState({ message = "Something went wrong. Please try again.", onRetry, className = '' }) {
  return (
    <div
      className={[
        'flex flex-col items-center gap-3 rounded-lg border border-hairline bg-surface-low px-6 py-16 text-center',
        className,
      ].join(' ')}
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-danger shadow-md">
        <span className="material-symbols-outlined text-3xl">error_outline</span>
      </span>
      <h3 className="text-lg font-bold text-ink-900">Couldn&rsquo;t load this</h3>
      <p className="max-w-sm text-sm text-ink-muted">{message}</p>
      {onRetry && (
        <Button variant="destructive" size="sm" className="mt-1" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
