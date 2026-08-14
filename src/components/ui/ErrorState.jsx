import Button from './Button'

export default function ErrorState({ message = "Something went wrong. Please try again.", onRetry }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg bg-danger-bg p-8 text-left">
      <h3 className="text-xl text-danger">Couldn&rsquo;t load this</h3>
      <p className="max-w-md text-ink">{message}</p>
      {onRetry && (
        <Button variant="destructive" size="sm" className="mt-2" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
