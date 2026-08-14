import { Link, useSearchParams } from 'react-router-dom'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import { SkeletonCard } from '../components/ui/Skeleton'
import { useNewsQuery, getNews, filterNewsByCategory, NEWS_CATEGORIES } from '../data/news'

const categories = ['All', ...NEWS_CATEGORIES]

export default function News() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data, isLoading, isError, refetch } = useNewsQuery()

  const requestedCategory = searchParams.get('category')
  const active = categories.includes(requestedCategory) ? requestedCategory : 'All'
  const items = filterNewsByCategory(getNews(data ?? []), active)
  const [featured, ...rest] = items

  function selectCategory(category) {
    if (category === 'All') {
      setSearchParams({})
    } else {
      setSearchParams({ category })
    }
  }

  return (
    <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
      <div className="font-mono text-xs font-bold uppercase tracking-[.04em] text-green-700">News</div>
      <h1 className="mt-1.5 text-[32px]">Department news</h1>
      <p className="mt-2 max-w-2xl text-ink-muted">
        Department news and announcements, posted jointly with the PRO.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => selectCategory(category)}
            className={[
              'rounded-full px-4 py-2 text-sm font-semibold',
              category === active ? 'bg-green-100 text-green-700' : 'text-ink hover:text-green-700',
            ].join(' ')}
          >
            {category}
          </button>
        ))}
      </div>

      {isError && !data ? (
        <div className="mt-8">
          <ErrorState message="Couldn't load news right now." onRetry={refetch} />
        </div>
      ) : isLoading ? (
        <div className="mt-6 flex flex-col gap-4">
          <SkeletonCard imageVariant="cover" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SkeletonCard imageVariant="cover" />
            <SkeletonCard imageVariant="cover" />
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No news yet" body="No news posts in this category yet." />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          <Link to={`/news/${featured.id}`} className="block">
            <Card
              interactive
              tone={featured.tone}
              eyebrow={featured.category}
              title={featured.title}
              meta={featured.date}
              image={featured.image_url ? { src: featured.image_url } : undefined}
              imageVariant="cover"
              imageAspect="video"
            >
              {featured.body}{' '}
              {featured.badge_tone && <Badge tone={featured.badge_tone}>{featured.badge_label}</Badge>}
            </Card>
          </Link>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {rest.map((item) => (
              <Link key={item.id} to={`/news/${item.id}`} className="block">
                <Card
                  interactive
                  tone={item.tone}
                  eyebrow={item.category}
                  title={item.title}
                  meta={item.date}
                  image={item.image_url ? { src: item.image_url } : undefined}
                  imageVariant="cover"
                  imageAspect="standard"
                >
                  {item.body}{' '}
                  {item.badge_tone && <Badge tone={item.badge_tone}>{item.badge_label}</Badge>}
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
