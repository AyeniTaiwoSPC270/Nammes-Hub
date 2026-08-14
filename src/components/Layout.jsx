import { Suspense } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Navbar from './Navbar'
import Footer from './Footer'
import { SkeletonText } from './ui/Skeleton'

export default function Layout() {
  const location = useLocation()
  const reducedMotion = useReducedMotion()
  const outlet = useOutlet()

  return (
    <div className="min-h-svh flex flex-col bg-paper">
      <Navbar />
      <main className="flex-1">
        <Suspense
          fallback={
            <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
              <SkeletonText lines={3} />
            </div>
          }
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {outlet}
            </motion.div>
          </AnimatePresence>
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
