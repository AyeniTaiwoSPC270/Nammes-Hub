import { motion, useReducedMotion } from 'motion/react'

export default function Reveal({ as = 'div', delay = 0, className = '', children }) {
  const reducedMotion = useReducedMotion()
  const Tag = as === 'section' ? motion.section : motion.div

  return (
    <Tag
      className={className}
      initial={reducedMotion ? false : { opacity: 0, y: 24, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: false, margin: '-80px' }}
      transition={{ duration: 0.5, ease: 'easeOut', delay: reducedMotion ? 0 : delay }}
    >
      {children}
    </Tag>
  )
}
