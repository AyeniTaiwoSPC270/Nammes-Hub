import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useOwnAdminRowQuery } from '../data/admins'
import { getAalStatus } from '../lib/mfa'
import { supabase } from '../lib/supabaseClient'
import AuthCard from './AuthCard'
import MfaChallenge from './MfaChallenge'

export default function AdminRoute() {
  const { session, user, loading } = useAuth()
  const location = useLocation()
  const adminRowQuery = useOwnAdminRowQuery(user?.id)
  const [aal, setAal] = useState(null)

  useEffect(() => {
    if (!session) return
    getAalStatus().then(setAal)
  }, [session])

  if (loading) return null
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />
  if (adminRowQuery.isPending) return null
  if (!adminRowQuery.data) return <Navigate to="/" replace />
  if (aal === null) return null

  // Admins who set up two-factor login must pass the code step before the admin area opens.
  if (aal === 'challenge') {
    return (
      <AuthCard>
        <MfaChallenge onVerified={() => setAal('verified')} onCancel={() => supabase.auth.signOut()} />
      </AuthCard>
    )
  }
  return <Outlet />
}
