import { useEffect } from 'react'

/** Stops the page behind a modal from scrolling while `locked` is true. */
export function useBodyScrollLock(locked = true) {
  useEffect(() => {
    if (!locked) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [locked])
}
