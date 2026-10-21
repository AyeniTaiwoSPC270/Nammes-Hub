import { Link, Outlet } from 'react-router-dom'
import AdminNotificationBell from './AdminNotificationBell'
import { HolidayBanner } from '../site/HolidayDecor'
import HolidayBackground from '../site/HolidayBackground'

export default function AdminLayout() {
  return (
    <div>
      {/* Behind everything: this shell has no bg-paper of its own (the body paints it, and the body's
          background is the canvas — below even a -z-10 layer), so the holiday page background slots
          in here with no wrapper change. */}
      <HolidayBackground />
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-5 pt-8 sm:px-6">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 py-2 text-sm font-semibold text-brand no-underline hover:text-orange-500"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Back to dashboard
        </Link>
        <AdminNotificationBell />
      </div>
      <HolidayBanner />
      <Outlet />
    </div>
  )
}
