import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useOwnAdminRowQuery } from '../data/admins'

export default function AdminRoute() {
  const { session, user, loading } = useAuth()
  const location = useLocation()
  const adminRowQuery = useOwnAdminRowQuery(user?.id)

  if (loading || (session && adminRowQuery.isLoading)) return null
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />
  if (!adminRowQuery.data) return <Navigate to="/" replace />
  return <Outlet />
}
