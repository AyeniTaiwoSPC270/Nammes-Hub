import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { recordPageView } from '../data/analytics'
import { useAuth } from '../lib/AuthContext'
import {
  normalisePath,
  optedOutOfTracking,
  readVisitor,
  referrerHost,
  shouldTrack,
} from '../lib/pageViewTracker'

// Records one view per path per mount. Rendered once, inside the router, so it sees every navigation.
//
// There is no feature-flag request here on purpose: the kill switch is checked inside
// record_page_view on the server, so a disabled site costs one unremarkable call rather than an extra
// round trip for every visitor who was never going to be counted. The server also owns the duplicate
// guard, which is what makes a remount safe.
export default function PageViewTracker() {
  const location = useLocation()
  const { user } = useAuth()
  const lastPath = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (optedOutOfTracking(window.navigator)) return

    const path = normalisePath(location.pathname)
    if (!shouldTrack(path)) return
    // StrictMode runs this effect twice in development; without the ref the same view would be sent
    // twice and only the server's two-second window would save the number.
    if (lastPath.current === path) return
    lastPath.current = path

    recordPageView({
      path,
      visitor: readVisitor(window.sessionStorage),
      referrerHost: referrerHost(document.referrer, window.location.origin),
      signedIn: Boolean(user),
    }).catch(() => {})
  }, [location.pathname, user])

  return null
}
