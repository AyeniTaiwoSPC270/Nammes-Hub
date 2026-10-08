import { Suspense, useEffect } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Navbar from './Navbar'
import Footer from './Footer'
import WelcomeCarousel from './tour/WelcomeCarousel'
import SpotlightOverlay from './tour/SpotlightOverlay'
import { useChrome, isChromeFreePath } from '../lib/ChromeContext'

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

// A form is one narrow column of questions with no banner, so it gets its own skeleton: the page
// layout above would be the wrong shape for it.
function FormRouteSkeleton() {
  return (
    <div className="mx-auto max-w-[700px] px-5 py-12 sm:px-6">
      <div className="h-8 w-2/3 animate-pulse rounded-sm bg-hairline" />
      <div className="mt-3 h-4 w-full animate-pulse rounded-sm bg-hairline" />
      <div className="mt-6 flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg border border-hairline bg-surface p-5 shadow-sm">
            <div className="h-4 w-1/2 animate-pulse rounded-sm bg-hairline" />
            <div className="mt-3 h-10 w-full animate-pulse rounded-sm bg-hairline" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Layout() {
  const location = useLocation()
  const reducedMotion = useReducedMotion()
  const outlet = useOutlet()
  const { hidden } = useChrome()
  const chromeFree = isChromeFreePath(location.pathname)

  // A route that hides its own chrome starts out bare, so the navbar never paints and then vanishes
  // while the page decides. Every other route follows the page's own answer.
  const bare = hidden || chromeFree

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className="min-h-svh flex flex-col bg-paper">
      {!bare && <Navbar />}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <Suspense fallback={chromeFree ? <FormRouteSkeleton /> : <RouteSkeleton />}>{outlet}</Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
      {!bare && <Footer />}
      <WelcomeCarousel />
      <SpotlightOverlay />
    </div>
  )
}
