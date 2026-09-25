const tones = {
  success: 'bg-success text-white',
  danger: 'bg-danger text-white',
  info: 'bg-green-900 text-white',
}

export default function Toast({ tone = 'success', onDismiss, actionLabel, onAction, children }) {
  return (
    <div
      role="status"
      className={[
        'pointer-events-auto flex items-center gap-3 rounded-full px-4.5 py-2.5 text-sm font-semibold shadow-md',
        tones[tone] || tones.success,
      ].join(' ')}
    >
      <span>{children}</span>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold hover:bg-white/25"
        >
          {actionLabel}
        </button>
      )}
      <button type="button" onClick={onDismiss} className="rounded-full text-white/80 hover:text-white" aria-label="Dismiss">
        ✕
      </button>
    </div>
  )
}
