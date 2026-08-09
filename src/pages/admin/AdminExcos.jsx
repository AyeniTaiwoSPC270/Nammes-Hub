import AdminResourceManager from '../../components/admin/AdminResourceManager'
import { excosAdminConfig } from './config/excosAdminConfig'

export default function AdminExcos() {
  return (
    <AdminResourceManager
      table="excos"
      title="Excos"
      config={excosAdminConfig}
      orderBy={{ column: 'sort_order', ascending: true }}
    />
  )
}
