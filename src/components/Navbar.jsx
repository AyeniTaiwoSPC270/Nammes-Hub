import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { usePendingSubmissionsCountQuery } from '../data/outlineSubmissions'
import Badge from './ui/Badge'

const navItems = [
  { to: '/about', label: 'About' },
  {
    label: 'Academics',
    children: [
      { to: '/outlines', label: 'Outlines' },
      { to: '/timetable', label: 'Timetable' },
      { to: '/cgpa', label: 'CGPA' },
      { to: '/resources', label: 'Resources' },
    ],
  },
  {
    label: 'Community',
    children: [
      { to: '/events', label: 'Events' },
      { to: '/news', label: 'News' },
      { to: '/opportunities', label: 'Opportunities' },
      { to: '/awards', label: 'Awards' },
    ],
  },
  { to: '/forms', label: 'Forms' },
  { to: '/contact', label: 'Contact' },
]

function navLinkClass({ isActive }) {
  return [
    'rounded-sm px-3 py-2 text-sm font-semibold no-underline transition-colors',
    isActive
      ? 'text-ink-900 font-bold border-b-2 border-ink-900'
      : 'text-ink-muted hover:text-ink-900 hover:bg-surface-low',
  ].join(' ')
}

const authLinkClass = 'text-sm font-semibold text-green-900 no-underline hover:text-orange-500'

function NavDropdown({ item }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const location = useLocation()
  const isActive = item.children.some((child) => location.pathname.startsWith(child.to))

  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={[
          'flex items-center gap-0.5 rounded-sm px-3 py-2 text-sm font-semibold transition-colors',
          isActive
            ? 'text-ink-900 font-bold border-b-2 border-ink-900'
            : 'text-ink-muted hover:text-ink-900 hover:bg-surface-low',
        ].join(' ')}
      >
        {item.label}
        <span className="material-symbols-outlined text-lg">{open ? 'expand_less' : 'expand_more'}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 min-w-[170px] rounded-md border border-hairline bg-surface py-1.5 shadow-md">
          {item.children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              onClick={() => setOpen(false)}
              className={({ isActive: childActive }) =>
                [
                  'block px-4 py-2 text-sm font-semibold no-underline transition-colors',
                  childActive ? 'bg-green-100 text-green-900' : 'text-ink-muted hover:bg-surface-low hover:text-ink-900',
                ].join(' ')
              }
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const pendingCountQuery = usePendingSubmissionsCountQuery(Boolean(user))
  const pendingCount = pendingCountQuery.data ?? 0

  async function handleSignOut() {
    await supabase.auth.signOut()
    setOpen(false)
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-surface">
      <div className="flex items-center justify-between gap-6 px-4 py-3.5 sm:px-8">
        <NavLink to="/" className="inline-flex items-center gap-2 whitespace-nowrap no-underline">
          <img src="/logo.png" alt="" className="h-8 w-8" />
          <span className="font-display text-xl font-bold text-ink-900">NAMMES Hub</span>
        </NavLink>

        <nav className="hidden sm:flex items-center gap-1">
          {navItems.map((item) =>
            item.children ? (
              <NavDropdown key={item.label} item={item} />
            ) : (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className={navLinkClass}>
                {item.label}
              </NavLink>
            ),
          )}
        </nav>

        {!loading && (
          <div className="hidden sm:flex items-center gap-4">
            {user ? (
              <>
                <span className="max-w-[16ch] truncate text-sm text-ink-muted" title={user.email}>
                  {user.email}
                </span>
                <NavLink to="/account" className={authLinkClass}>
                  Account
                </NavLink>
                <NavLink to="/admin" className={[authLinkClass, 'inline-flex items-center gap-1.5'].join(' ')}>
                  Admin
                  {pendingCount > 0 && <Badge tone="restricted">{pendingCount}</Badge>}
                </NavLink>
                <button type="button" onClick={handleSignOut} className={authLinkClass}>
                  Sign out
                </button>
              </>
            ) : (
              <NavLink
                to="/login"
                className="rounded-md bg-green-900 px-4 py-2 text-sm font-bold text-white no-underline transition-opacity hover:opacity-90"
              >
                Sign In
              </NavLink>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
          aria-expanded={open}
          className="flex items-center justify-center p-2 text-ink-900 sm:hidden"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
      </div>

      {open && (
        <nav className="fixed inset-x-0 top-[60px] flex max-h-[calc(100vh-60px)] flex-col gap-0.5 overflow-y-auto border-b border-hairline bg-surface px-4 py-2 shadow-md sm:hidden">
          {navItems.map((item) =>
            item.children ? (
              <div key={item.label} className="flex flex-col">
                <span className="px-4 pt-3 pb-1 text-xs font-bold uppercase tracking-[.05em] text-ink-muted">
                  {item.label}
                </span>
                {item.children.map((child) => (
                  <NavLink
                    key={child.to}
                    to={child.to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) => [navLinkClass({ isActive }), 'px-4 py-3'].join(' ')}
                  >
                    {child.label}
                  </NavLink>
                ))}
              </div>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setOpen(false)}
                className={({ isActive }) => [navLinkClass({ isActive }), 'px-4 py-3'].join(' ')}
              >
                {item.label}
              </NavLink>
            ),
          )}
          {!loading &&
            (user ? (
              <>
                <span className="max-w-[16ch] truncate px-4 py-2 text-sm text-ink-muted" title={user.email}>
                  {user.email}
                </span>
                <NavLink
                  to="/account"
                  onClick={() => setOpen(false)}
                  className={({ isActive }) => [navLinkClass({ isActive }), 'px-4 py-3'].join(' ')}
                >
                  Account
                </NavLink>
                <NavLink
                  to="/admin"
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    [navLinkClass({ isActive }), 'px-4 py-3 inline-flex items-center gap-1.5'].join(' ')
                  }
                >
                  Admin
                  {pendingCount > 0 && <Badge tone="restricted">{pendingCount}</Badge>}
                </NavLink>
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
