import AdminResourceManager from '../../components/admin/AdminResourceManager'
import { newsAdminConfig } from './config/newsAdminConfig'

export default function AdminNews() {
  return (
    <AdminResourceManager
      table="news"
      title="News"
      config={newsAdminConfig}
      orderBy={{ column: 'date', ascending: false }}
    />
  )
}
