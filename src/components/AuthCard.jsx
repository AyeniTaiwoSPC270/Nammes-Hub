export default function AuthCard({ children, footer, below, maxWidth = 'max-w-[440px]' }) {
  return (
    <div className="flex min-h-[calc(100svh-64px)] items-center justify-center bg-surface-low px-4 py-12">
      <main className={`w-full ${maxWidth}`}>
        <div className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-md">
          <div className="p-6 pt-8 md:p-8 md:pt-10">{children}</div>
          {footer && <div className="border-t border-hairline bg-surface-low p-6 text-center">{footer}</div>}
        </div>
        {below && (
          <div className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-ink-muted">
            {below}
          </div>
        )}
      </main>
    </div>
  )
}
