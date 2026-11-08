import { useRef } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

// Login, sign-up and forgot-password are for people with no session, so a signed-in visitor is sent
// home. The answer is taken once, when the page is reached, never on every session change: /login
// signs people in itself, and a guard that re-read the session would bounce a two-factor admin off
// the page before the code step could appear. /reset-password is deliberately not behind this — the
// recovery link signs the visitor in, so a session there is the flow working, not a stray visit.
export default function GuestRoute() {
  const { session, loading } = useAuth()
  const signedInOnArrival = useRef(null)

  if (loading) return null
  if (signedInOnArrival.current === null) signedInOnArrival.current = Boolean(session)

  if (signedInOnArrival.current) return <Navigate to="/" replace />
  return <Outlet />
}
