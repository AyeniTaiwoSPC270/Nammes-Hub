import { createContext, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

const AuthContext = createContext(undefined)

async function signOutIfDisabled(userId, navigate) {
  const { data } = await supabase.from('profiles').select('is_disabled').eq('user_id', userId).maybeSingle()
  if (!data?.is_disabled) return false
  await supabase.auth.signOut()
  navigate('/login?disabled=1')
  return true
}

function touchLastSeenOnce() {
  if (sessionStorage.getItem('nammes_last_seen_touched')) return
  sessionStorage.setItem('nammes_last_seen_touched', '1')
  supabase.rpc('touch_last_seen')
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const nextSession = data.session
      if (nextSession) {
        const disabled = await signOutIfDisabled(nextSession.user.id, navigate)
        if (disabled) {
          setSession(null)
          setLoading(false)
          return
        }
        touchLastSeenOnce()
      }
      setSession(nextSession)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (newSession) {
        const disabled = await signOutIfDisabled(newSession.user.id, navigate)
        if (disabled) {
          setSession(null)
          setLoading(false)
          return
        }
        touchLastSeenOnce()
      }
      setSession(newSession)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [navigate])

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
