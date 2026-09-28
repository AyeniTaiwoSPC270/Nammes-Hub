import { motion, useReducedMotion } from 'motion/react'
import SlideshowLayer from './SlideshowLayer'

export default function PageBanner({ images, title, subtitle, size = 'md', transition = 'fade', intervalSeconds = 5 }) {
  const reducedMotion = useReducedMotion()
  const hasImage = (images ?? []).filter(Boolean).length > 0

  return (
    <section
      className={[
        'relative w-full flex items-center justify-center overflow-hidden',
        size === 'lg' ? 'min-h-[400px]' : 'min-h-64 md:min-h-80',
      ].join(' ')}
    >
      <SlideshowLayer images={images} transition={transition} intervalSeconds={intervalSeconds} />
      <div className={['absolute inset-0 bg-green-900', hasImage ? 'opacity-80' : ''].join(' ')} aria-hidden="true" />
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
