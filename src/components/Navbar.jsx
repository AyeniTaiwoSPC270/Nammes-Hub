import { useState } from 'react'
import { NavLink } from 'react-router-dom'

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

export default function Navbar() {
  const [open, setOpen] = useState(false)

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

        <NavLink to="/login" className="hidden sm:inline-block text-sm font-semibold text-green-700 no-underline hover:text-green-900">
          Sign in
        </NavLink>

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
          <NavLink
            to="/login"
            onClick={() => setOpen(false)}
            className={({ isActive }) => [navLinkClass({ isActive }), 'px-4 py-3'].join(' ')}
          >
            Sign in
          </NavLink>
        </nav>
      )}
    </header>
  )
}
