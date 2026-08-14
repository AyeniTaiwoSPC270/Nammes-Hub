import Button from './Button'

export default function EmptyState({ title, body, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg bg-green-100 p-8 text-left">
      <h3 className="text-xl text-green-900">{title}</h3>
      {body && <p className="max-w-md text-ink-muted">{body}</p>}
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" className="mt-2" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
