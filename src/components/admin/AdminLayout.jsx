import { Link, Outlet } from 'react-router-dom'

export default function AdminLayout() {
  return (
    <div>
      <div className="mx-auto max-w-[1200px] px-5 pt-8 sm:px-6">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand no-underline hover:text-orange-500"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Back to dashboard
        </Link>
      </div>
      <Outlet />
    </div>
  )
}
