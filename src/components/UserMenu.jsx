import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import Badge from './ui/Badge'

export default function UserMenu({ email, pendingCount = 0, onSignOut, align = 'right', dataTour }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const initial = (email || '?').charAt(0).toUpperCase()

  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Account menu"
        title={email}
        className="flex items-center gap-1 rounded-full p-0.5 transition-colors hover:bg-surface-low"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-900 text-sm font-bold text-white">
          {initial}
        </span>
        {pendingCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white">
            {pendingCount}
          </span>
        )}
        <span className="material-symbols-outlined text-lg text-ink-muted">{open ? 'expand_less' : 'expand_more'}</span>
      </button>
      {open && (
        <div
          className={[
            'absolute top-full z-40 mt-1 min-w-[180px] rounded-md border border-hairline bg-surface py-1.5 shadow-md',
            align === 'right' ? 'right-0' : 'left-0',
          ].join(' ')}
        >
          <div className="truncate px-4 py-2 text-sm text-ink-muted" title={email}>
            {email}
          </div>
          <div className="my-1 border-t border-hairline" />
          <NavLink
            to="/account"
            onClick={() => setOpen(false)}
            data-tour={dataTour}
            className={({ isActive }) =>
              [
                'block px-4 py-2 text-sm font-semibold no-underline transition-colors',
                isActive ? 'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-brand' : 'text-ink-muted hover:bg-surface-low hover:text-ink-900',
              ].join(' ')
            }
          >
            Account
          </NavLink>
          <NavLink
            to="/admin"
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              [
                'flex items-center gap-1.5 px-4 py-2 text-sm font-semibold no-underline transition-colors',
                isActive ? 'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-brand' : 'text-ink-muted hover:bg-surface-low hover:text-ink-900',
              ].join(' ')
            }
          >
            Admin
            {pendingCount > 0 && <Badge tone="restricted">{pendingCount}</Badge>}
          </NavLink>
          <div className="my-1 border-t border-hairline" />
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onSignOut()
            }}
            className="block w-full px-4 py-2 text-left text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-low hover:text-ink-900"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
