import AdminResourceManager from '../../components/admin/AdminResourceManager'
import { opportunitiesAdminConfig } from './config/opportunitiesAdminConfig'

export default function AdminOpportunities() {
  return (
    <AdminResourceManager
      table="opportunities"
      title="Opportunities"
      config={opportunitiesAdminConfig}
      orderBy={{ column: 'deadline', ascending: true }}
    />
  )
}
