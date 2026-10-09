import AdminResourceManager from '../../components/admin/AdminResourceManager'
import { academicCalendarConfig } from './config/academicCalendarConfig'

export default function AdminCalendar() {
  return (
    <AdminResourceManager
      table="academic_calendar"
      title="Academic Calendar"
      config={academicCalendarConfig}
      // Session first so an archived session's dates stay together rather than interleaving with the live
      // one, then starts_at so a semester reads as a timeline. An ascending Postgres sort puts NULL last,
      // which is where the undated senate rows belong; loadRows cannot pass nullsFirst through, and does
      // not need to.
      orderBy={[
        { column: 'session', ascending: true },
        { column: 'starts_at', ascending: true },
      ]}
    />
  )
}
