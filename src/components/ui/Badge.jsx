const tones = {
  new: 'bg-orange-100 text-orange-600',
  updated: 'bg-success-bg text-success',
  restricted: 'bg-danger-bg text-danger',
  neutral: 'bg-surface-low text-ink-muted',
}

export default function Badge({ tone = 'new', children }) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-xs font-medium uppercase tracking-[.03em]',
        tones[tone] || tones.neutral,
      ].join(' ')}
    >
      {children}
    </span>
  )
}
