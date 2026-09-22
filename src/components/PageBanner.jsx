import { motion, useReducedMotion } from 'motion/react'

export default function PageBanner({ image, title, subtitle, size = 'md' }) {
  const reducedMotion = useReducedMotion()

  return (
    <section
      className={[
        'relative w-full flex items-center justify-center overflow-hidden',
        size === 'lg' ? 'min-h-[400px]' : 'min-h-64 md:min-h-80',
      ].join(' ')}
    >
      {image && (
        <motion.div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('${image}')` }}
          aria-hidden="true"
          initial={reducedMotion ? false : { opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      )}
      <div className={['absolute inset-0 bg-green-900', image ? 'opacity-80' : ''].join(' ')} aria-hidden="true" />
      <motion.div
        className="relative z-10 max-w-[1200px] w-full px-4 text-center"
        initial={reducedMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut', delay: reducedMotion ? 0 : 0.15 }}
      >
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">{title}</h1>
        {subtitle && <p className="text-lg text-white/90 max-w-2xl mx-auto">{subtitle}</p>}
      </motion.div>
    </section>
  )
}
