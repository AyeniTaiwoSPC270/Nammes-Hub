const tones = {
  neutral: { bg: 'bg-surface', eyebrow: 'text-ink-muted', title: 'text-green-900', meta: 'text-ink-muted', body: 'text-ink' },
  green: { bg: 'bg-green-700', eyebrow: 'text-orange-400', title: 'text-white', meta: 'text-white/70', body: 'text-white/90' },
  orange: { bg: 'bg-orange-100', eyebrow: 'text-orange-600', title: 'text-green-900', meta: 'text-ink-muted', body: 'text-ink' },
}

const imageAspects = {
  standard: 'aspect-[4/3]',
  video: 'aspect-[16/9]',
}

export default function Card({
  eyebrow,
  title,
  meta,
  children,
  padded = true,
  tone = 'neutral',
  className = '',
  image,
  imageVariant = 'icon',
  imageAspect = 'standard',
  interactive = false,
}) {
  const t = tones[tone] || tones.neutral

  return (
    <div
      className={[
        'flex flex-col gap-2 rounded-lg transition-[transform,box-shadow] duration-150 ease-out',
        interactive ? 'hover:-translate-y-0.5 hover:shadow-md' : '',
        t.bg,
        className,
      ].join(' ')}
    >
      {image && imageVariant === 'cover' && (
        <img
          src={image.src}
          alt=""
          aria-hidden="true"
          className={['w-full rounded-t-lg object-cover', imageAspects[imageAspect] || imageAspects.standard].join(' ')}
        />
      )}
      <div className={['flex flex-col gap-2', padded ? 'p-6' : ''].join(' ')}>
        {image && imageVariant === 'icon' && (
          <img src={image.src} alt="" aria-hidden="true" className="h-16 w-16 object-contain" />
        )}
        {eyebrow && (
          <div className={['font-mono text-xs uppercase tracking-[.04em] font-semibold', t.eyebrow].join(' ')}>
            {eyebrow}
          </div>
        )}
        {title && <h3 className={['text-xl m-0 line-clamp-2', t.title].join(' ')}>{title}</h3>}
        {meta && <div className={['font-mono text-sm', t.meta].join(' ')}>{meta}</div>}
        {children && <div className={['text-base leading-relaxed line-clamp-3', t.body].join(' ')}>{children}</div>}
      </div>
    </div>
  )
}
