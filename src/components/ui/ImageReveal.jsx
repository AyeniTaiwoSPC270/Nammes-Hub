import { motion, useReducedMotion } from 'motion/react'

export default function ImageReveal({ as = 'img', delay = 0, className = '', ...props }) {
  const reducedMotion = useReducedMotion()
  const Tag = as === 'div' ? motion.div : motion.img

  return (
    <Tag
      className={className}
      initial={reducedMotion ? false : { opacity: 0, scale: 1.08 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut', delay: reducedMotion ? 0 : delay }}
      {...props}
    />
  )
}
