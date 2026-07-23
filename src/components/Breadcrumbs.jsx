import { Link } from 'react-router-dom'

export default function Breadcrumbs({ items }) {
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1.5 font-mono text-xs text-ink-muted">
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true">/</span>}
            {isLast || !item.to ? (
              <span className="text-ink">{item.label}</span>
            ) : (
              <Link to={item.to} className="text-green-700 hover:underline">
                {item.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
