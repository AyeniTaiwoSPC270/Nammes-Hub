import { Link } from 'react-router-dom'
import { useFormsQuery, categoryLabel, categoryBadgeTone } from '../data/forms'
import { useResponseCountsQuery } from '../data/formResponses'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import Reveal from '../components/ui/Reveal'
import { SkeletonCard } from '../components/ui/Skeleton'

const CARD_STAGGER = 0.06
const MAX_STAGGER_DELAY = 0.3

function formatCloses(closesAt) {
  if (!closesAt) return null
  return new Date(closesAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function Forms() {
  const formsQuery = useFormsQuery()
  const countsQuery = useResponseCountsQuery()
  const forms = formsQuery.data ?? []
  const counts = countsQuery.data ?? {}

  if (formsQuery.isError && !formsQuery.data) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load forms right now." onRetry={formsQuery.refetch} />
      </div>
    )
  }

  const totalResponses = forms.reduce((sum, f) => sum + (counts[f.id] ?? 0), 0)
  const withDeadline = [...forms].filter((f) => f.closes_at).sort((a, b) => new Date(a.closes_at) - new Date(b.closes_at))
  const featured = withDeadline[0] ?? forms[0]
  const rest = forms.filter((f) => f.id !== featured?.id)

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-xs uppercase tracking-[.04em] font-semibold text-ink-muted">Forms</span>
        <h1 className="text-3xl font-bold text-ink-900 sm:text-4xl">Open forms</h1>
        <p className="max-w-2xl text-ink-muted">Event registrations, surveys, and applications currently accepting responses.</p>
      </div>

      {!formsQuery.isLoading && forms.length > 0 && (
        <div className="mt-8 grid grid-cols-2 gap-4 rounded-lg bg-surface-low p-5 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-ink-muted">Open now</span>
            <span className="text-2xl font-bold text-brand">{forms.length}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-ink-muted">Responses so far</span>
            <span className="text-2xl font-bold text-brand">{totalResponses}</span>
          </div>
          <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
            <span className="text-xs text-ink-muted">Next deadline</span>
            <span className="text-2xl font-bold text-orange-600">
              {withDeadline[0] ? formatCloses(withDeadline[0].closes_at) : 'None set'}
            </span>
          </div>
        </div>
      )}

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
        <div className="mt-8 flex flex-col gap-6">
          {featured && (
            <Reveal>
            <Link key={featured.id} to={`/forms/${featured.id}`} className="no-underline">
              <div className="flex flex-col justify-between gap-5 rounded-lg border border-hairline bg-surface p-6 shadow-md transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={categoryBadgeTone(featured.category)}>{categoryLabel(featured.category)}</Badge>
                    <Badge tone="updated">Open</Badge>
                    {featured.closes_at && (
                      <span className="text-xs text-ink-muted">Closes {formatCloses(featured.closes_at)}</span>
                    )}
                  </div>
                  <h2 className="text-2xl font-bold text-ink-900">{featured.title}</h2>
                  {featured.description && <p className="max-w-xl text-ink-muted">{featured.description}</p>}
                </div>
                <span className="inline-flex shrink-0 items-center justify-center rounded-md bg-green-900 px-6 py-3 text-center text-sm font-bold text-white">
                  Fill form
                </span>
              </div>
            </Link>
            </Reveal>
          )}

          {rest.length > 0 && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((form, i) => (
                <Reveal key={form.id} delay={Math.min(i * CARD_STAGGER, MAX_STAGGER_DELAY)}>
                <Link to={`/forms/${form.id}`} className="no-underline">
                  <div className="flex h-full flex-col justify-between gap-3 rounded-lg border border-hairline bg-surface p-6 shadow-md transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-md">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Badge tone={categoryBadgeTone(form.category)}>{categoryLabel(form.category)}</Badge>
                        <Badge tone="updated">Open</Badge>
                      </div>
                      <h3 className="line-clamp-2 text-xl font-bold text-ink-900">{form.title}</h3>
                      {form.description && <p className="line-clamp-3 text-sm text-ink-muted">{form.description}</p>}
                    </div>
                    {form.closes_at && <span className="text-xs text-ink-muted">Closes {formatCloses(form.closes_at)}</span>}
                  </div>
                </Link>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
