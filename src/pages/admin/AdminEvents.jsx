import { Link } from 'react-router-dom'
import AdminResourceManager from '../../components/admin/AdminResourceManager'
import { eventsAdminConfig } from './config/eventsAdminConfig'

export default function AdminEvents() {
  return (
    <AdminResourceManager
      table="events"
      title="Events"
      config={eventsAdminConfig}
      orderBy={{ column: 'created_at', ascending: true }}
      renderRowExtra={(row) => (
        <Link
          to={`/admin/events/${row.id}/gallery`}
          title="Manage gallery"
          className="text-ink-muted transition-colors hover:text-green-900"
        >
          <span className="material-symbols-outlined text-xl">photo_library</span>
        </Link>
      )}
    />
  )
}
