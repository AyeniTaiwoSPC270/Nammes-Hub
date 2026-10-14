export default function PreviewViewport({ label, children, className = '' }) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={['min-h-0 max-h-[calc(100dvh-12rem)] overflow-y-auto overscroll-contain', className].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  )
}
