import { Link } from 'react-router-dom'
import Button from '../components/ui/Button'

export default function NotFound() {
  return (
    <div className="flex items-center justify-center px-5 py-20">
      <div className="max-w-2xl w-full rounded-lg border border-hairline bg-surface shadow-md p-10 sm:p-14 text-center flex flex-col items-center">
        <span className="material-symbols-outlined text-green-900 text-6xl mb-4">error_outline</span>
        <h1 className="text-3xl sm:text-4xl font-bold text-ink-900 mb-3">404 - Page Not Found</h1>
        <p className="text-lg text-ink-muted mb-8 max-w-md">
          The page you&rsquo;re looking for doesn&rsquo;t exist or has been moved. Please check the
          URL or return to the homepage.
        </p>
        <Link to="/" className="no-underline">
          <Button variant="primary">Back to home</Button>
        </Link>
      </div>
    </div>
  )
}
