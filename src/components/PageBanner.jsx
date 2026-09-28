import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

const TRANSITIONS = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slide: {
    initial: { opacity: 0, x: 60 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -60 },
  },
  zoom: {
    initial: { opacity: 0, scale: 1.08 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.96 },
  },
}

export default function PageBanner({ images, title, subtitle, size = 'md', transition = 'fade', intervalSeconds = 5 }) {
  const reducedMotion = useReducedMotion()
  const slides = (images ?? []).filter(Boolean)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
  }, [slides.length])

  useEffect(() => {
    if (slides.length < 2) return
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), Math.max(intervalSeconds, 1) * 1000)
    return () => clearInterval(id)
  }, [slides.length, intervalSeconds])

  const activeImage = slides[index] ?? null
  const variants = TRANSITIONS[transition] ?? TRANSITIONS.fade

  return (
    <section
      className={[
        'relative w-full flex items-center justify-center overflow-hidden',
        size === 'lg' ? 'min-h-[400px]' : 'min-h-64 md:min-h-80',
      ].join(' ')}
    >
      {activeImage && (
        <AnimatePresence>
          <motion.div
            key={reducedMotion ? 'static' : index}
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('${activeImage}')` }}
            aria-hidden="true"
            initial={reducedMotion ? false : variants.initial}
            animate={variants.animate}
            exit={reducedMotion ? undefined : variants.exit}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </AnimatePresence>
      )}
      <div className={['absolute inset-0 bg-green-900', activeImage ? 'opacity-80' : ''].join(' ')} aria-hidden="true" />
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
