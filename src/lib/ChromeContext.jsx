import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const ChromeContext = createContext(undefined)

// The navbar and footer sit in Layout, above the routed page, so a page that wants them gone has to
// say so through context rather than by rendering a shell of its own.
export function ChromeProvider({ children }) {
  const [hidden, setHidden] = useState(false)
  const setChrome = useCallback((next) => setHidden(Boolean(next)), [])

  const value = useMemo(() => ({ hidden, setChrome }), [hidden, setChrome])

  return <ChromeContext.Provider value={value}>{children}</ChromeContext.Provider>
}

export function useChrome() {
  const context = useContext(ChromeContext)
  if (context === undefined) {
    throw new Error('useChrome must be used within a ChromeProvider')
  }
  return context
}

/**
 * Hides the site navbar and footer while this page says they should be gone. Reset on unmount, so
 * navigating away puts the chrome back without the next page having to ask for it.
 */
export function useSiteChrome({ hidden = false } = {}) {
  const { setChrome } = useChrome()
  const wantsHidden = Boolean(hidden)

  useEffect(() => {
    setChrome(wantsHidden)
    return () => setChrome(false)
  }, [setChrome, wantsHidden])
}

/**
 * The form page decides for itself whether it is answered bare, so Layout assumes bare from the
 * first paint of that route and the page's own call takes over as soon as it renders. Without this
 * the navbar would flash on the way into a form — including the way most people arrive at one,
 * which is a shared link opened cold, while the page is still being fetched.
 */
export function isChromeFreePath(pathname) {
  return /^\/forms\/[^/]+\/?$/.test(pathname)
}