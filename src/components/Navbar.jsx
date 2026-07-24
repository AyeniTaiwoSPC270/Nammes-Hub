import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'

const links = [
  { to: '/', label: 'Home' },
  { to: '/outlines', label: 'Outlines' },
  { to: '/events', label: 'Events' },
  { to: '/resources', label: 'Resources' },
  { to: '/news', label: 'News' },
  { to: '/opportunities', label: 'Opportunities' },
]

function navLinkClass({ isActive }) {
  return [
    'rounded-full px-4 py-2 text-sm font-semibold no-underline',
    isActive ? 'bg-green-100 text-green-700' : 'text-ink hover:text-green-700',
  ].join(' ')
}

const authLinkClass = 'text-sm font-semibold text-green-700 no-underline hover:text-green-900'

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await supabase.auth.signOut()
    setOpen(false)
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-white/95 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-6 px-4 py-3.5 sm:px-8">
        <NavLink to="/" className="inline-flex items-center gap-2 whitespace-nowrap no-underline">
          <img src="/logo.png" alt="" className="h-8 w-8" />
          <span className="font-display text-lg font-semibold text-green-900">NAMMES Hub</span>
        </NavLink>

        <nav className="hidden sm:flex items-center gap-2">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === '/'} className={navLinkClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        {!loading && (
          <div className="hidden sm:flex items-center gap-4">
            {user ? (
              <>
                <span className="max-w-[16ch] truncate text-sm text-ink-muted" title={user.email}>
                  {user.email}
                </span>
                <button type="button" onClick={handleSignOut} className={authLinkClass}>
                  Sign out
                </button>
              </>
            ) : (
              <NavLink to="/login" className={authLinkClass}>
                Sign in
              </NavLink>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
          aria-expanded={open}
          className="flex flex-col gap-1 p-2 sm:hidden"
        >
          <span className="block h-0.5 w-5.5 bg-green-900" />
          <span className="block h-0.5 w-5.5 bg-green-900" />
          <span className="block h-0.5 w-5.5 bg-green-900" />
        </button>
      </div>

      {open && (
        <nav className="fixed inset-x-0 top-[60px] flex flex-col gap-0.5 border-b border-hairline bg-white px-4 py-2 shadow-md sm:hidden">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) => [navLinkClass({ isActive }), 'px-4 py-3'].join(' ')}
            >
              {link.label}
            </NavLink>
          ))}
          {!loading &&
            (user ? (
              <>
                <span className="max-w-[16ch] truncate px-4 py-2 text-sm text-ink-muted" title={user.email}>
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className={[navLinkClass({ isActive: false }), 'px-4 py-3 text-left'].join(' ')}
                >
                  Sign out
                </button>
              </>
            ) : (
              <NavLink
                to="/login"
                onClick={() => setOpen(false)}
                className={({ isActive }) => [navLinkClass({ isActive }), 'px-4 py-3'].join(' ')}
              >
                Sign in
              </NavLink>
            ))}
        </nav>
      )}
    </header>
  )
}
