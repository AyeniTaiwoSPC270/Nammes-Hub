import { Link } from 'react-router-dom'
import { useFormsQuery } from '../data/forms'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import { SkeletonCard } from '../components/ui/Skeleton'

export default function Forms() {
  const formsQuery = useFormsQuery()
  const forms = formsQuery.data ?? []

  if (formsQuery.isError && !formsQuery.data) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load forms right now." onRetry={formsQuery.refetch} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-xs uppercase tracking-[.04em] font-semibold text-ink-muted">Forms</span>
        <h1 className="text-3xl font-bold text-ink-900 sm:text-4xl">Open forms</h1>
        <p className="max-w-2xl text-ink-muted">Event registrations, surveys, and applications currently accepting responses.</p>
      </div>

      {formsQuery.isLoading ? (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : forms.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon="checklist" title="No open forms right now" description="Check back later for new surveys and sign-ups." />
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {forms.map((form) => (
            <Link key={form.id} to={`/forms/${form.id}`} className="no-underline">
              <Card eyebrow="Open" title={form.title} interactive>
                {form.description}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
