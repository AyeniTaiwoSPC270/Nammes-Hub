import { useEffect, useState } from 'react'

/**
 * Whether `query` currently matches, kept in step with later changes rather than read once.
 *
 * The subscribe matters more than the initial read: the mobile menu only exists below `lg`, so a
 * breakpoint checked once at open time goes stale if the phone is rotated or a window is resized
 * while the menu is up, and the lock would then be applied to a page the user cannot see.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => Boolean(window.matchMedia?.(query).matches))

  useEffect(() => {
    const media = window.matchMedia(query)
    function update(event) {
      setMatches(event.matches)
    }
    setMatches(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])

  return matches
}
