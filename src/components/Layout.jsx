import { Suspense } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Navbar from './Navbar'
import Footer from './Footer'

function RouteSkeleton() {
  return (
    <div>
      <div className="relative flex h-64 w-full items-center justify-center overflow-hidden bg-surface-low md:h-80">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-64 animate-pulse rounded-sm bg-hairline" />
          <div className="h-4 w-80 max-w-[80vw] animate-pulse rounded-sm bg-hairline" />
        </div>
      </div>
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="h-48 animate-pulse rounded-lg bg-hairline" />
          <div className="h-48 animate-pulse rounded-lg bg-hairline" />
          <div className="h-48 animate-pulse rounded-lg bg-hairline" />
        </div>
      </div>
    </div>
  )
}

export default function Layout() {
  const location = useLocation()
  const reducedMotion = useReducedMotion()
  const outlet = useOutlet()

  return (
    <div className="min-h-svh flex flex-col bg-paper">
      <Navbar />
      <main className="flex-1">
        <Suspense fallback={<RouteSkeleton />}>
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
