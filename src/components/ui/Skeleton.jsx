export function SkeletonText({ lines = 1, className = '' }) {
  return (
    <div className={['flex flex-col gap-2', className].join(' ')}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 animate-pulse rounded-sm bg-hairline"
          style={{ width: lines > 1 && i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  )
}

export function SkeletonCard({ imageVariant = 'none' }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-hairline bg-surface shadow-md">
      {imageVariant === 'cover' && <div className="h-48 w-full animate-pulse bg-hairline" />}
      <div className="flex flex-col gap-2 p-6">
        <div className="h-3 w-20 animate-pulse rounded-sm bg-hairline" />
        <div className="h-5 w-3/4 animate-pulse rounded-sm bg-hairline" />
        <SkeletonText lines={2} />
      </div>
    </div>
  )
}

export function SkeletonTable({ columns = 4, rows = 5 }) {
  return (
    <div className="nm-table-wrap overflow-x-auto">
      <div className="w-full overflow-hidden rounded-md border border-hairline">
        <div className="flex bg-surface-low px-4 py-2.5">
          {Array.from({ length: columns }).map((_, i) => (
            <div key={i} className="mr-6 h-3 w-16 animate-pulse rounded-sm bg-hairline last:mr-0" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, ri) => (
          <div key={ri} className="flex border-t border-hairline px-4 py-3">
            {Array.from({ length: columns }).map((_, ci) => (
              <div key={ci} className="mr-6 h-3 w-20 animate-pulse rounded-sm bg-hairline last:mr-0" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
