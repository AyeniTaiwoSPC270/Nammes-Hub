import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import { SkeletonText } from './ui/Skeleton'

export default function Layout() {
  return (
    <div className="min-h-svh flex flex-col bg-paper">
      <Navbar />
      <main className="flex-1">
        <Suspense
          fallback={
            <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
              <SkeletonText lines={3} />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
