import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export default function ProtectedRoute() {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return null
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />
  return <Outlet />
}
