import { Suspense, useEffect } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Navbar from './Navbar'
import { HolidayBanner } from './site/HolidayDecor'
import HolidayBackground from './site/HolidayBackground'
import { useHolidayPageBackground } from '../lib/useHolidayPageBackground'
import Footer from './Footer'
import WelcomeCarousel from './tour/WelcomeCarousel'
import SpotlightOverlay from './tour/SpotlightOverlay'
import { useChrome, isAuthPath, isChromeFreePath, resolveChrome } from '../lib/ChromeContext'

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

// The auth shell is its own shape: a forest panel beside a narrow form column. Neither of the two
// skeletons above has that silhouette, so the route would land as a visible jump between shapes.
function AuthRouteSkeleton() {
  return (
    <div className="grid min-h-svh bg-paper lg:grid-cols-[44%_1fr]">
      <div className="hidden bg-green-900 lg:block" />
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[380px]">
          <div className="h-3 w-24 animate-pulse rounded-sm bg-hairline" />
          <div className="mt-3 h-8 w-2/3 animate-pulse rounded-sm bg-hairline" />
          <div className="mt-6 h-11 w-full animate-pulse rounded-md bg-hairline" />
          <div className="mt-3 h-11 w-full animate-pulse rounded-md bg-hairline" />
          <div className="mt-4 h-11 w-full animate-pulse rounded-md bg-hairline" />
        </div>
      </div>
    </div>
  )
}

export default function Layout() {
  const location = useLocation()
  const reducedMotion = useReducedMotion()
  const outlet = useOutlet()
  const { decision } = useChrome()
  const chromeFree = isChromeFreePath(location.pathname)
  // When a live holiday paints the page background, the layer fills the role this wrapper's bg-paper
  // holds — the wrapper drops it or the layer behind it could never show.
  const holidayBg = useHolidayPageBackground()

  // The page answers for itself where it can; until it has, a route that may go bare starts bare so
  // the navbar never paints and then vanishes while the page decides.
  const bare = resolveChrome({ pathname: location.pathname, decision })

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className={`min-h-svh flex flex-col${holidayBg ? '' : ' bg-paper'}`}>
      {holidayBg && <HolidayBackground />}
      {!bare && <Navbar />}
      {/* The holiday greeting sits under the navbar exactly as the spec places it — this is why it is
          rendered here and not by the provider, which wraps routes that have no navbar. */}
      {!bare && <HolidayBanner />}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <Suspense
              fallback={
                isAuthPath(location.pathname) ? <AuthRouteSkeleton /> : chromeFree ? <FormRouteSkeleton /> : <RouteSkeleton />
              }
            >
              {outlet}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
      {!bare && <Footer />}
      <WelcomeCarousel />
      <SpotlightOverlay />
    </div>
  )
}
