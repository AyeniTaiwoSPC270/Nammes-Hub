import { Link } from 'react-router-dom'

export const ADMIN_SECTIONS = [
  {
    path: '/admin/news',
    label: 'News',
    icon: 'article',
    category: 'Content',
    description: 'Publish articles and updates for the hub.',
  },
  {
    path: '/admin/events',
    label: 'Events',
    icon: 'event',
    category: 'Logistics',
    description: 'Schedule and update upcoming events.',
  },
  {
    path: '/admin/resources',
    label: 'Resources',
    icon: 'folder_open',
    category: 'Library',
    description: 'Upload and organize academic resources.',
  },
  {
    path: '/admin/opportunities',
    label: 'Opportunities',
    icon: 'work',
    category: 'Careers',
    description: 'Share scholarships and internships.',
  },
  {
    path: '/admin/excos',
    label: 'Excos',
    icon: 'groups',
    category: 'Directory',
    description: 'Manage the executive team directory.',
  },
  {
    path: '/admin/outlines',
    label: 'Outlines',
    icon: 'menu_book',
    category: 'Academics',
    description: 'Maintain course outlines by level and semester.',
  },
]

export default function Admin() {
  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-ink-900">Admin Dashboard</h1>
        <p className="max-w-2xl text-ink-muted">
          Exco-only workspace for managing news, events, resources, opportunities, excos, and outlines.
        </p>
      </header>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {ADMIN_SECTIONS.map((s) => (
          <Link
            key={s.path}
            to={s.path}
            className="group flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-6 shadow-md no-underline transition-shadow hover:shadow-lg"
          >
            <div className="flex w-full items-start justify-between">
              <span className="text-xs font-semibold uppercase tracking-[.05em] text-orange-600">{s.category}</span>
              <span className="material-symbols-outlined text-hairline transition-colors group-hover:text-green-900">
                {s.icon}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold text-ink-900">Manage {s.label}</h2>
              <p className="text-sm text-ink-muted">{s.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
