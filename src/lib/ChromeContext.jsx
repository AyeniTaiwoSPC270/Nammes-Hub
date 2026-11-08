import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'

const ChromeContext = createContext(undefined)

// The navbar and footer sit in Layout, above the routed page, so a page that wants them gone has to
// say so through context rather than by rendering a shell of its own. Only the last decision is
// kept, and with the path it was made on, because that is all Layout can act on.
export function ChromeProvider({ children }) {
  const [decision, setDecision] = useState({ pathname: null, hidden: false })

  const setChrome = useCallback((pathname, hidden) => {
    setDecision((prev) => (prev.pathname === pathname && prev.hidden === hidden ? prev : { pathname, hidden }))
  }, [])

  const value = useMemo(() => ({ decision, setChrome }), [decision, setChrome])

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
 * Records whether this page wants the site navbar and footer gone. It is remembered against the path
 * it was made on, so navigating away restores the chrome without the next page having to ask for it,
 * and no page inherits another page's answer.
 */
export function useSiteChrome({ hidden = false } = {}) {
  const { setChrome } = useChrome()
  const { pathname } = useLocation()
  const wantsHidden = Boolean(hidden)

  useEffect(() => {
    setChrome(pathname, wantsHidden)
  }, [setChrome, pathname, wantsHidden])
}

/**
 * A route that is answered bare before its page has said anything. Without this the navbar would
 * flash on the way in — including the way most people arrive, which is a shared link opened cold
 * while the page is still being fetched.
 *
 * The four auth screens are here for the same reason as a form: the redesigned shell carries the brand
 * itself, and a navbar above it would be a second header and a second way home.
 */
const AUTH_PATHS = new Set(['/login', '/signup', '/forgot-password', '/reset-password'])

export function isAuthPath(pathname) {
  return AUTH_PATHS.has(pathname.replace(/\/$/, ''))
}

export function isChromeFreePath(pathname) {
  return /^\/forms\/[^/]+\/?$/.test(pathname) || isAuthPath(pathname)
}

/**
 * Whether the chrome stays off for a route. A page's own answer wins, but only for the path it was
 * made on; until then a route that may go bare is assumed bare. Note the order: the page decides
 * *false* as deliberately as true, so a form with focus mode off keeps its navbar.
 */
export function resolveChrome({ pathname, decision }) {
  if (decision?.pathname === pathname) return Boolean(decision.hidden)
  return isChromeFreePath(pathname)
}