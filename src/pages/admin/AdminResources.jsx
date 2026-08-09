import AdminResourceManager from '../../components/admin/AdminResourceManager'
import { resourcesAdminConfig } from './config/resourcesAdminConfig'

export default function AdminResources() {
  return (
    <AdminResourceManager
      table="resources"
      title="Resources"
      config={resourcesAdminConfig}
      orderBy={{ column: 'title', ascending: true }}
    />
  )
}
