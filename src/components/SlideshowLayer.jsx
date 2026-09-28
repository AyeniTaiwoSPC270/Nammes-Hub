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

export default function SlideshowLayer({
  images,
  transition = 'fade',
  intervalSeconds = 5,
  className = 'absolute inset-0 bg-cover bg-center',
}) {
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
  if (!activeImage) return null

  const variants = TRANSITIONS[transition] ?? TRANSITIONS.fade

  return (
    <AnimatePresence>
      <motion.div
        key={reducedMotion ? 'static' : index}
        className={className}
        style={{ backgroundImage: `url('${activeImage}')` }}
        aria-hidden="true"
        initial={reducedMotion ? false : variants.initial}
        animate={variants.animate}
        exit={reducedMotion ? undefined : variants.exit}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </AnimatePresence>
  )
}
