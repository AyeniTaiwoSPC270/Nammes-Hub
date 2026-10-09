import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'
import { useTour } from '../lib/TourContext'
import { supabase } from '../lib/supabaseClient'
import { usePendingSubmissionsCountQuery } from '../data/outlineSubmissions'
import { useCalendarFlag } from '../data/calendar'
import { useBodyScrollLock } from '../lib/useBodyScrollLock'
import { useMediaQuery } from '../lib/useMediaQuery'
import UserMenu from './UserMenu'
import Badge from './ui/Badge'

// Every entry is a group, so each link in the mobile panel sits under a visible heading.
// Links used to be a mix of groups and loose links, which left About/Forms/Contact looking
// like they belonged to whichever group happened to render above them.
const navGroups = [
  {
    label: 'General',
    children: [{ to: '/about', label: 'About' }],
  },
  {
    label: 'Academics',
    icon: 'menu_book',
    dataTour: 'nav-academics',
    children: [
      // Above Outlines: the calendar's main payload is now senate dates, so a student looking for "when
      // do lectures end" should not have to know that it lives under a different name in the same menu.
      // `requires` is a feature-flag key, resolved once below rather than by branching at each render site.
      { to: '/calendar', label: 'Calendar', requires: 'calendar' },
      { to: '/outlines', label: 'Outlines' },
      { to: '/curriculum', label: 'Curriculum' },
      { to: '/timetable', label: 'Timetable' },
      { to: '/cgpa', label: 'CGPA' },
      { to: '/resources', label: 'Resources' },
    ],
  },
  {
    label: 'Community',
    icon: 'groups',
    dataTour: 'nav-community',
    children: [
      { to: '/events', label: 'Events' },
      { to: '/news', label: 'News' },
      { to: '/opportunities', label: 'Opportunities' },
      { to: '/awards', label: 'Awards' },
    ],
  },
  {
    label: 'Practice',
    icon: 'quiz',
    children: [
      { to: '/quiz', label: 'Quizzes and battles' },
      { to: '/cbt', label: 'CBT practice' },
    ],
  },
  {
    label: 'Support',
    icon: 'support_agent',
    children: [
      { to: '/forms', label: 'Forms' },
      { to: '/contact', label: 'Contact' },
    ],
  },
]

function navLinkClass({ isActive }) {
  return [
    'rounded-sm px-3 py-2 text-sm font-semibold no-underline transition-colors',
    isActive
      ? 'text-ink-900 font-bold border-b-2 border-ink-900'
      : 'text-ink-muted hover:text-ink-900 hover:bg-surface-low',
  ].join(' ')
}

// Mobile rows sit on a surface-low card, where the muted grey above reads as disabled and the
// horizontal underline reads as a stray rule inside a rounded panel. The filled pill matches
// what NavDropdown and UserMenu already use for the current page.
function mobileNavLinkClass({ isActive }) {
  return [
    'block rounded-sm px-3 py-3 text-sm font-semibold no-underline transition-colors',
    isActive ? 'bg-surface text-brand-orange font-bold' : 'text-ink hover:bg-surface hover:text-ink-900',
  ].join(' ')
}

function MobileNavGroup({ label, icon, dataTour, children }) {
  return (
    <div className="rounded-lg bg-surface-low p-1.5" data-tour={dataTour}>
      <span className="flex items-center gap-1.5 px-3 pt-1.5 pb-1 text-xs font-bold uppercase tracking-[.06em] text-brand-orange">
        {icon && <span className="material-symbols-outlined text-base leading-none">{icon}</span>}
        {label}
      </span>
      <div className="flex flex-col">{children}</div>
    </div>
  )
}

