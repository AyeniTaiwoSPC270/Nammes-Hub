import AdminResourceManager from '../../components/admin/AdminResourceManager'
import { timetablesAdminConfig } from './config/timetablesAdminConfig'

export default function AdminTimetables() {
  return (
    <AdminResourceManager
      table="timetables"
      title="Timetable"
      config={timetablesAdminConfig}
      orderBy={{ column: 'start_time', ascending: true }}
    />
  )
}
