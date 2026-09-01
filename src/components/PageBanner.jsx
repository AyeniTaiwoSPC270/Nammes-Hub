export default function PageBanner({ image, title, subtitle, size = 'md' }) {
  return (
    <section
      className={[
        'relative w-full flex items-center justify-center overflow-hidden',
        size === 'lg' ? 'h-[400px]' : 'h-64 md:h-80',
      ].join(' ')}
    >
      {image && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('${image}')` }}
          aria-hidden="true"
        />
      )}
      <div className={['absolute inset-0 bg-green-900', image ? 'opacity-80' : ''].join(' ')} aria-hidden="true" />
      <div className="relative z-10 max-w-[1200px] w-full px-4 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">{title}</h1>
        {subtitle && <p className="text-lg text-white/90 max-w-2xl mx-auto">{subtitle}</p>}
      </div>
    </section>
  )
}