// min-w-0 on the flex child is what actually lets truncate shrink; without it the email
// overflows the panel instead of ellipsising.
function IdentityChip({ email }) {
  const initial = (email || '?').charAt(0).toUpperCase()
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-hairline bg-surface-low px-3 py-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-900 text-sm font-bold text-white">
        {initial}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink-900" title={email}>
          {email}
        </span>
        <span className="block text-xs text-ink-muted">Signed in</span>
      </span>
    </div>
  )
}

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
        data-tour={item.dataTour}
        className={[navLinkClass({ isActive }), 'flex items-center gap-0.5'].join(' ')}
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
                  childActive
                    ? 'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-brand'
                    : 'text-ink-muted hover:bg-surface-low hover:text-ink-900',
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

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex h-11 w-11 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-surface-low hover:text-ink-900"
    >
      <span className="material-symbols-outlined text-xl">{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
    </button>
  )
}

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const { user, loading } = useAuth()
  const { wantsMobileNavOpen } = useTour()
  const navigate = useNavigate()
  const pendingCountQuery = usePendingSubmissionsCountQuery(Boolean(user))
  const pendingCount = pendingCountQuery.data ?? 0
  // The kill switch behind the /calendar nav item. Fails open, so the item is there while the query is in
  // flight and only disappears if the flag row actually says the feature is off.
  const calendarEnabled = useCalendarFlag()

  const groups = useMemo(
    () =>
      navGroups.map((group) => ({
        ...group,
        children: group.children.filter((child) => child.requires !== 'calendar' || calendarEnabled),
      })),
    [calendarEnabled],
  )

  useEffect(() => {
    setOpen(wantsMobileNavOpen)
  }, [wantsMobileNavOpen])

  // The panel only exists below `lg`, so that is the only width where the page behind it needs freezing.
  const menuIsVisible = useMediaQuery('(max-width: 1023px)')
  useBodyScrollLock(open && menuIsVisible)

  // While the mobile menu is open, Escape closes it.
  useEffect(() => {
    if (!open) return undefined
    function handleKey(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  async function handleSignOut() {
    await supabase.auth.signOut()
    setOpen(false)
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-surface">
      <div className="flex items-center justify-between gap-6 px-4 py-3.5 sm:px-8">
        <NavLink to="/" className="inline-flex items-center gap-2 whitespace-nowrap no-underline">
          <img src="/logo-small.png" alt="" width="32" height="32" className="h-8 w-8" />
          <span className="font-display text-xl font-bold text-ink-900">NAMMES Hub</span>
        </NavLink>

        <nav className="hidden lg:flex items-center gap-1">
          {groups.map((group) => (
            <NavDropdown key={group.label} item={group} />
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {!loading && (
            <div className="hidden lg:flex items-center gap-4">
              {user ? (
                <UserMenu email={user.email} pendingCount={pendingCount} onSignOut={handleSignOut} align="right" dataTour="nav-account" />
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

          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
            aria-expanded={open}
            className="flex items-center justify-center h-11 w-11 text-ink-900 lg:hidden"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        </div>
      </div>

      {open && (
        <nav className="absolute inset-x-0 top-full flex max-h-[calc(100dvh-4rem)] flex-col gap-2 overflow-y-auto overscroll-contain border-b border-hairline bg-surface px-3 pt-2 pb-4 shadow-md lg:hidden">
          {!loading && user && <IdentityChip email={user.email} />}
          {groups.map((group) => (
            <MobileNavGroup key={group.label} label={group.label} icon={group.icon} dataTour={group.dataTour}>
              {group.children.map((child) => (
                <NavLink
                  key={child.to}
                  to={child.to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) => mobileNavLinkClass({ isActive })}
                >
                  {child.label}
                </NavLink>
              ))}
            </MobileNavGroup>
          ))}
          {!loading &&
            (user ? (
              <MobileNavGroup label="Account" icon="person">
                <NavLink
                  to="/account"
                  onClick={() => setOpen(false)}
                  className={({ isActive }) => mobileNavLinkClass({ isActive })}
                  data-tour="nav-account"
                >
                  Account
                </NavLink>
                <NavLink
                  to="/admin"
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    [mobileNavLinkClass({ isActive }), 'flex items-center gap-1.5'].join(' ')
                  }
                >
                  Admin
                  {pendingCount > 0 && <Badge tone="restricted">{pendingCount}</Badge>}
                </NavLink>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className={[mobileNavLinkClass({ isActive: false }), 'text-left'].join(' ')}
                >
                  Sign out
                </button>
              </MobileNavGroup>
            ) : (
              <MobileNavGroup label="Account" icon="person">
                <NavLink
                  to="/login"
                  onClick={() => setOpen(false)}
                  className={({ isActive }) => mobileNavLinkClass({ isActive })}
                >
                  Sign in
                </NavLink>
              </MobileNavGroup>
            ))}
        </nav>
      )}
    </header>
  )
}
