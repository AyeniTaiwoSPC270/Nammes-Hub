import { Link } from 'react-router-dom'
import { usePendingSubmissionsCountQuery } from '../data/outlineSubmissions'
import { useOwnAdminRowQuery } from '../data/admins'
import { useAuth } from '../lib/AuthContext'
import Badge from '../components/ui/Badge'

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
    path: '/admin/users',
    label: 'Users',
    icon: 'group',
    category: 'Directory',
    description: 'View every account and manage admin access.',
  },
  {
    path: '/admin/outlines',
    label: 'Outlines',
    icon: 'menu_book',
    category: 'Academics',
    description: 'Maintain course outlines by level and semester.',
  },
  {
    path: '/admin/submissions',
    label: 'Submissions',
    icon: 'fact_check',
    category: 'Academics',
    description: 'Review and approve student-contributed course materials.',
  },
  {
    path: '/admin/timetables',
    label: 'Timetable',
    icon: 'calendar_month',
    category: 'Academics',
    description: 'Manage class and exam timetables by level.',
  },
  {
    path: '/admin/forms',
    label: 'Forms',
    icon: 'checklist',
    category: 'Engagement',
    description: 'Build forms and review responses — RSVPs, surveys, applications.',
  },
  {
    path: '/admin/awards',
    label: 'Awards',
    icon: 'how_to_vote',
    category: 'Engagement',
    description: 'Run nominate, curate, vote, and reveal for department awards.',
  },
  {
    path: '/admin/broadcasts',
    label: 'Broadcasts',
    icon: 'campaign',
    category: 'Engagement',
    description: 'Send an announcement email to every opted-in user.',
  },
  {
    path: '/admin/reviews',
    label: 'Reviews',
    icon: 'fact_check',
    category: 'Governance',
    description: 'Approve or reject pending News, Events, and Awards edits.',
    ownerOnly: true,
  },
]

export default function Admin() {
  const { user } = useAuth()
  const pendingCountQuery = usePendingSubmissionsCountQuery()
  const pendingCount = pendingCountQuery.data ?? 0
  const adminRowQuery = useOwnAdminRowQuery(user?.id)
  const isOwner = Boolean(adminRowQuery.data?.is_owner)
  const visibleSections = ADMIN_SECTIONS.filter((s) => !s.ownerOnly || isOwner)

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-ink-900">Admin Dashboard</h1>
        <p className="max-w-2xl text-ink-muted">
          Exco-only workspace for managing news, events, resources, opportunities, excos, outlines,
          timetables, and student submissions.
        </p>
      </header>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visibleSections.map((s) => (
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
              <h2 className="flex items-center gap-2 text-xl font-bold text-ink-900">
                Manage {s.label}
                {s.path === '/admin/submissions' && pendingCount > 0 && (
                  <Badge tone="restricted">{pendingCount} pending</Badge>
                )}
              </h2>
              <p className="text-sm text-ink-muted">{s.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
