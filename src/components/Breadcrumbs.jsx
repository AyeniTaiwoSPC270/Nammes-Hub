import { Link } from 'react-router-dom'

export default function Breadcrumbs({ items }) {
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-ink-muted">
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && (
              <span className="material-symbols-outlined text-base text-ink-muted" aria-hidden="true">
                chevron_right
              </span>
            )}
            {isLast || !item.to ? (
              <span className="text-ink-900 font-semibold">{item.label}</span>
            ) : (
              <Link to={item.to} className="text-ink-muted hover:text-ink-900 hover:underline">
                {item.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
