import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { CAROUSEL_SLIDES, SPOTLIGHT_STEPS } from './tourSteps'

const TourContext = createContext(undefined)

function seenKey(userId) {
  return `nammes_tour_seen_${userId}`
}

export function TourProvider({ children }) {
  const { user } = useAuth()
  const [phase, setPhase] = useState(null) // null | 'carousel' | 'spotlight'
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [spotlightIndex, setSpotlightIndex] = useState(0)

  useEffect(() => {
    if (!user || localStorage.getItem(seenKey(user.id))) {
      setPhase(null)
      return
    }
    setCarouselIndex(0)
    setPhase('carousel')
  }, [user])

  const finish = useCallback(() => {
    if (user) localStorage.setItem(seenKey(user.id), '1')
    setPhase(null)
  }, [user])

  const nextCarousel = useCallback(() => {
    setCarouselIndex((i) => {
      if (i >= CAROUSEL_SLIDES.length - 1) {
        setSpotlightIndex(0)
        setPhase('spotlight')
        return i
      }
      return i + 1
    })
  }, [])

  const backCarousel = useCallback(() => {
    setCarouselIndex((i) => Math.max(0, i - 1))
  }, [])

  const nextSpotlight = useCallback(() => {
    setSpotlightIndex((i) => {
      if (i >= SPOTLIGHT_STEPS.length - 1) {
        finish()
        return i
      }
      return i + 1
    })
  }, [finish])

  const value = {
    phase,
    carouselIndex,
    carouselSlide: CAROUSEL_SLIDES[carouselIndex],
    carouselTotal: CAROUSEL_SLIDES.length,
    nextCarousel,
    backCarousel,
    spotlightIndex,
    spotlightStep: SPOTLIGHT_STEPS[spotlightIndex],
    spotlightTotal: SPOTLIGHT_STEPS.length,
    nextSpotlight,
    skip: finish,
    wantsMobileNavOpen: phase === 'spotlight',
  }

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>
}

export function useTour() {
  const context = useContext(TourContext)
  if (context === undefined) {
    throw new Error('useTour must be used within a TourProvider')
  }
  return context
}
