const tones = {
  neutral: { bg: 'bg-surface', eyebrow: 'text-orange-600', title: 'text-ink-900', meta: 'text-ink-muted', body: 'text-ink' },
  green: { bg: 'bg-green-900', eyebrow: 'text-orange-500', title: 'text-white', meta: 'text-white/70', body: 'text-white/90' },
  orange: { bg: 'bg-orange-100', eyebrow: 'text-orange-600', title: 'text-ink-900', meta: 'text-ink-muted', body: 'text-ink' },
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
  backgroundImage,
  layout = 'column',
  interactive = false,
}) {
  const t = tones[tone] || tones.neutral
  const isRow = layout === 'row'

  return (
    <div
      className={[
        'relative overflow-hidden rounded-lg transition-[transform,box-shadow] duration-150 ease-out',
        isRow ? 'flex flex-col md:flex-row' : 'flex flex-col gap-2',
        tone === 'neutral' ? 'border border-hairline shadow-md' : '',
        interactive ? 'hover:-translate-y-0.5 hover:shadow-md' : '',
        t.bg,
        className,
      ].join(' ')}
    >
      {backgroundImage && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('${backgroundImage}')` }}
            aria-hidden="true"
          />
          <div className={['absolute inset-0 opacity-80', t.bg].join(' ')} aria-hidden="true" />
        </>
      )}
      {image && imageVariant === 'cover' && (
        <img
          src={image.src}
          alt=""
          aria-hidden="true"
          className={
            isRow
              ? 'h-64 w-full object-cover md:h-auto md:w-1/2'
              : ['w-full rounded-t-lg object-cover', imageAspects[imageAspect] || imageAspects.standard].join(' ')
          }
        />
      )}
      <div
        className={[
          'relative z-10 flex flex-col gap-2',
          padded ? 'p-6' : '',
          isRow ? 'w-full justify-center md:w-1/2' : '',
        ].join(' ')}
      >
        {image && imageVariant === 'icon' && (
          <img src={image.src} alt="" aria-hidden="true" className="h-16 w-16 object-contain" />
        )}
        {eyebrow && (
          <div className={['text-xs uppercase tracking-[.05em] font-bold', t.eyebrow].join(' ')}>{eyebrow}</div>
        )}
        {title && <h3 className={['text-xl font-bold m-0 line-clamp-2', t.title].join(' ')}>{title}</h3>}
        {meta && <div className={['text-sm', t.meta].join(' ')}>{meta}</div>}
        {children && <div className={['text-base leading-relaxed line-clamp-3', t.body].join(' ')}>{children}</div>}
      </div>
    </div>
  )
}
