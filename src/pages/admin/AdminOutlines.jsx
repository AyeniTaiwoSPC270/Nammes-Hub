import AdminResourceManager from '../../components/admin/AdminResourceManager'
import { outlinesAdminConfig } from './config/outlinesAdminConfig'

export default function AdminOutlines() {
  return (
    <AdminResourceManager
      table="outlines"
      title="Outlines"
      config={outlinesAdminConfig}
      orderBy={{ column: 'code', ascending: true }}
    />
  )
}
