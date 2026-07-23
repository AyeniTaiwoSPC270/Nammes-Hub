const tones = {
  neutral: { bg: 'bg-surface', eyebrow: 'text-ink-muted', title: 'text-green-900', meta: 'text-ink-muted', body: 'text-ink' },
  green: { bg: 'bg-green-700', eyebrow: 'text-orange-400', title: 'text-white', meta: 'text-white/70', body: 'text-white/90' },
  orange: { bg: 'bg-orange-100', eyebrow: 'text-orange-600', title: 'text-green-900', meta: 'text-ink-muted', body: 'text-ink' },
}

export default function Card({ eyebrow, title, meta, children, padded = true, tone = 'neutral', className = '' }) {
  const t = tones[tone] || tones.neutral

  return (
    <div className={['flex flex-col gap-2 rounded-lg', t.bg, padded ? 'p-6' : '', className].join(' ')}>
      {eyebrow && (
        <div className={['font-mono text-xs uppercase tracking-[.04em] font-semibold', t.eyebrow].join(' ')}>
          {eyebrow}
        </div>
      )}
      {title && <h3 className={['text-xl m-0', t.title].join(' ')}>{title}</h3>}
      {meta && <div className={['font-mono text-sm', t.meta].join(' ')}>{meta}</div>}
      {children && <div className={['text-base leading-relaxed', t.body].join(' ')}>{children}</div>}
    </div>
  )
}
