import { Link } from 'react-router-dom'

export const ADMIN_SECTIONS = [{ path: '/admin/news', label: 'News' }]

export default function Admin() {
  return (
    <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
      <div className="font-mono text-xs font-bold uppercase tracking-[.04em] text-green-700">Exco only</div>
      <h1 className="mt-1.5 text-[32px]">Admin</h1>
      <p className="mt-2 max-w-2xl text-ink-muted">
        Create, edit, and delete outlines, events, resources, news, and opportunities.
      </p>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {ADMIN_SECTIONS.map((s) => (
          <Link
            key={s.path}
            to={s.path}
            className="rounded-lg bg-green-100 p-6 text-center font-semibold text-green-900 transition-transform duration-150 ease-out hover:scale-[1.03]"
          >
            {s.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
