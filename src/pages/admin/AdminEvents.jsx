import AdminResourceManager from '../../components/admin/AdminResourceManager'
import { eventsAdminConfig } from './config/eventsAdminConfig'

export default function AdminEvents() {
  return (
    <AdminResourceManager
      table="events"
      title="Events"
      config={eventsAdminConfig}
      orderBy={{ column: 'created_at', ascending: true }}
    />
  )
}
