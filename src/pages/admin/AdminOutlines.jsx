import AdminResourceManager from '../../components/admin/AdminResourceManager'
import { outlinesAdminConfig } from './config/outlinesAdminConfig'

export default function AdminOutlines() {
  return (
    <AdminResourceManager
      table="outlines"
      title="Outlines"
      config={outlinesAdminConfig}
      orderBy={[
        { column: 'level', ascending: true },
        { column: 'semester', ascending: true },
        { column: 'code', ascending: true },
      ]}
    />
  )
}
